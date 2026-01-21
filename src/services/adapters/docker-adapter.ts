import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { EnvironmentAdapter, CreateSessionOptions, PTYExitInfo } from '../environment-adapter';
import { prisma } from '@/lib/db';
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

    // イメージ
    args.push(`${this.config.imageName}:${this.config.imageTag}`);

    // claudeコマンド
    args.push('claude');
    if (options?.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    return { args, containerName };
  }

  async createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): Promise<void> {
    // 既存セッションのクリーンアップ
    if (this.sessions.has(sessionId)) {
      this.destroySession(sessionId);
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
        env: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });

      this.sessions.set(sessionId, {
        ptyProcess,
        workingDir,
        containerId: containerName,
        errorBuffer: '',
        hasReceivedOutput: false,
      });

      // Session.container_idを更新
      await prisma.session.update({
        where: { id: sessionId },
        data: { container_id: containerName },
      });

      // イベント転送
      ptyProcess.onData((data: string) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          if (!session.hasReceivedOutput && data.length > 0) {
            session.hasReceivedOutput = true;
          }
          if (session.errorBuffer.length < 5000) {
            session.errorBuffer += data;
          }

          // Claude CodeセッションID抽出
          if (!session.claudeSessionId) {
            const extracted = this.extractClaudeSessionId(data);
            if (extracted) {
              session.claudeSessionId = extracted;
              this.emit('claudeSessionId', sessionId, extracted);
            }
          }
        }
        this.emit('data', sessionId, data);
      });

      ptyProcess.onExit(async ({ exitCode, signal }) => {
        logger.info('DockerAdapter: Session exited', { sessionId, exitCode, signal });

        // container_idをクリア
        try {
          await prisma.session.update({
            where: { id: sessionId },
            data: { container_id: null },
          });
        } catch {
          // セッションが既に削除されている場合は無視
        }

        this.emit('exit', sessionId, { exitCode, signal } as PTYExitInfo);
        this.sessions.delete(sessionId);
      });

      // 初期プロンプト
      if (initialPrompt) {
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
    this.sessions.get(sessionId)?.ptyProcess.resize(cols, rows);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('DockerAdapter: Destroying session', { sessionId, containerId: session.containerId });
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);

      // container_idをクリア（非同期だが待たない）
      prisma.session.update({
        where: { id: sessionId },
        data: { container_id: null },
      }).catch(() => {});
    }
  }

  restartSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const { workingDir } = session;
      logger.info('DockerAdapter: Restarting session', { sessionId });
      this.destroySession(sessionId);
      setTimeout(() => this.createSession(sessionId, workingDir), 500);
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
