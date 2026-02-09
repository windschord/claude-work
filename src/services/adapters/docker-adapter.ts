import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { EnvironmentAdapter, CreateSessionOptions, PTYExitInfo } from '../environment-adapter';
import { scrollbackBuffer } from '../scrollback-buffer';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface DockerAdapterConfig {
  environmentId: string;
  imageName: string;
  imageTag: string;
  authDirPath: string; // 環境専用認証ディレクトリ（絶対パス）
}

interface DockerSession {
  ptyProcess: pty.IPty;
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
export class DockerAdapter extends EventEmitter implements EnvironmentAdapter {
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
  private buildDockerArgs(workingDir: string, options?: CreateSessionOptions): { args: string[]; containerName: string } {
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

    return { args, containerName };
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
    const execFileAsync = promisify(execFile);
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
   * docker exec でシェルセッションを作成
   */
  private async createExecSession(
    sessionId: string,
    containerName: string,
    workingDir: string
  ): Promise<void> {
    // -it オプションでインタラクティブモードとTTYを有効化
    // -w オプションで作業ディレクトリを /workspace に設定
    const args = ['exec', '-it', '-w', '/workspace', containerName, 'bash'];

    logger.info('DockerAdapter: Creating exec session (attaching to existing container)', {
      sessionId,
      containerName,
      workingDir,
    });

    try {
      const ptyProcess = pty.spawn('docker', args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
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
        this.emit('exit', sessionId, { exitCode, signal } as PTYExitInfo);
        this.sessions.delete(sessionId);
      });

    } catch (error) {
      logger.error('DockerAdapter: Failed to create exec session', {
        sessionId,
        containerName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.emit('error', sessionId, error instanceof Error ? error : new Error('Unknown error'));
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
          });
          this.emit('error', sessionId, error);
          throw error;
        }
        await this.createExecSession(sessionId, parentContainerName, workingDir);
        return;
      }
      // 親コンテナがない場合はエラー
      const error = new Error(
        'Dockerコンテナが見つかりません。Claude Codeセッションを先に開始してください。'
      );
      logger.warn('DockerAdapter: Shell mode requested but no parent container found', {
        sessionId,
        parentSessionId: this.getParentSessionId(sessionId),
      });
      this.emit('error', sessionId, error);
      throw error;
    }

    const { args, containerName } = this.buildDockerArgs(workingDir, options);

    logger.info('DockerAdapter: Creating session', {
      sessionId,
      workingDir,
      containerName,
      image: `${this.config.imageName}:${this.config.imageTag}`,
    });

    try {
      const ptyProcess = pty.spawn('docker', args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });

      this.sessions.set(sessionId, {
        ptyProcess,
        workingDir,
        containerId: containerName,
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
      });

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

            // 初回出力受信後、遅延リサイズを実行
            // Docker環境ではコンテナ起動のオーバーヘッドにより、クライアントからの
            // resize()がコンテナ起動完了前に到着し効果がない。初回出力後に
            // 保存済みのクライアントサイズでリサイズを再適用する。
            if (session.lastKnownCols && session.lastKnownRows) {
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
      });

      // 初期プロンプト（シェルモードでは送信しない）
      if (initialPrompt && !shellMode) {
        setTimeout(() => {
          if (this.sessions.has(sessionId)) {
            ptyProcess.write(initialPrompt + '\n');
          }
        }, 3000);
      }

    } catch (error) {
      logger.error('DockerAdapter: Failed to create session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.emit('error', sessionId, error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.ptyProcess.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastKnownCols = cols;
    session.lastKnownRows = rows;

    session.ptyProcess.resize(cols, rows);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('DockerAdapter: Destroying session', { sessionId, containerId: session.containerId });
      scrollbackBuffer.clear(sessionId);
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);

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

  restartSession(sessionId: string, workingDir?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const { workingDir: wd } = session;
      logger.info('DockerAdapter: Restarting session', { sessionId });
      this.destroySession(sessionId);
      setTimeout(() => {
        this.createSession(sessionId, wd).catch(() => {
          // createSession内部でlogger.error + emit('error')済みのため、ここでは追加処理不要
        });
      }, 500);
    } else if (workingDir) {
      logger.info('DockerAdapter: Restarting session (from fallback params)', { sessionId });
      setTimeout(() => {
        this.createSession(sessionId, workingDir).catch(() => {
          // createSession内部でlogger.error + emit('error')済みのため、ここでは追加処理不要
        });
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

  private extractClaudeSessionId(data: string): string | undefined {
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
