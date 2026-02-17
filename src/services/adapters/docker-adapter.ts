import type { IPty } from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import type { CreateSessionOptions, PTYExitInfo } from '../environment-adapter';
import { ClaudeOptionsService } from '../claude-options-service';
import { scrollbackBuffer } from '../scrollback-buffer';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { BasePTYAdapter } from './base-adapter';

export interface DockerAdapterConfig {
  environmentId: string;
  imageName: string;
  imageTag: string;
  authDirPath: string; // 環境専用認証ディレクトリ（絶対パス）
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

  constructor(config: DockerAdapterConfig) {
    super();
    this.config = config;
    logger.info('DockerAdapter initialized', {
      environmentId: config.environmentId,
      imageName: config.imageName,
      imageTag: config.imageTag,
    });
  }

  /**
   * Docker実行引数を構築（環境専用認証ディレクトリを使用）
   */
  private buildDockerArgs(workingDir: string, options?: CreateSessionOptions): { args: string[]; containerName: string; envFilePath?: string } {
    const args: string[] = ['run', '-it', '--rm'];

    // コンテナ名（環境ID + タイムスタンプで一意に）
    const containerName = `claude-env-${this.config.environmentId.substring(0, 8)}-${Date.now()}`;
    args.push('--name', containerName);

    // セキュリティ
    args.push('--cap-drop', 'ALL');
    args.push('--security-opt', 'no-new-privileges');

    // ワークスペース（RW）
    args.push('-v', `${workingDir}:/workspace`);

    // 環境専用認証ディレクトリ（RW）
    const claudeDir = path.join(this.config.authDirPath, 'claude');
    const claudeConfigDir = path.join(this.config.authDirPath, 'config', 'claude');

    args.push('-v', `${claudeDir}:/home/node/.claude`);
    args.push('-v', `${claudeConfigDir}:/home/node/.config/claude`);

    // Git認証情報（RO）- ホストから共有
    const homeDir = os.homedir();
    const sshDir = path.join(homeDir, '.ssh');
    if (fs.existsSync(sshDir)) {
      args.push('-v', `${sshDir}:/home/node/.ssh:ro`);
    }
    const gitconfigPath = path.join(homeDir, '.gitconfig');
    if (fs.existsSync(gitconfigPath)) {
      args.push('-v', `${gitconfigPath}:/home/node/.gitconfig:ro`);
    }

    // SSH Agent転送
    const sshAuthSock = process.env.SSH_AUTH_SOCK;
    if (sshAuthSock) {
      args.push('-v', `${sshAuthSock}:/ssh-agent`);
      args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
    }

    // ANTHROPIC_API_KEY転送（キー名のみ指定でホスト環境変数から継承）
    if (process.env.ANTHROPIC_API_KEY) {
      args.push('-e', 'ANTHROPIC_API_KEY');
    }

    // カスタム環境変数を一時envファイル経由で渡す（値をプロセス引数に載せない）
    let envFilePath: string | undefined;
    if (!options?.shellMode && options?.customEnvVars) {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(options.customEnvVars)) {
        if (ClaudeOptionsService.validateEnvVarKey(key) && typeof value === 'string') {
          lines.push(`${key}=${value}`);
        }
      }
      if (lines.length > 0) {
        envFilePath = path.join(os.tmpdir(), `claude-env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        fs.writeFileSync(envFilePath, lines.join('\n'), { mode: 0o600 });
        args.push('--env-file', envFilePath);
        // ログには環境変数のKEYのみ出力、VALUEは出力しない
        logger.info('DockerAdapter: Custom environment variables applied', {
          keys: Object.keys(options.customEnvVars),
        });
      }
    }

    // シェルモードの場合は/bin/sh、それ以外はclaude
    const entrypoint = options?.shellMode ? '/bin/sh' : 'claude';
    args.push('--entrypoint', entrypoint);

    // イメージ
    args.push(`${this.config.imageName}:${this.config.imageTag}`);

    // claudeコマンドの引数（--entrypoint使用時はイメージ名の後に引数を指定）
    // シェルモードでは--resumeフラグは不要
    if (!options?.shellMode && options?.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    // カスタムCLIオプション（シェルモードではスキップ）
    if (!options?.shellMode && options?.claudeCodeOptions) {
      const customArgs = ClaudeOptionsService.buildCliArgs(options.claudeCodeOptions);
      args.push(...customArgs);
      // ログにはフラグ名のみを出力し、値は出力しない（機密情報対策）
      // --flag value 形式: フラグは残し、値は[REDACTED]に
      // --flag=value 形式: =以降を[REDACTED]に
      const safeArgs = customArgs.map((arg) => {
        if (!arg.startsWith('-')) return '[REDACTED]';
        const eqIndex = arg.indexOf('=');
        return eqIndex === -1 ? arg : `${arg.slice(0, eqIndex)}=[REDACTED]`;
      });
      logger.info('DockerAdapter: Custom CLI options applied', {
        args: safeArgs,
      });
    }

    return { args, containerName, envFilePath };
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
   * Dockerコンテナが実際に存在し、実行中かを確認
   */
  private async isContainerRunning(containerName: string): Promise<boolean> {
    const execFileAsync = promisify(childProcess.execFile);
    try {
      const { stdout } = await execFileAsync('docker', ['inspect', '--format', '{{.State.Running}}', containerName], {
        timeout: 5000,
      });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Dockerコンテナが完全に起動するまで待機
   */
  private async waitForContainerReady(containerId: string): Promise<void> {
    const execFileAsync = promisify(childProcess.execFile);
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
        const { stdout } = await execFileAsync(
          'docker',
          ['inspect', '--format', '{{.State.Running}}', containerId],
          { timeout: 5000 }
        );

        const isRunning = stdout.trim() === 'true';

        if (isRunning) {
          // 追加のヘルスチェック（コンテナ内でコマンドを実行）
          try {
            await execFileAsync(
              'docker',
              ['exec', containerId, 'echo', 'health-check'],
              { timeout: 2000 }
            );

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
   * Dockerコンテナを停止する（Promise化、エラーハンドリング強化）
   */
  private async stopContainer(containerName: string): Promise<void> {
    const execFileAsync = promisify(childProcess.execFile);
    logger.info(`Stopping container ${containerName}`);

    try {
      // 10秒のタイムアウトで停止を試行
      await execFileAsync('docker', ['stop', '-t', '10', containerName], {
        timeout: 15000, // 15秒（猶予を含む）
      });

      logger.info(`Container ${containerName} stopped successfully`);
    } catch (error: any) {
      // コンテナが既に停止している場合はエラーを無視
      if (
        error.message &&
        (error.message.includes('No such container') ||
          error.message.includes('is not running'))
      ) {
        logger.debug(`Container ${containerName} already stopped`);
        return;
      }

      logger.error(`Failed to stop container ${containerName}:`, error);

      // 強制停止を試行
      try {
        await execFileAsync('docker', ['kill', containerName], {
          timeout: 5000,
        });
        logger.warn(`Container ${containerName} force-killed`);
      } catch (killError) {
        logger.error(`Failed to force-kill container ${containerName}:`, killError);
      }

      // エラーをログに記録するが、スローはしない（後続処理を継続）
    }
  }

  /**
   * コンテナ停止を待つPromiseを返す
   */
  private waitForContainer(containerName: string): Promise<void> {
    return new Promise<void>((resolve) => {
      childProcess.execFile('docker', ['wait', containerName], { timeout: 5000 }, () => {
        // タイムアウトやエラーでも続行
        resolve();
      });
    });
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
    // -it オプションでインタラクティブモードとTTYを有効化
    // -w オプションで作業ディレクトリを /workspace に設定
    const args = ['exec', '-it', '-w', '/workspace', containerName, 'bash'];

    logger.info('DockerAdapter: Creating exec session (attaching to existing container)', {
      sessionId,
      containerName,
      workingDir,
      cols,
      rows,
    });

    try {
      const ptyProcess = this.spawnPTY('docker', args, {
        cols,
        rows,
        env: {},
      });

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

    const { args, containerName, envFilePath } = this.buildDockerArgs(workingDir, options);

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

    try {
      const ptyProcess = this.spawnPTY('docker', args, {
        cols: initialCols,
        rows: initialRows,
        cwd: undefined,
        env: {},
      });

      this.sessions.set(sessionId, {
        ptyProcess,
        workingDir,
        containerId: containerName,
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
        lastKnownCols: initialCols,
        lastKnownRows: initialRows,
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
            // 注意: lastKnownCols/Rowsはこの時点で未設定の場合がある
            // （WebSocketメッセージ競合やrestart時）。チェックはコールバック内で行う。
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

        // 一時envファイルのクリーンアップ
        if (envFilePath) {
          try { fs.unlinkSync(envFilePath); } catch { /* ignore */ }
        }

        // restartSession()で新セッションが作成された後に旧PTYのonExitが遅延発火した場合、
        // 新セッションを消さないようにptyProcess同一性チェックを行う
        const currentSession = this.sessions.get(sessionId);
        if (currentSession && currentSession.ptyProcess !== ptyProcess) {
          logger.info('DockerAdapter: Stale onExit ignored (new session exists)', { sessionId });
          // コンテナは停止する（旧コンテナがゾンビにならないように）
          if (containerName && !shellMode) {
            this.stopContainer(containerName);
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
        if (containerName && !shellMode) {
          this.stopContainer(containerName).catch((error) => {
            logger.error(`Error stopping container in onExit:`, error);
          });
        }
      });

      // 初期プロンプト（シェルモードでは送信しない）
      if (initialPrompt && !shellMode) {
        setTimeout(() => {
          if (this.sessions.has(sessionId)) {
            ptyProcess.write(initialPrompt + '\n');
          }
        }, 3000);
      }

      // 一時envファイルのクリーンアップ（成功時）
      if (envFilePath) {
        try {
          fs.unlinkSync(envFilePath);
        } catch {
          // 削除失敗は無視
        }
      }

    } catch (error) {
      // 一時envファイルのクリーンアップ
      if (envFilePath) {
        try {
          fs.unlinkSync(envFilePath);
        } catch {
          // 削除失敗は無視
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
      scrollbackBuffer.clear(sessionId);
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);

      // Dockerコンテナを明示的に停止（shellModeではコンテナを止めない）
      if (!shellMode) {
        try {
          await this.stopContainer(containerId);
        } catch (error) {
          logger.error(`Error stopping container in destroySession:`, error);
        }
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
  static async cleanupOrphanedContainers(prismaClient: typeof db): Promise<void> {
    logger.info('Checking for orphaned Docker containers');
    const execFileAsync = promisify(childProcess.execFile);

    try {
      // データベースから全セッションのコンテナIDを取得
      const sessions = prismaClient
        .select({
          id: schema.sessions.id,
          container_id: schema.sessions.container_id,
        })
        .from(schema.sessions)
        .where(
          eq(schema.sessions.container_id, schema.sessions.container_id)
        )
        .all()
        .filter((s) => s.container_id !== null);

      for (const session of sessions) {
        if (!session.container_id) continue;

        try {
          // コンテナが実行中か確認
          const { stdout } = await execFileAsync('docker', [
            'inspect',
            '--format',
            '{{.State.Running}}',
            session.container_id,
          ]);

          const isRunning = stdout.trim() === 'true';

          if (!isRunning) {
            logger.warn(
              `Orphaned container detected: ${session.container_id} for session ${session.id}`
            );

            // セッション状態をERRORに更新
            prismaClient
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
              await execFileAsync('docker', ['rm', '-f', session.container_id]);
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
          prismaClient
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

    try {
      const args = [
        'run', '--rm',
        '-v', `${targetPath}:/workspace/target`,
        '-v', `${os.homedir()}/.ssh:/home/node/.ssh:ro`,
      ];

      if (process.env.SSH_AUTH_SOCK) {
        args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
        args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
      }

      args.push('-e', 'GIT_TERMINAL_PROMPT=0');
      args.push(this.config.imageName + ':' + this.config.imageTag);
      args.push('git', 'clone', url, '/workspace/target');

      const result = await this.executeDockerCommand(args);

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
    try {
      const args = [
        'run', '--rm',
        '-v', `${repoPath}:/workspace/repo`,
        '-v', `${os.homedir()}/.ssh:/home/node/.ssh:ro`,
      ];

      if (process.env.SSH_AUTH_SOCK) {
        args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
        args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
      }

      args.push('-e', 'GIT_TERMINAL_PROMPT=0');
      args.push('-w', '/workspace/repo');
      args.push(this.config.imageName + ':' + this.config.imageTag);
      args.push('git', 'pull', '--ff-only');

      const result = await this.executeDockerCommand(args);

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
    const args = [
      'run', '--rm',
      '-v', `${repoPath}:/workspace/repo`,
      '-v', `${os.homedir()}/.ssh:/root/.ssh:ro`,
    ];

    if (process.env.SSH_AUTH_SOCK) {
      args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
    }

    args.push('-e', 'GIT_TERMINAL_PROMPT=0');
    args.push('-w', '/workspace/repo');
    args.push(this.config.imageName + ':' + this.config.imageTag);
    args.push('git', ...gitArgs);

    return this.executeDockerCommand(args);
  }

  private async executeDockerCommand(
    args: string[]
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = childProcess.spawn('docker', args);
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });

      proc.on('error', (error) => {
        resolve({ code: 1, stdout, stderr: error.message });
      });
    });
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
}
