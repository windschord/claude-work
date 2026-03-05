import type { IPty } from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as tar from 'tar-fs';
import { Writable } from 'stream';
import type { CreateSessionOptions, PTYExitInfo } from '../environment-adapter';
import { ClaudeOptionsService } from '../claude-options-service';
import { scrollbackBuffer } from '../scrollback-buffer';
import { db, schema } from '@/lib/db';
import { eq, isNotNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { BasePTYAdapter } from './base-adapter';
import { DeveloperSettingsService } from '@/services/developer-settings-service';
import { EncryptionService } from '@/services/encryption-service';
import { DockerClient } from '../docker-client';
import { DockerPTYStream } from '../docker-pty-stream';
import Docker from 'dockerode';
import * as fsPromises from 'fs/promises';
import type { PortMapping, VolumeMount } from '@/types/environment';
import { getConfigVolumeNames } from '@/lib/docker-volume-utils';
import { networkFilterService } from '@/services/network-filter-service';

export interface DockerAdapterConfig {
  environmentId: string;
  imageName: string;
  imageTag: string;
  authDirPath?: string; // 環境専用認証ディレクトリ（絶対パス）。名前付きVolume使用時はundefined
  portMappings?: PortMapping[];    // カスタムポートマッピング
  volumeMounts?: VolumeMount[];    // カスタムボリュームマウント
}

export interface GitCloneOptions {
  url: string;
  targetPath: string;
  environmentId: string;
}

export interface GitCloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface GitPullResult {
  success: boolean;
  updated: boolean;
  message: string;
  error?: string;
}

export interface Branch {
  name: string;
  isDefault: boolean;
  isRemote: boolean;
}

export interface SshKey {
  id: string;
  name: string;
  public_key: string;
  private_key_encrypted: string;
  encryption_iv: string;
  has_passphrase: boolean;
}

interface DockerSession {
  ptyProcess: IPty;
  workingDir: string;
  containerId: string;
  claudeSessionId?: string;
  errorBuffer: string;
  hasReceivedOutput: boolean;
  shellMode: boolean;
  lastKnownCols?: number;
  lastKnownRows?: number;
  containerWorkDir?: string;  // コンテナ内の作業ディレクトリ（dockerVolumeId使用時はworkingDir、それ以外は'/workspace'）
}

/**
 * DockerAdapter
 *
 * Docker環境用のアダプター。
 * 環境ごとに独立した認証情報ディレクトリを使用。
 *
 * DockerPTYAdapter（ホスト認証共有）とは異なり、
 * 各ExecutionEnvironmentが持つ専用の認証ディレクトリをマウントする。
 *
 * イベント:
 * - 'data': PTYからの出力 (sessionId: string, data: string)
 * - 'exit': PTYプロセス終了 (sessionId: string, info: PTYExitInfo)
 * - 'error': エラー発生 (sessionId: string, error: Error)
 * - 'claudeSessionId': Claude CodeセッションID抽出 (sessionId: string, claudeSessionId: string)
 */
export class DockerAdapter extends BasePTYAdapter {
  private config: DockerAdapterConfig;
  private sessions: Map<string, DockerSession> = new Map();
  /** 環境IDごとのアクティブセッション参照カウント（複数セッション時のremoveFilter制御用） */
  private activeSessionCount: Map<string, number> = new Map();
  private developerSettingsService: DeveloperSettingsService;
  private encryptionService: EncryptionService;

  /**
   * 環境IDからClaude設定用Volume名を生成
   * @see getConfigVolumeNames (src/lib/docker-volume-utils.ts)
   */
  static getConfigVolumeNames(environmentId: string): {
    claudeVolume: string;
    configClaudeVolume: string;
  } {
    return getConfigVolumeNames(environmentId);
  }

  constructor(config: DockerAdapterConfig) {
    super();

    // authDirPathが指定されている場合のみバリデーション（既存環境の後方互換性）
    if (config.authDirPath) {
      if (!path.isAbsolute(config.authDirPath)) {
        throw new Error(`DockerAdapter: authDirPath must be an absolute path, got: ${config.authDirPath}`);
      }
      const normalizedAuthPath = path.resolve(config.authDirPath);
      // Use path separator boundaries to prevent false positives (e.g., env-1 matching env-10)
      const pathSegments = normalizedAuthPath.split(path.sep);
      if (!pathSegments.includes(config.environmentId)) {
        throw new Error(
          `DockerAdapter: authDirPath must contain environmentId for isolation. ` +
          `Expected path segment '${config.environmentId}', got: ${normalizedAuthPath}`
        );
      }
    }

    this.config = config;
    this.developerSettingsService = new DeveloperSettingsService();
    this.encryptionService = new EncryptionService();
    logger.info('DockerAdapter initialized', {
      environmentId: config.environmentId,
      imageName: config.imageName,
      imageTag: config.imageTag,
    });
  }

  /**
   * Constructs Dockerode container options from session parameters.
   */
  protected buildContainerOptions(workingDir: string, options?: CreateSessionOptions): {
    createOptions: Docker.ContainerCreateOptions;
    containerName: string;
  } {
    const containerName = `claude-env-${this.config.environmentId.substring(0, 8)}-${Date.now()}`;
    const Binds: string[] = [];
    const Env: string[] = [];
    const PortBindings: any = {};
    const ExposedPorts: any = {};
    const Cmd: string[] = [];
    let Entrypoint: string[] = [];

    // Workspace mount
    // workingDirConfig is the path used as WorkingDir inside the container.
    // - With dockerVolumeId: The named volume is mounted at /repo, and workingDir
    //   is an absolute path within that volume (e.g., /repo/.worktrees/session-name/).
    //   The container's WorkingDir is set to this path directly.
    // - Without dockerVolumeId: The host workingDir is bind-mounted at /workspace,
    //   and the container's WorkingDir is set to /workspace.
    let workingDirConfig = workingDir;
    if (options?.dockerVolumeId) {
       // Validate volume ID (Docker spec: [a-zA-Z0-9][a-zA-Z0-9_.-]*)
       if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(options.dockerVolumeId)) {
        throw new Error(`Invalid dockerVolumeId format: ${options.dockerVolumeId}`);
      }
      Binds.push(`${options.dockerVolumeId}:/repo`);
    } else {
      Binds.push(`${workingDir}:/workspace`);
      workingDirConfig = '/workspace';
    }

    // Auth dirs: named volumes or bind mounts (backward compatibility)
    if (this.config.authDirPath) {
      // 既存環境: バインドマウント（後方互換性）
      const claudeDir = path.join(this.config.authDirPath, 'claude');
      const claudeConfigDir = path.join(this.config.authDirPath, 'config', 'claude');
      if (fs.existsSync(claudeDir)) {
        Binds.push(`${claudeDir}:/home/node/.claude`);
      }
      if (fs.existsSync(claudeConfigDir)) {
        Binds.push(`${claudeConfigDir}:/home/node/.config/claude`);
      }
    } else {
      // 新規環境: 名前付きVolume
      const volumes = DockerAdapter.getConfigVolumeNames(this.config.environmentId);
      Binds.push(`${volumes.claudeVolume}:/home/node/.claude`);
      Binds.push(`${volumes.configClaudeVolume}:/home/node/.config/claude`);
    }

    // Git auth (RO)
    const homeDir = os.homedir();
    const sshDir = path.join(homeDir, '.ssh');
    if (fs.existsSync(sshDir)) {
      Binds.push(`${sshDir}:/home/node/.ssh:ro`);
    }
    const gitconfigPath = path.join(homeDir, '.gitconfig');
    if (fs.existsSync(gitconfigPath)) {
      Binds.push(`${gitconfigPath}:/home/node/.gitconfig:ro`);
    }

    // SSH Agent
    const sshAuthSock = process.env.SSH_AUTH_SOCK;
    if (sshAuthSock) {
      Binds.push(`${sshAuthSock}:/ssh-agent`);
      Env.push('SSH_AUTH_SOCK=/ssh-agent');
    }

    // Port Mappings
    if (this.config.portMappings) {
      for (const pm of this.config.portMappings) {
        const protocol = String(pm.protocol ?? 'tcp').toLowerCase();
        const containerPortKey = `${pm.containerPort}/${protocol}`;
        PortBindings[containerPortKey] = [{ HostPort: String(pm.hostPort) }];
        ExposedPorts[containerPortKey] = {};
      }
    }

    // Custom Volume Mounts
    if (this.config.volumeMounts) {
      for (const vm of this.config.volumeMounts) {
        const mode = vm.accessMode === 'ro' ? ':ro' : '';
        Binds.push(`${vm.hostPath}:${vm.containerPath}${mode}`);
      }
    }

    // ANTHROPIC_API_KEY - passed via Docker API (standard practice).
    // Note: API keys in environment variables are visible via `docker inspect`.
    // This is acceptable as Docker API access implies host-level trust.
    if (process.env.ANTHROPIC_API_KEY) {
      Env.push(`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);
    }

    // Custom Env Vars
    // Note: Sensitive variable filtering is intentionally not implemented here.
    // Custom env vars are user-configured and passed through Docker API,
    // which is standard Docker practice. Log output only includes key names.
    if (!options?.shellMode && options?.customEnvVars) {
      for (const [key, value] of Object.entries(options.customEnvVars)) {
        if (ClaudeOptionsService.validateEnvVarKey(key) && typeof value === 'string') {
          Env.push(`${key}=${value}`);
        }
      }
      logger.info('DockerAdapter: Custom environment variables applied', {
        keys: Object.keys(options.customEnvVars),
      });
    }

    // Entrypoint
    Entrypoint = options?.shellMode ? ['/bin/sh'] : ['claude'];
    
    // Arguments
    if (!options?.shellMode) {
       if (options?.skipPermissions) {
         Cmd.push('--dangerously-skip-permissions');
         logger.info('DockerAdapter: --dangerously-skip-permissions enabled');
       }

       if (options?.resumeSessionId) {
         Cmd.push('--resume', options.resumeSessionId);
       }

       if (options?.claudeCodeOptions) {
         const customArgs = ClaudeOptionsService.buildCliArgs(options.claudeCodeOptions);
         Cmd.push(...customArgs);
         
         const safeArgs = customArgs.map((arg) => {
            if (!arg.startsWith('-')) return '[REDACTED]';
            const eqIndex = arg.indexOf('=');
            return eqIndex === -1 ? arg : `${arg.slice(0, eqIndex)}=[REDACTED]`;
          });
          logger.info('DockerAdapter: Custom CLI options applied', {
            args: safeArgs,
          });
       }
    }

    const createOptions: Docker.ContainerCreateOptions = {
      name: containerName,
      Image: `${this.config.imageName}:${this.config.imageTag}`,
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Env,
      Cmd: Cmd.length > 0 ? Cmd : undefined,
      Entrypoint,
      WorkingDir: workingDirConfig,
      HostConfig: {
        Binds,
        PortBindings,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        // AutoRemove: container is automatically removed after exit.
        // Note: This means container logs are unavailable after exit and
        // container.wait() may fail if the container is already removed.
        // The stopContainer() method handles 404 errors for this case.
        AutoRemove: true,
      },
      ExposedPorts,
    };

    return { createOptions, containerName };
  }

  /**
   * 親セッションIDを取得（-terminal サフィックスを除去）
   */
  private getParentSessionId(sessionId: string): string | null {
    if (sessionId.endsWith('-terminal')) {
      return sessionId.slice(0, -'-terminal'.length);
    }
    return null;
  }

  /**
   * 親セッション（Claude）のコンテナ名を取得
   */
  private getParentContainerName(sessionId: string): string | null {
    const parentId = this.getParentSessionId(sessionId);
    if (parentId) {
      const parentSession = this.sessions.get(parentId);
      if (parentSession) {
        return parentSession.containerId;
      }
    }
    return null;
  }

  /**
   * execセッションのコンテナ内作業ディレクトリを解決
   *
   * 1. メモリ上の親セッションからcontainerWorkDirを取得
   * 2. メモリにない場合（サーバー再起動後等）、DBからプロジェクト情報を取得して推定
   * 3. いずれも取得できない場合は'/workspace'にフォールバック
   */
  private resolveExecWorkDir(sessionId: string): string {
    const parentId = this.getParentSessionId(sessionId);
    if (!parentId) return '/workspace';

    // 1. メモリから取得
    const parentSession = this.sessions.get(parentId);
    if (parentSession?.containerWorkDir) {
      return parentSession.containerWorkDir;
    }

    // 2. DBから推定（サーバー再起動後のフォールバック）
    try {
      const parentRecord = db.select({
        worktree_path: schema.sessions.worktree_path,
        project_id: schema.sessions.project_id,
      }).from(schema.sessions).where(eq(schema.sessions.id, parentId)).get();

      if (parentRecord) {
        const project = db.select({
          clone_location: schema.projects.clone_location,
        }).from(schema.projects).where(eq(schema.projects.id, parentRecord.project_id)).get();

        if (project?.clone_location === 'docker') {
          // パストラバーサル防止: .worktrees/を含み、..を含まないことを検証
          const wp = parentRecord.worktree_path;
          if (wp.includes('.worktrees/') && !wp.includes('..')) {
            logger.info('DockerAdapter: Resolved exec CWD from DB (docker volume mode)', {
              sessionId, parentId, workDir: wp,
            });
            return wp;
          }
          logger.warn('DockerAdapter: Invalid worktree_path from DB, falling back to /workspace', {
            sessionId, parentId, worktreePath: wp,
          });
        }
      }
    } catch (error) {
      logger.warn('DockerAdapter: Failed to recover containerWorkDir from DB', {
        sessionId, parentId, error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    return '/workspace';
  }

  /**
   * Dockerコンテナが実際に存在し、実行中かを確認
   */
  private async isContainerRunning(containerName: string): Promise<boolean> {
    try {
      const container = await DockerClient.getInstance().inspectContainer(containerName);
      return container.State.Running;
    } catch {
      return false;
    }
  }

  /**
   * コンテナのネットワーク設定からサブネットを取得する。
   * NetworkSettings から IPAddress と IPPrefixLen を使ってサブネットを計算する。
   * 取得に失敗した場合はフォールバック値 '172.17.0.0/16' を返す。
   */
  private async getContainerSubnet(container: Docker.Container): Promise<string> {
    const fallbackSubnet = '172.17.0.0/16';
    try {
      const info = await container.inspect();
      const networks = info.NetworkSettings?.Networks ?? {};
      for (const network of Object.values(networks)) {
        const ipAddress = network.IPAddress;
        const prefixLen = network.IPPrefixLen;
        if (ipAddress && prefixLen > 0) {
          // IPアドレスのマスク部分をゼロにしてサブネットを計算
          const parts = ipAddress.split('.').map(Number);
          const maskBits = prefixLen;
          // 32ビット整数に変換してマスクを適用
          const ipInt =
            (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
          const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
          const networkInt = (ipInt & mask) >>> 0;
          const subnet = [
            (networkInt >>> 24) & 0xff,
            (networkInt >>> 16) & 0xff,
            (networkInt >>> 8) & 0xff,
            networkInt & 0xff,
          ].join('.') + `/${maskBits}`;
          logger.debug('DockerAdapter: Detected container subnet', { subnet });
          return subnet;
        }
      }
      logger.debug('DockerAdapter: No IP address found, using fallback subnet', { fallbackSubnet });
    } catch (err) {
      logger.warn('DockerAdapter: Failed to inspect container for subnet, using fallback', {
        error: err,
        fallbackSubnet,
      });
    }
    return fallbackSubnet;
  }

  /**
   * Dockerコンテナが完全に起動するまで待機
   */
  private async waitForContainerReady(containerId: string): Promise<void> {
    const maxRetries = 30;
    const retryInterval = 1000; // 1秒
    const timeout = 30000; // 30秒

    logger.info(`Waiting for container ${containerId} to be ready`);

    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // タイムアウトチェック
      if (Date.now() - startTime > timeout) {
        throw new Error(`Container ${containerId} failed to start within ${timeout}ms`);
      }

      try {
        // コンテナの状態を確認
        const container = await DockerClient.getInstance().inspectContainer(containerId);
        const isRunning = container.State.Running;

        if (isRunning) {
          // 追加のヘルスチェック（コンテナ内でコマンドを実行）
          try {
            // exec wrapper
            const exec = await DockerClient.getInstance().getContainer(containerId).exec({
              Cmd: ['echo', 'health-check'],
              AttachStdout: true,
            });
            await exec.start({});

            logger.info(`Container ${containerId} is ready after ${attempt} attempts`);
            return;
          } catch {
            logger.debug(`Container ${containerId} not fully ready, exec failed`);
          }
        }
      } catch {
        logger.debug(`Container ${containerId} inspection failed, retry ${attempt}/${maxRetries}`);
      }

      // 次の試行まで待機
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    throw new Error(`Container ${containerId} health check failed after ${maxRetries} attempts`);
  }

  /**
   * Dockerコンテナを停止する
   */
  private async stopContainer(containerName: string): Promise<boolean> {
    logger.info(`Stopping container ${containerName}`);

    try {
      const container = DockerClient.getInstance().getContainer(containerName);
      // 10秒のタイムアウトで停止
      await container.stop({ t: 10 });

      logger.info(`Container ${containerName} stopped successfully`);
      return true;
    } catch (error: any) {
      // コンテナが既に停止している、または存在しない場合はエラーを無視
      if (error.statusCode === 304 || error.statusCode === 404 || (error.message && error.message.includes('No such container'))) {
        logger.debug(`Container ${containerName} already stopped or not found`);
        return true;
      }

      logger.error(`Failed to stop container ${containerName}:`, error);

      // 強制停止を試行
      try {
        const container = DockerClient.getInstance().getContainer(containerName);
        await container.kill();
        logger.warn(`Container ${containerName} force-killed`);
        return true;
      } catch (killError) {
        logger.error(`Failed to force-kill container ${containerName}:`, killError);
        return false;
      }
    }
  }

  /**
   * コンテナ停止を待つPromiseを返す
   */
  private async waitForContainer(containerName: string): Promise<void> {
    try {
      const container = DockerClient.getInstance().getContainer(containerName);
      await container.wait();
    } catch (error) {
      logger.warn(`Failed to wait for container ${containerName}`, { error });
    }
  }

  /**
   * docker exec でシェルセッションを作成
   */
  private async createExecSession(
    sessionId: string,
    containerName: string,
    workingDir: string,
    cols: number,
    rows: number
  ): Promise<void> {
    const execCwd = this.resolveExecWorkDir(sessionId);

    logger.info('DockerAdapter: Creating exec session (attaching to existing container)', {
      sessionId,
      containerName,
      workingDir,
      cols,
      rows,
    });

    try {
      const container = DockerClient.getInstance().getContainer(containerName);

      const exec = await container.exec({
        Cmd: ['bash'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        WorkingDir: execCwd,
      });

      const stream = await exec.start({
        hijack: true,
        stdin: true,
        Tty: true,
      });

      const ptyProcess = new DockerPTYStream({
        cols,
        rows,
        isContainer: false,
        exec: exec,
      });
      ptyProcess.setStream(stream);

      this.sessions.set(sessionId, {
        ptyProcess,
        workingDir,
        containerId: containerName, // 親コンテナと同じIDを参照
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: true,
      });

      // イベント転送
      ptyProcess.onData((data: string) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          if (!session.hasReceivedOutput && data.length > 0) {
            session.hasReceivedOutput = true;
          }
        }
        this.emit('data', sessionId, data);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        logger.info('DockerAdapter: Exec session exited', { sessionId, exitCode, signal });

        // 旧PTYのonExit遅延発火で新セッションを消さないようにチェック
        const currentSession = this.sessions.get(sessionId);
        if (currentSession && currentSession.ptyProcess !== ptyProcess) {
          logger.info('DockerAdapter: Stale exec onExit ignored (new session exists)', { sessionId });
          return;
        }

        this.emit('exit', sessionId, { exitCode, signal } as PTYExitInfo);
        this.sessions.delete(sessionId);
      });

    } catch (error) {
      logger.error('DockerAdapter: Failed to create exec session', {
        sessionId,
        containerName,
        error: error instanceof Error ? error.message : 'Unknown error',
        activeSessions: Array.from(this.sessions.keys()),
      });
      if (this.listenerCount('error') > 0) {
        this.emit('error', sessionId, error instanceof Error ? error : new Error('Unknown error'));
      }
      throw error;
    }
  }

  async createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): Promise<void> {
    // 既存のセッションがあれば再利用（破棄しない）
    if (this.sessions.has(sessionId)) {
      logger.info('DockerAdapter: Reusing existing session', { sessionId });
      return;
    }

    const shellMode = options?.shellMode ?? false;
    const cols = options?.cols ?? 80;
    const rows = options?.rows ?? 24;

    // シェルモードの場合、親コンテナ（Claude）に接続を試みる
    if (shellMode) {
      // まずメモリから親コンテナ名を取得
      let parentContainerName = this.getParentContainerName(sessionId);

      // メモリにない場合、データベースから取得を試みる
      if (!parentContainerName) {
        const parentSessionId = this.getParentSessionId(sessionId);
        if (parentSessionId) {
          try {
            const parentSession = db.select({ container_id: schema.sessions.container_id })
              .from(schema.sessions)
              .where(eq(schema.sessions.id, parentSessionId))
              .get();
            if (parentSession?.container_id) {
              parentContainerName = parentSession.container_id;
              logger.info('DockerAdapter: Found container_id from database', {
                sessionId,
                parentSessionId,
                containerName: parentContainerName,
              });
            }
          } catch (error) {
            logger.warn('DockerAdapter: Failed to fetch container_id from database', {
              sessionId,
              parentSessionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      if (parentContainerName) {
        // コンテナが実際に実行中か確認
        if (!(await this.isContainerRunning(parentContainerName))) {
          const error = new Error(
            'Dockerコンテナが実行されていません。Claude Codeセッションが終了した可能性があります。' +
            'Shellタブを使用するにはClaudeセッションを再起動してください。'
          );
          logger.warn('DockerAdapter: Parent container is not running', {
            sessionId,
            parentContainerName,
            parentSessionId: this.getParentSessionId(sessionId),
            activeSessions: Array.from(this.sessions.keys()),
          });
          // errorリスナーがある場合のみemit（リスナー未登録時のプロセスクラッシュを防止）
          if (this.listenerCount('error') > 0) {
            this.emit('error', sessionId, error);
          }
          throw error;
        }
        await this.createExecSession(sessionId, parentContainerName, workingDir, cols, rows);
        return;
      }
      // 親コンテナがない場合はエラー
      const error = new Error(
        'Dockerコンテナが見つかりません。Claude Codeセッションを先に開始してください。'
      );
      logger.warn('DockerAdapter: Shell mode requested but no parent container found', {
        sessionId,
        parentSessionId: this.getParentSessionId(sessionId),
        activeSessions: Array.from(this.sessions.keys()),
      });
      // errorリスナーがある場合のみemit（リスナー未登録時のプロセスクラッシュを防止）
      if (this.listenerCount('error') > 0) {
        this.emit('error', sessionId, error);
      }
      throw error;
    }

    const { createOptions, containerName } = this.buildContainerOptions(workingDir, options);

    // クライアントから渡されたターミナルサイズを使用（未指定時はデフォルト80x24）
    const initialCols = options?.cols ?? 80;
    const initialRows = options?.rows ?? 24;

    logger.info('DockerAdapter: Creating session', {
      sessionId,
      workingDir,
      containerName,
      image: `${this.config.imageName}:${this.config.imageTag}`,
      cols: initialCols,
      rows: initialRows,
    });

    let container: Docker.Container | undefined;
    let ptyProcess: DockerPTYStream | undefined;
    let activeCountIncremented = false;
    let filterApplied = false;
    try {
      // Issue #193: 無保護ウィンドウ修正
      // フィルタリングが有効な場合、まずコンテナを NetworkMode: 'none' で起動して
      // 起動直後のネットワークを無効化し、その後 container.start() の直後に bridge
      // ネットワークへ接続してから applyFilter() で iptables ルールを適用する。
      // これにより、container.start() 直後に任意のネットワークへ接続されることを防ぎつつ、
      // bridge 接続後から applyFilter() 完了までの無保護ウィンドウを最小化する。
      // NOTE: isFilterEnabled() と applyFilter() はそれぞれ内部で getFilterConfig() を呼び出すため、
      // フィルタ有効時にDB参照が二重に発生する。これは意図的な設計であり、以下の理由で許容している:
      //   - applyFilter() は独立して呼び出されるケースもあるため、内部で設定の再取得が必要
      //   - applyFilter() 内部での再取得は、適用時点での最新設定を保証する鮮度担保の役割も持つ
      //   - SQLiteのローカルファイルアクセスのため、二重読み取りのパフォーマンス影響は無視できる
      const filterEnabled = await networkFilterService.isFilterEnabled(this.config.environmentId);
      if (filterEnabled) {
        // NetworkMode='none'はPortBindingsと非互換のため、ポートマッピングが設定されている場合はエラー
        if (this.config.portMappings && this.config.portMappings.length > 0) {
          throw new Error(
            'Port mappings are not supported when network filtering is enabled'
          );
        }
        createOptions.HostConfig = createOptions.HostConfig ?? {};
        createOptions.HostConfig.NetworkMode = 'none';
        logger.info('DockerAdapter: Network filtering enabled, starting container with NetworkMode=none', {
          sessionId,
          environmentId: this.config.environmentId,
        });
      }
      container = await DockerClient.getInstance().createContainer(createOptions);

      // Attach stream (hijack)
      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
        hijack: true,
      });

      ptyProcess = new DockerPTYStream({
        cols: initialCols,
        rows: initialRows,
        isContainer: true,
        container: container,
      });

      // IMPORTANT: setStream() must be called before container.start() to avoid
      // missing early output. setStream() synchronously registers listeners on the
      // already-attached stream, so no data is lost between attach and start.
      ptyProcess.setStream(stream);

      // Start container after stream listeners are registered
      // フィルタリング有効時はNetworkMode=noneのため、ネットワーク通信不可の状態で起動
      await container.start();

      // Issue #193: フィルタリング有効時はbridgeネットワークへ接続（iptablesルール適用前）
      // 既知の制約: bridge接続からapplyFilter()完了までの間はフィルタ未適用でネットワーク通信可能。
      // これは設計上の既知の制約であり、以下の理由で許容している:
      //   - コンテナは起動直後で初期化中のため、ユーザー入力はまだ受け付けていない
      //   - waitForContainerReady()完了前のため、Claude Codeは操作可能な状態ではない
      //   - DNS解決遅延がある場合は隙間が数秒に拡大する可能性があるが、
      //     従来の「コンテナ起動時点から無保護」に比べ大幅に改善される
      // 詳細: docs/sdd/design/network-filtering/issue-193-unprotected-window.md
      if (filterEnabled) {
        try {
          const docker = DockerClient.getInstance().getDockerInstance();
          const bridgeNetwork = docker.getNetwork('bridge');
          await bridgeNetwork.connect({ Container: container.id });
          logger.info('DockerAdapter: Connected container to bridge network', {
            sessionId,
            containerId: container.id,
          });
        } catch (networkError) {
          logger.error('DockerAdapter: Failed to connect container to bridge network', {
            sessionId,
            error: networkError,
          });
          try { await container.stop({ t: 5 }); } catch { /* ignore */ }
          try { await container.remove({ force: true }); } catch { /* ignore */ }
          throw networkError;
        }
      }

      // ネットワークフィルタリング適用（コンテナ起動後、ready待ち前）
      // フィルタリング無効の場合はnetworkFilterService内部でスキップされる
      try {
        // コンテナのネットワーク設定からsubnetを動的に取得
        // getContainerSubnet()は取得失敗時に'172.17.0.0/16'にフォールバックする機構を持つ。
        // Docker Engine はnetwork.connect()完了時点でIPを即座に割り当てるため、
        // 通常はinspectでIP情報を取得可能。フォールバックが使われるケースは稀だが、
        // 詳細はgetContainerSubnet()メソッドおよび設計書の「既知の制約」セクションを参照。
        //
        // 既知の制約: サブネットベースのフィルタリングの影響範囲について
        // containerSubnet は container.inspect() の IPPrefixLen から計算されるため、
        // Dockerデフォルトbridgeネットワーク上の他コンテナにも同じサブネットが適用され得る。
        // つまり、iptablesの -s ${containerSubnet} ルールは同一bridgeサブネット上の全コンテナに影響する。
        // ただし、以下の理由で現時点では許容している:
        //   - ClaudeWorkが管理するコンテナのみが対象であり、外部コンテナとの共存は想定外
        //   - フィルタルールは環境ごとにユニークなチェイン名を使用するため、ルールの競合は発生しない
        //   - 完全なコンテナ単位の分離が必要な場合は、環境ごとに専用のDockerネットワークを
        //     作成する方式への移行が必要（将来の拡張候補）
        const containerSubnet = await this.getContainerSubnet(container);
        await networkFilterService.applyFilter(this.config.environmentId, containerSubnet);
        filterApplied = true;
      } catch (filterError) {
        logger.error('Network filter application failed, stopping container', {
          sessionId,
          error: filterError,
        });
        try { await container.stop({ t: 5 }); } catch { /* ignore */ }
        try { await container.remove({ force: true }); } catch { /* ignore */ }
        throw filterError;
      }

      // アクティブセッション参照カウントをインクリメント
      const envId = this.config.environmentId;
      this.activeSessionCount.set(envId, (this.activeSessionCount.get(envId) ?? 0) + 1);
      // フラグ: カウントをインクリメントしたため、失敗時にロールバックが必要
      activeCountIncremented = true;

      const containerWorkDir = options?.dockerVolumeId ? workingDir : '/workspace';
      this.sessions.set(sessionId, {
        ptyProcess,
        workingDir,
        containerId: containerName,
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
        lastKnownCols: initialCols,
        lastKnownRows: initialRows,
        containerWorkDir,
      });

      // コンテナ起動完了を待機（TASK-012）
      await this.waitForContainerReady(containerName);

      // Session.container_idを更新
      db.update(schema.sessions)
        .set({ container_id: containerName, updated_at: new Date() })
        .where(eq(schema.sessions.id, sessionId))
        .run();

      // イベント転送
      ptyProcess.onData((data: string) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          if (!session.hasReceivedOutput && data.length > 0) {
            session.hasReceivedOutput = true;

            // 初回出力受信後、遅延リサイズを無条件スケジュール
            // Docker環境ではコンテナ起動のオーバーヘッドにより、クライアントからの
            // resize()がコンテナ起動完了前に到着し効果がない。初回出力後に
            // 保存済みのクライアントサイズでリサイズを再適用する。
            if (!session.shellMode) {
              setTimeout(() => {
                const s = this.sessions.get(sessionId);
                if (s && s.lastKnownCols && s.lastKnownRows) {
                  logger.info('DockerAdapter: Applying deferred resize after first output', {
                    sessionId, cols: s.lastKnownCols, rows: s.lastKnownRows,
                  });
                  s.ptyProcess.resize(s.lastKnownCols, s.lastKnownRows);
                }
              }, 1000);
            }
          }
          if (session.errorBuffer.length < 5000) {
            session.errorBuffer += data;
          }

          // Claude CodeセッションID抽出（シェルモードではスキップ）
          if (!session.shellMode && !session.claudeSessionId) {
            const extracted = this.extractClaudeSessionId(data);
            if (extracted) {
              session.claudeSessionId = extracted;
              this.emit('claudeSessionId', sessionId, extracted);
            }
          }
        }
        scrollbackBuffer.append(sessionId, data);
        this.emit('data', sessionId, data);
      });

      ptyProcess.onExit(async ({ exitCode, signal }) => {
        logger.info('DockerAdapter: Session exited', { sessionId, exitCode, signal });

        const currentSession = this.sessions.get(sessionId);

        // destroySession側で既にクリーンアップ済み（sessionsから削除済み）の場合はスキップ
        if (!currentSession) {
          logger.debug('DockerAdapter: onExit skipped, session already cleaned up by destroySession', { sessionId });
          this.emit('exit', sessionId, { exitCode, signal } as PTYExitInfo);
          return;
        }

        // restartSession()で新セッションが作成された後に旧PTYのonExitが遅延発火した場合、
        // 新セッションを消さないようにptyProcess同一性チェックを行う
        if (currentSession.ptyProcess !== ptyProcess) {
          logger.info('DockerAdapter: Stale onExit ignored (new session exists)', { sessionId });
          // コンテナは停止する（旧コンテナがゾンビにならないように）
          if (containerName && !shellMode) {
            this.stopContainer(containerName);
            // SSH鍵一時ファイルのクリーンアップ
            this.cleanupSSHKeys().catch((error) => {
              logger.error(`Error cleaning up SSH keys in stale onExit:`, error);
            });
          }
          return;
        }

        scrollbackBuffer.clear(sessionId);

        // container_idをクリア
        try {
          db.update(schema.sessions)
            .set({ container_id: null, updated_at: new Date() })
            .where(eq(schema.sessions.id, sessionId))
            .run();
        } catch {
          // セッションが既に削除されている場合は無視
        }

        this.emit('exit', sessionId, { exitCode, signal } as PTYExitInfo);
        this.sessions.delete(sessionId);

        // PTY終了時にコンテナがまだ実行中なら停止
        let containerStopped = true;
        if (containerName && !shellMode) {
          containerStopped = await this.stopContainer(containerName);

          // SSH鍵一時ファイルのクリーンアップ
          try {
            await this.cleanupSSHKeys();
          } catch (error) {
            logger.error(`Error cleaning up SSH keys in onExit:`, error);
          }
        }

        // アクティブセッション参照カウントをデクリメントし、
        // 最後のセッションならネットワークフィルタを解除する
        // （コンテナ停止完了後に実行して無保護ウィンドウを防ぐ）
        if (!shellMode) {
          const envId = this.config.environmentId;
          const currentCount = this.activeSessionCount.get(envId) ?? 0;
          const newCount = Math.max(0, currentCount - 1);
          this.activeSessionCount.set(envId, newCount);
          if (newCount === 0 && containerStopped) {
            try {
              await networkFilterService.removeFilter(envId);
            } catch (filterError) {
              logger.warn('Network filter cleanup failed in onExit', { sessionId, error: filterError });
            }
          } else if (newCount === 0 && !containerStopped) {
            logger.warn('Skip removeFilter in onExit because container stop failed', { sessionId, envId });
          }
        }
      });

      // 初期プロンプト（シェルモードでは送信しない）
      if (initialPrompt && !shellMode && ptyProcess) {
        const pty = ptyProcess;
        setTimeout(() => {
          if (this.sessions.has(sessionId)) {
            pty.write(initialPrompt + '\n');
          }
        }, 3000);
      }

    } catch (error) {
      // Cleanup on failure: remove session entry, kill PTY, remove container
      this.sessions.delete(sessionId);
      scrollbackBuffer.clear(sessionId);
      try { ptyProcess?.kill(); } catch { /* ignore */ }
      try { await container?.remove({ force: true }); } catch { /* ignore */ }
      this.cleanupSSHKeys().catch(() => { /* ignore */ });

      // activeSessionCountをインクリメント後に失敗した場合はロールバックする
      if (activeCountIncremented) {
        const envId = this.config.environmentId;
        const currentCount = this.activeSessionCount.get(envId) ?? 0;
        const newCount = Math.max(0, currentCount - 1);
        this.activeSessionCount.set(envId, newCount);
        // applyFilter成功後に失敗した場合、最後のセッションならフィルタも解除する
        if (filterApplied && newCount === 0) {
          try {
            await networkFilterService.removeFilter(envId);
          } catch (filterError) {
            logger.warn('Network filter cleanup failed in createSession rollback', { sessionId, error: filterError });
          }
        }
      }

      logger.error('DockerAdapter: Failed to create session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        activeSessions: Array.from(this.sessions.keys()),
      });
      if (this.listenerCount('error') > 0) {
        this.emit('error', sessionId, error instanceof Error ? error : new Error('Unknown error'));
      }
      throw error;
    }
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('DockerAdapter: write() called but session not found', { sessionId });
      return;
    }
    session.ptyProcess.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastKnownCols = cols;
    session.lastKnownRows = rows;

    session.ptyProcess.resize(cols, rows);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const { containerId, shellMode } = session;
      logger.info('DockerAdapter: Destroying session', { sessionId, containerId: session.containerId });

      // アクティブセッション参照カウントをデクリメントし、
      // 最後のセッションになったときのみnetworkFilterのルールを削除する
      // shellModeセッションはカウント対象外（createSessionでもインクリメントしていない）
      const envId = this.config.environmentId;
      const shouldDecrement = !shellMode;
      const currentCount = this.activeSessionCount.get(envId) ?? 0;
      const newCount = shouldDecrement ? Math.max(0, currentCount - 1) : currentCount;
      if (shouldDecrement) {
        this.activeSessionCount.set(envId, newCount);
      }

      const shouldRemoveFilter = shouldDecrement && newCount === 0;
      if (!shouldRemoveFilter) {
        logger.debug('DockerAdapter: Skipping removeFilter, other sessions still active', {
          sessionId,
          envId,
          remainingSessionCount: newCount,
        });
      }

      scrollbackBuffer.clear(sessionId);
      // onExitハンドラとの二重クリーンアップを防ぐため、kill前にsessionsから削除する
      // onExit側はsessionsにエントリがなければクリーンアップをスキップする
      this.sessions.delete(sessionId);
      session.ptyProcess.kill();

      // Dockerコンテナを明示的に停止（shellModeではコンテナを止めない）
      let containerStopped = true;
      if (!shellMode) {
        containerStopped = await this.stopContainer(containerId);

        // SSH鍵一時ファイルのクリーンアップ
        try {
          await this.cleanupSSHKeys();
        } catch (error) {
          logger.error(`Error cleaning up SSH keys in destroySession:`, error);
        }
      }

      // コンテナ停止完了後にフィルタを解除（停止前に解除すると無保護ウィンドウが生じる）
      if (shouldRemoveFilter && containerStopped) {
        try {
          await networkFilterService.removeFilter(envId);
        } catch (filterError) {
          logger.warn('Network filter cleanup failed', { sessionId, error: filterError });
        }
      } else if (shouldRemoveFilter && !containerStopped) {
        logger.warn('Skip removeFilter because container stop failed', { sessionId, envId });
      }

      // container_idをクリア（同期実行）
      try {
        db.update(schema.sessions)
          .set({ container_id: null, updated_at: new Date() })
          .where(eq(schema.sessions.id, sessionId))
          .run();
      } catch {
        // 失敗しても無視
      }
    }
  }

  /**
   * リサイズ情報を新セッションに復元する
   */
  private restoreResizeInfo(sessionId: string, cols?: number, rows?: number): void {
    if (!cols || !rows) return;
    try {
      this.resize(sessionId, cols, rows);
      logger.info('DockerAdapter: Restored resize info after restart', {
        sessionId, cols, rows,
      });
    } catch (error) {
      logger.warn('DockerAdapter: Failed to restore resize info after restart', {
        sessionId, cols, rows, error,
      });
    }
  }

  async restartSession(sessionId: string, workingDir?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const { workingDir: wd, containerId, shellMode,
              lastKnownCols, lastKnownRows } = session;
      logger.info('DockerAdapter: Restarting session', { sessionId, shellMode });
      await this.destroySession(sessionId);

      // shellModeセッションはコンテナ停止を待たずに再接続
      if (shellMode) {
        try {
          await this.createSession(sessionId, wd, undefined, { shellMode: true });
          this.restoreResizeInfo(sessionId, lastKnownCols, lastKnownRows);
        } catch (error) {
          logger.error('DockerAdapter: Failed to restart shell session', {
            sessionId, error: error instanceof Error ? error.message : error,
          });
        }
        return;
      }

      // コンテナ停止を待ってから新コンテナ作成
      try {
        await this.waitForContainer(containerId);
        await this.createSession(sessionId, wd);
        this.restoreResizeInfo(sessionId, lastKnownCols, lastKnownRows);
      } catch (error) {
        logger.error('DockerAdapter: Failed to restart session', {
          sessionId, error: error instanceof Error ? error.message : error,
        });
      }
    } else if (workingDir) {
      logger.info('DockerAdapter: Restarting session (from fallback params)', { sessionId });
      setTimeout(() => {
        this.createSession(sessionId, workingDir).catch(() => {});
      }, 500);
    } else {
      logger.warn('DockerAdapter: Cannot restart session: not found and no workingDir', { sessionId });
    }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getWorkingDir(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.workingDir;
  }

  getContainerId(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.containerId;
  }

  protected extractClaudeSessionId(data: string): string | null {
    const patterns = [
      /session[:\s]+([a-zA-Z0-9-]{4,36})/i,
      /\[session:([a-zA-Z0-9-]{4,36})\]/i,
      /Resuming session[:\s]+([a-zA-Z0-9-]{4,36})/i,
    ];
    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * 孤立したDockerコンテナをクリーンアップする（サーバー起動時に実行）
   */
  static async cleanupOrphanedContainers(dbClient: typeof db): Promise<void> {
    logger.info('Checking for orphaned Docker containers');

    try {
      // データベースから全セッションのコンテナIDを取得
      const sessions = dbClient
        .select({
          id: schema.sessions.id,
          container_id: schema.sessions.container_id,
        })
        .from(schema.sessions)
        .where(isNotNull(schema.sessions.container_id))
        .all();

      for (const session of sessions) {
        if (!session.container_id) continue;

        try {
          // コンテナが実行中か確認
          const container = await DockerClient.getInstance().inspectContainer(session.container_id);
          const isRunning = container.State.Running;

          if (!isRunning) {
            logger.warn(
              `Orphaned container detected: ${session.container_id} for session ${session.id}`
            );

            // セッション状態をERRORに更新
            dbClient
              .update(schema.sessions)
              .set({
                status: 'ERROR',
                container_id: null,
                updated_at: new Date(),
              })
              .where(eq(schema.sessions.id, session.id))
              .run();

            // コンテナが存在すれば削除
            try {
              const containerInstance = DockerClient.getInstance().getContainer(session.container_id);
              await containerInstance.remove({ force: true });
              logger.info(`Removed orphaned container ${session.container_id}`);
            } catch (rmError) {
              logger.error(`Failed to remove orphaned container:`, rmError);
            }
          }
        } catch (error) {
          logger.error(
            `Failed to check container ${session.container_id}:`,
            error
          );

          // コンテナが存在しない場合も孤立とみなす
          dbClient
            .update(schema.sessions)
            .set({
              status: 'ERROR',
              container_id: null,
              updated_at: new Date(),
            })
            .where(eq(schema.sessions.id, session.id))
            .run();
        }
      }

      logger.info('Orphaned container cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup orphaned containers:', error);
    }
  }

  /**
   * Docker内でリモートリポジトリをクローン
   */
  async gitClone(options: GitCloneOptions): Promise<GitCloneResult> {
    const { url, targetPath } = options;

    const cmd = ['git', 'clone', url, '/workspace/target'];
    const Binds = [`${targetPath}:/workspace/target`];
    const Env = ['GIT_TERMINAL_PROMPT=0'];

    const sshDir = `${os.homedir()}/.ssh`;
    if (fs.existsSync(sshDir)) {
      Binds.push(`${sshDir}:/home/node/.ssh:ro`);
    }

    if (process.env.SSH_AUTH_SOCK) {
      Binds.push(`${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      Env.push('SSH_AUTH_SOCK=/ssh-agent');
    }

    try {
      const result = await this.runEphemeralContainer(cmd, { Binds, Env });

      if (result.code === 0) {
        return { success: true, path: targetPath };
      } else {
        return { success: false, error: result.stderr };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Docker内でリポジトリを更新（fast-forward only）
   */
  async gitPull(repoPath: string): Promise<GitPullResult> {
    const cmd = ['git', 'pull', '--ff-only'];
    const Binds = [`${repoPath}:/workspace/repo`];
    const Env = ['GIT_TERMINAL_PROMPT=0'];
    const WorkingDir = '/workspace/repo';

    const sshDir = `${os.homedir()}/.ssh`;
    if (fs.existsSync(sshDir)) {
      Binds.push(`${sshDir}:/home/node/.ssh:ro`);
    }

    if (process.env.SSH_AUTH_SOCK) {
      Binds.push(`${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      Env.push('SSH_AUTH_SOCK=/ssh-agent');
    }

    try {
      const result = await this.runEphemeralContainer(cmd, { Binds, Env, WorkingDir });

      if (result.code === 0) {
        const updated = !result.stdout.includes('Already up to date');
        return {
          success: true,
          updated,
          message: result.stdout.trim(),
        };
      } else {
        return {
          success: false,
          updated: false,
          message: '',
          error: result.stderr,
        };
      }
    } catch (error) {
      return {
        success: false,
        updated: false,
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Docker内でブランチ一覧を取得
   */
  async gitGetBranches(repoPath: string): Promise<Branch[]> {
    try {
      const localResult = await this.executeGitCommand(repoPath, ['branch']);
      const localBranches = this.parseLocalBranches(localResult.stdout);

      const remoteResult = await this.executeGitCommand(repoPath, ['branch', '-r']);
      const remoteBranches = this.parseRemoteBranches(remoteResult.stdout);

      const defaultBranch = await this.gitGetDefaultBranch(repoPath);

      const branches: Branch[] = [
        ...localBranches.map(name => ({
          name,
          isDefault: name === defaultBranch,
          isRemote: false,
        })),
        ...remoteBranches.map(name => ({
          name,
          isDefault: false,
          isRemote: true,
        })),
      ];

      return branches;
    } catch (_error) {
      logger.error('Failed to get branches', { repoPath, error: _error });
      return [];
    }
  }

  /**
   * Docker内でデフォルトブランチを取得
   */
  async gitGetDefaultBranch(repoPath: string): Promise<string> {
    try {
      const result = await this.executeGitCommand(repoPath, [
        'symbolic-ref',
        'refs/remotes/origin/HEAD',
      ]);

      const match = result.stdout.trim().match(/refs\/remotes\/origin\/(.+)/);
      return match ? match[1] : 'main';
    } catch {
      logger.warn('Could not determine default branch, using main', { repoPath });
      return 'main';
    }
  }

  /**
   * Git操作用のヘルパーメソッド
   */
  private async executeGitCommand(
    repoPath: string,
    gitArgs: string[]
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const cmd = ['git', ...gitArgs];
    const Binds = [`${repoPath}:/workspace/repo`];
    const Env = ['GIT_TERMINAL_PROMPT=0'];
    const WorkingDir = '/workspace/repo';

    const sshDir = `${os.homedir()}/.ssh`;
    if (fs.existsSync(sshDir)) {
      Binds.push(`${sshDir}:/home/node/.ssh:ro`);
    }

    if (process.env.SSH_AUTH_SOCK) {
      Binds.push(`${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      Env.push('SSH_AUTH_SOCK=/ssh-agent');
    }

    return this.runEphemeralContainer(cmd, { Binds, Env, WorkingDir });
  }

  private async runEphemeralContainer(
    cmd: string[],
    options: { Binds?: string[]; Env?: string[]; WorkingDir?: string }
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    let stdout = '';
    let stderr = '';

    const stdoutStream = new Writable({
      write(chunk, encoding, callback) {
        stdout += chunk.toString();
        callback();
      }
    });

    const stderrStream = new Writable({
      write(chunk, encoding, callback) {
        stderr += chunk.toString();
        callback();
      }
    });

    try {
      const data = await DockerClient.getInstance().run(
        `${this.config.imageName}:${this.config.imageTag}`,
        cmd,
        [stdoutStream, stderrStream] as any,
        {
          HostConfig: {
            Binds: options.Binds,
            AutoRemove: true,
          },
          Env: options.Env,
          WorkingDir: options.WorkingDir,
        }
      );

      return { code: data.StatusCode, stdout, stderr };
    } catch (error: any) {
      logger.error('Failed to run ephemeral container', { error: error.message });
      return { code: 1, stdout, stderr: error.message };
    }
  }

  private parseLocalBranches(output: string): string[] {
    return output
      .split('\n')
      .map(line => line.trim().replace(/^\* /, ''))
      .filter(line => line.length > 0);
  }

  private parseRemoteBranches(output: string): string[] {
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.includes('HEAD ->'));
  }

  /**
   * Docker環境への開発ツール設定自動適用
   * Git設定とSSH鍵をコンテナに注入する
   */
  async injectDeveloperSettings(projectId: string, containerId: string): Promise<void> {
    logger.info('Injecting developer settings', { projectId, containerId });

    try {
      // 1. Git設定を適用
      await this.applyGitConfig(projectId, containerId);

      // 2. SSH鍵を適用
      await this.applySSHKeys(containerId);

      logger.info('Developer settings injected successfully', { projectId, containerId });
    } catch (error) {
      logger.error('Failed to inject developer settings', {
        projectId,
        containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Git設定をdocker execで適用
   */
  private async applyGitConfig(projectId: string, containerId: string): Promise<void> {
    try {
      const settings = await this.developerSettingsService.getEffectiveSettings(projectId);

      if (!settings.git_username && !settings.git_email) {
        logger.warn('No Git settings configured, skipping git config', { projectId });
        return;
      }

      const container = DockerClient.getInstance().getContainer(containerId);

      // コンテナの実行ユーザーと同じコンテキストでgit configを実行
      if (settings.git_username) {
        const exec = await container.exec({
          Cmd: ['git', 'config', '--global', 'user.name', settings.git_username],
          User: 'node',
        });
        await exec.start({});
        logger.debug('Applied git user.name', { username: settings.git_username });
      }

      if (settings.git_email) {
        const exec = await container.exec({
          Cmd: ['git', 'config', '--global', 'user.email', settings.git_email],
          User: 'node',
        });
        await exec.start({});
        logger.debug('Applied git user.email', { email: settings.git_email });
      }

      logger.info('Git config applied successfully', { projectId, containerId });
    } catch (error) {
      logger.error('Failed to apply git config', {
        projectId,
        containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Git設定の失敗は致命的ではないため、エラーをログに記録して続行
    }
  }

  /**
   * SSH鍵をコンテナに適用
   */
  private async applySSHKeys(containerId: string): Promise<void> {
    let useTempDir = false;
    let sshDir = '';
    try {
      // SSH鍵一覧を取得
      const keys = await this.getAllSSHKeys();

      if (keys.length === 0) {
        logger.debug('No SSH keys configured, skipping SSH key setup');
        return;
      }

      // named volumeモードではOS一時領域を使用
      useTempDir = !this.config.authDirPath;
      sshDir = useTempDir
        ? await fsPromises.mkdtemp(path.join(os.tmpdir(), 'claude-ssh-'))
        : path.join(this.config.authDirPath!, 'ssh');
      await fsPromises.mkdir(sshDir, { recursive: true });

      const keyPaths: string[] = [];
      const successfulKeyNames: string[] = [];

      for (const key of keys) {
        try {
          // 秘密鍵を復号化
          const privateKey = await this.encryptionService.decrypt(key.private_key_encrypted);

          // パストラバーサル対策: 安全なファイル名に変換
          const safeKeyName = key.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          const safeName = path.basename(safeKeyName);

          // ファイルパス
          const privateKeyPath = path.join(sshDir, `id_${safeName}`);
          const publicKeyPath = `${privateKeyPath}.pub`;

          // ファイルに書き込み
          await fsPromises.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
          await fsPromises.writeFile(publicKeyPath, key.public_key, { mode: 0o644 });

          keyPaths.push(privateKeyPath);
          successfulKeyNames.push(safeName);

          logger.debug('SSH key files created', { keyName: key.name });
        } catch (error) {
          logger.error('Failed to process SSH key, skipping', {
            keyName: key.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (keyPaths.length === 0) {
        logger.warn('No SSH keys were successfully processed');
        return;
      }

      // SSH config を生成
      const sshConfig = this.generateSSHConfig(successfulKeyNames);
      const sshConfigPath = path.join(sshDir, 'config');
      await fsPromises.writeFile(sshConfigPath, sshConfig, { mode: 0o644 });

      const container = DockerClient.getInstance().getContainer(containerId);

      // コンテナ内の /home/node/.ssh/ ディレクトリを作成
      const execMkdir = await container.exec({
        Cmd: ['mkdir', '-p', '/home/node/.ssh'],
        User: 'node',
      });
      await execMkdir.start({});

      const execChmod = await container.exec({
        Cmd: ['chmod', '700', '/home/node/.ssh'],
        User: 'node',
      });
      await execChmod.start({});

      // tarストリームを作成してコンテナにコピー (putArchive)
      // sshDirの内容を /home/node/.ssh に展開
      const tarStream = tar.pack(sshDir);
      try {
        await container.putArchive(tarStream, {
          path: '/home/node/.ssh',
          noOverwriteDirNonDir: false,
        });
      } finally {
        tarStream.destroy();
      }

      // 所有権の修正（putArchiveはrootで展開される可能性があるため）
      const execChown = await container.exec({
        Cmd: ['chown', '-R', 'node:node', '/home/node/.ssh'],
        User: 'root', // rootで実行して所有権変更
      });
      await execChown.start({});

      logger.info('SSH keys applied successfully', { keyCount: keyPaths.length });
    } catch (error) {
      logger.error('Failed to apply SSH keys', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // SSH鍵の失敗は致命的ではないため、エラーをログに記録して続行
    } finally {
      // named volumeモードの一時ディレクトリを確実にクリーンアップ
      if (useTempDir && sshDir) {
        try {
          await fsPromises.rm(sshDir, { recursive: true, force: true });
        } catch {
          // クリーンアップ失敗は無視
        }
      }
    }
  }

  /**
   * SSH config ファイルの内容を生成
   */
  private generateSSHConfig(keyNames: string[]): string {
    const identityFiles = keyNames.map(name => `  IdentityFile /home/node/.ssh/id_${name}`).join('\n');

    return `Host *
  StrictHostKeyChecking accept-new
${identityFiles}
`;
  }

  /**
   * すべてのSSH鍵を取得
   */
  private async getAllSSHKeys(): Promise<SshKey[]> {
    const records = db
      .select()
      .from(schema.sshKeys)
      .all();

    return records as SshKey[];
  }

  /**
   * SSH鍵一時ファイルをクリーンアップ
   */
  async cleanupSSHKeys(): Promise<void> {
    try {
      if (!this.config.authDirPath) {
        // named volumeモードでは一時ディレクトリはapplySSHKeys内で既にクリーンアップ済み
        logger.debug('SSH key cleanup skipped (named volume mode, temp dir already cleaned)');
        return;
      }
      const sshDir = path.join(this.config.authDirPath, 'ssh');
      const files = await fsPromises.readdir(sshDir);

      for (const file of files) {
        const filePath = path.join(sshDir, file);
        await fsPromises.unlink(filePath);
      }

      logger.info('SSH keys cleaned up', { sshDir });
    } catch (error) {
      logger.error('Failed to cleanup SSH keys', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
