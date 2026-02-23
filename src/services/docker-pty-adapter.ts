import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from '@/lib/logger';
import { DockerError } from './docker-service';
import { ClaudeOptionsService } from './claude-options-service';
import type { ClaudeCodeOptions, CustomEnvVars } from './claude-options-service';
import { DockerClient } from './docker-client';
import { DockerPTYStream } from './docker-pty-stream';
import Docker from 'dockerode';

/**
 * Dockerコンテナ起動エラーを解析してDockerErrorを生成
 */
function parseContainerStartError(errorOutput: string): DockerError | null {
  // イメージが見つからない
  if (errorOutput.includes('Unable to find image') || errorOutput.includes('No such image')) {
    return new DockerError(
      'DOCKER_IMAGE_NOT_FOUND',
      'Docker image not found',
      'Dockerイメージが見つかりません',
      '使用している設定に合わせて Docker イメージをビルドしてください（例: docker build -t <image-name>:<tag> docker/）'
    );
  }

  // 権限エラー
  if (errorOutput.includes('permission denied')) {
    return new DockerError(
      'DOCKER_PERMISSION_DENIED',
      'Docker permission denied',
      'Dockerの実行権限がありません',
      'ユーザーをdockerグループに追加するか、管理者権限で実行してください'
    );
  }

  // デーモン接続エラー
  if (errorOutput.includes('Cannot connect to the Docker daemon') ||
      errorOutput.includes('Is the docker daemon running')) {
    return new DockerError(
      'DOCKER_DAEMON_NOT_RUNNING',
      'Docker daemon not running',
      'Dockerデーモンが起動していません',
      'Docker Desktopを起動するか、sudo systemctl start docker を実行してください'
    );
  }

  // ポート競合
  if (errorOutput.includes('port is already allocated')) {
    return new DockerError(
      'DOCKER_CONTAINER_START_FAILED',
      'Port already in use',
      'ポートが既に使用されています',
      '同じポートを使用している他のコンテナを停止してください'
    );
  }

  // ボリュームマウントエラー
  if (errorOutput.includes('Mounts denied') || errorOutput.includes('invalid mount config')) {
    return new DockerError(
      'DOCKER_CONTAINER_START_FAILED',
      'Volume mount error',
      'ボリュームのマウントに失敗しました',
      'マウント先のパスが存在することを確認し、Docker Desktopの設定でファイル共有を許可してください'
    );
  }

  return null;
}

/**
 * DockerPTYAdapter設定
 */
export interface DockerPTYAdapterConfig {
  /** イメージ名（デフォルト: claude-code-sandboxed） */
  imageName?: string;
  /** イメージタグ（デフォルト: latest） */
  imageTag?: string;
}

/**
 * Docker PTYセッション作成オプション
 */
export interface CreateDockerPTYSessionOptions {
  resumeSessionId?: string; // Claude Codeの--resume用セッションID
  claudeCodeOptions?: ClaudeCodeOptions; // Claude Code CLIオプション
  customEnvVars?: CustomEnvVars; // カスタム環境変数
}

/**
 * Docker PTYセッション情報
 */
interface DockerPTYSession {
  ptyProcess: pty.IPty;
  sessionId: string;
  workingDir: string;
  initialPrompt?: string;
  containerId?: string; // DockerコンテナID
  claudeSessionId?: string; // Claude Codeが出力するセッションID
  errorBuffer: string; // エラー出力バッファ（診断用）
  hasReceivedOutput: boolean; // 正常な出力を受信したかどうか
}

/**
 * PTYプロセス終了情報
 */
export interface DockerPTYExitInfo {
  exitCode: number;
  signal?: number;
}

/**
 * DockerPTYAdapter
 *
 * Docker内でClaude Codeを実行するためのPTYアダプター。
 * ClaudePTYManagerと同じインターフェースを提供し、透過的に置き換え可能。
 *
 * イベント:
 * - 'data': PTYからの出力 (sessionId: string, data: string)
 * - 'exit': PTYプロセス終了 (sessionId: string, info: DockerPTYExitInfo)
 * - 'error': エラー発生 (sessionId: string, error: Error)
 * - 'claudeSessionId': Claude CodeセッションID抽出 (sessionId: string, claudeSessionId: string)
 */
export class DockerPTYAdapter extends EventEmitter {
  private sessions: Map<string, DockerPTYSession> = new Map();
  private creating: Set<string> = new Set();
  private imageName: string;
  private imageTag: string;

  constructor(config?: DockerPTYAdapterConfig) {
    super();
    this.imageName = config?.imageName || process.env.DOCKER_IMAGE_NAME || 'claude-code-sandboxed';
    this.imageTag = config?.imageTag || process.env.DOCKER_IMAGE_TAG || 'latest';
  }

  /**
   * イメージ名を取得
   */
  getImageName(): string {
    return this.imageName;
  }

  /**
   * イメージタグを取得
   */
  getImageTag(): string {
    return this.imageTag;
  }

  /**
   * 完全なイメージ名を取得
   */
  getFullImageName(): string {
    return `${this.imageName}:${this.imageTag}`;
  }

  /**
   * Constructs Dockerode container options from session parameters.
   */
  private buildContainerOptions(
    workingDir: string,
    options?: CreateDockerPTYSessionOptions
  ): {
    createOptions: Docker.ContainerCreateOptions;
    containerName: string;
  } {
    const containerName = `claude-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const Binds: string[] = [];
    const Env: string[] = ['TERM=xterm-256color', 'COLORTERM=truecolor'];
    const Cmd: string[] = ['claude'];

    // Workspace mount
    Binds.push(`${workingDir}:/workspace`);

    // Claude auth dirs
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, '.claude');
    if (fs.existsSync(claudeDir)) {
      Binds.push(`${claudeDir}:/home/node/.claude`);
    }
    const claudeConfigDir = path.join(homeDir, '.config', 'claude');
    if (fs.existsSync(claudeConfigDir)) {
      Binds.push(`${claudeConfigDir}:/home/node/.config/claude`);
    }

    // Git auth (RO)
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

    // ANTHROPIC_API_KEY
    if (process.env.ANTHROPIC_API_KEY) {
      Env.push(`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);
    }

    // Custom Env Vars
    // Filter out TERM/COLORTERM to avoid duplicating the values already set above
    if (options?.customEnvVars) {
      const reservedKeys = new Set(['TERM', 'COLORTERM']);
      for (const [key, value] of Object.entries(options.customEnvVars)) {
        if (reservedKeys.has(key)) {
          logger.debug('DockerPTYAdapter: Skipping reserved env var from customEnvVars', { key });
          continue;
        }
        if (ClaudeOptionsService.validateEnvVarKey(key) && typeof value === 'string') {
          Env.push(`${key}=${value}`);
        }
      }
    }

    // Arguments
    if (options?.resumeSessionId) {
      Cmd.push('--resume', options.resumeSessionId);
    }

    // Custom CLI options
    if (options?.claudeCodeOptions) {
      const customArgs = ClaudeOptionsService.buildCliArgs(options.claudeCodeOptions);
      Cmd.push(...customArgs);
    }

    const createOptions: Docker.ContainerCreateOptions = {
      name: containerName,
      Image: this.getFullImageName(),
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Env,
      Cmd,
      WorkingDir: '/workspace',
      HostConfig: {
        Binds,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        AutoRemove: true,
      },
    };

    return { createOptions, containerName };
  }

  /**
   * Dockerコンテナ内でClaude Codeを起動
   *
   * @param sessionId - セッションID
   * @param workingDir - 作業ディレクトリ（worktreeパス）
   * @param initialPrompt - 初期プロンプト（任意）
   * @param options - 追加オプション（resumeSessionIdなど）
   */
  async createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateDockerPTYSessionOptions
  ): Promise<void> {
    // 作成中のセッションがある場合はエラー
    if (this.creating.has(sessionId)) {
      throw new Error(`Docker PTY creation already in progress for session ${sessionId}`);
    }

    // 既存のセッションがあればクリーンアップ
    if (this.sessions.has(sessionId)) {
      this.destroySession(sessionId);
    }

    // 作成中フラグを立てる
    this.creating.add(sessionId);

    // workingDirの検証
    const resolvedCwd = path.resolve(workingDir);
    let st: fs.Stats;
    try {
      st = fs.statSync(resolvedCwd);
    } catch {
      this.creating.delete(sessionId);
      throw new Error(`workingDir does not exist: ${resolvedCwd}`);
    }
    if (!st.isDirectory()) {
      this.creating.delete(sessionId);
      throw new Error(`workingDir is not a directory: ${resolvedCwd}`);
    }

    let container: Docker.Container | undefined;
    let ptyProcess: DockerPTYStream | undefined;
    try {
      const { createOptions, containerName } = this.buildContainerOptions(resolvedCwd, options);

      logger.info('Creating Docker PTY session', {
        sessionId,
        workingDir: resolvedCwd,
        image: this.getFullImageName(),
        containerName,
        resumeSessionId: options?.resumeSessionId,
      });

      container = await DockerClient.getInstance().createContainer(createOptions);

      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
        hijack: true,
      });

      ptyProcess = new DockerPTYStream({
        cols: 80,
        rows: 24,
        isContainer: true,
        container: container,
      });
      ptyProcess.setStream(stream);

      await container.start();

      // セッションを登録
      this.sessions.set(sessionId, {
        ptyProcess,
        sessionId,
        workingDir: resolvedCwd,
        initialPrompt,
        containerId: containerName, // コンテナ名をcontainerIdとして保存
        errorBuffer: '',
        hasReceivedOutput: false,
      });
      // 作成完了フラグをクリア
      this.creating.delete(sessionId);

      // PTY出力をイベントとして発火
      ptyProcess.onData((data: string) => {
        this.emit('data', sessionId, data);

        const session = this.sessions.get(sessionId);
        if (session) {
          // 出力を受信したことを記録（エラー判定用）
          if (!session.hasReceivedOutput && data.length > 0) {
            session.hasReceivedOutput = true;
          }

          // エラー出力をバッファリング（最初の5KB）
          if (session.errorBuffer.length < 5000) {
            session.errorBuffer += data;
          }

          // セッションIDの抽出
          if (!session.claudeSessionId) {
            const extractedId = this.extractClaudeSessionId(data);
            if (extractedId) {
              session.claudeSessionId = extractedId;
              logger.info('Claude session ID extracted from Docker', {
                sessionId,
                claudeSessionId: extractedId,
              });
              this.emit('claudeSessionId', sessionId, extractedId);
            }
          }
        }
      });

      // PTY終了時の処理
      ptyProcess.onExit(({ exitCode, signal }) => {
        const session = this.sessions.get(sessionId);
        logger.info('Docker PTY exited', { sessionId, exitCode, signal });

        // 異常終了時にエラー解析
        if (exitCode !== 0 && session) {
          const dockerError = parseContainerStartError(session.errorBuffer);
          if (dockerError) {
            logger.error('Docker container startup error detected', {
              sessionId,
              errorType: dockerError.errorType,
              userMessage: dockerError.userMessage,
            });
            this.emit('error', sessionId, dockerError);
          } else if (!session.hasReceivedOutput) {
            // 出力を受け取る前に終了した場合は起動失敗
            const startupError = new DockerError(
              'DOCKER_CONTAINER_START_FAILED',
              'Container failed to start',
              'Dockerコンテナの起動に失敗しました',
              'docker logs コマンドで詳細なエラーを確認してください'
            );
            this.emit('error', sessionId, startupError);
          }
        }

        this.emit('exit', sessionId, { exitCode, signal });
        this.sessions.delete(sessionId);
      });

      // 初期プロンプトがあれば送信（起動を待ってから）
      if (initialPrompt) {
        logger.info('Initial prompt will be sent after delay', {
          sessionId,
          promptLength: initialPrompt.length,
        });
        const ptyRef = ptyProcess;
        setTimeout(() => {
          if (this.sessions.has(sessionId)) {
            logger.info('Sending initial prompt to Docker Claude Code', {
              sessionId,
              promptPreview: initialPrompt.substring(0, 100),
            });
            ptyRef.write(initialPrompt + '\n');
          } else {
            logger.warn('Docker session no longer exists, skipping initial prompt', { sessionId });
          }
        }, 3000);
      }

      logger.info('Docker PTY session created', { sessionId });
    } catch (error) {
      // Cleanup on failure: remove session entry, kill PTY, remove container
      this.sessions.delete(sessionId);
      this.creating.delete(sessionId);
      try { ptyProcess?.kill(); } catch { /* ignore */ }
      try { await container?.remove({ force: true }); } catch { /* ignore */ }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create Docker PTY session', { sessionId, error: errorMessage });
      this.emit('error', sessionId, new Error(`Failed to spawn Docker process: ${errorMessage}`));
      throw new Error(
        `Failed to spawn Docker process for session ${sessionId}: ${errorMessage}`
      );
    }
  }

  /**
   * PTYに入力を送信
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.write(data);
    }
  }

  /**
   * PTYのサイズを変更
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * セッションを終了
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('Destroying Docker PTY session', { sessionId });
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * セッションを再起動
   */
  async restartSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const { workingDir, initialPrompt } = session;
      logger.info('Restarting Docker PTY session', { sessionId });
      this.destroySession(sessionId);
      // Wait briefly for container cleanup before recreating
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.createSession(sessionId, workingDir, initialPrompt);
    }
  }

  /**
   * セッションが存在するか確認
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * セッションの作業ディレクトリを取得
   */
  getWorkingDir(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.workingDir;
  }

  /**
   * コンテナIDを取得
   */
  getContainerId(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.containerId;
  }

  /**
   * Claude CodeセッションIDを取得
   */
  getClaudeSessionId(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.claudeSessionId;
  }

  /**
   * Claude Code出力からセッションIDを抽出
   */
  private extractClaudeSessionId(data: string): string | undefined {
    // 正規表現リテラルを使用（ReDoS対策のため変数から構築しない）
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

    return undefined;
  }
}

/**
 * グローバルDocker PTYアダプターインスタンス
 */
export const dockerPtyAdapter = new DockerPTYAdapter();
