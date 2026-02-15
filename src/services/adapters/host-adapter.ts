import type { IPty } from 'node-pty';
import { ptyManager, type PTYExitInfo as ShellPTYExitInfo } from '../pty-manager';
import type { CreateSessionOptions } from '../environment-adapter';
import { logger } from '@/lib/logger';
import { BasePTYAdapter } from './base-adapter';

/**
 * HostAdapter
 *
 * HOST環境（ローカル実行）用のアダプター。
 * - shellMode=false: BasePTYAdapterでClaude Codeを直接起動
 * - shellMode=true: ptyManagerでシェルを起動
 */
export class HostAdapter extends BasePTYAdapter {
  // PTYインスタンスを管理（Claude Codeモード）
  private ptyInstances: Map<string, IPty> = new Map();
  // shellModeで作成されたセッションのIDを管理
  private shellSessions: Set<string> = new Set();
  // 作業ディレクトリを管理
  private workingDirs: Map<string, string> = new Map();

  constructor() {
    super();

    // ptyManagerからのイベントを転送（shellMode用）
    ptyManager.on('data', (sessionId: string, data: string) => {
      if (this.shellSessions.has(sessionId)) {
        this.emit('data', sessionId, data);
      }
    });

    ptyManager.on('exit', (sessionId: string, info: ShellPTYExitInfo) => {
      if (this.shellSessions.has(sessionId)) {
        this.emit('exit', sessionId, info);
        this.shellSessions.delete(sessionId);
      }
    });

    logger.info('HostAdapter initialized');
  }

  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void {
    if (options?.shellMode) {
      // シェルモード: ptyManagerを使用
      const cols = options?.cols ?? 80;
      const rows = options?.rows ?? 24;
      logger.info('HostAdapter: Creating shell session', { sessionId, workingDir, cols, rows });
      this.shellSessions.add(sessionId);
      ptyManager.createPTY(sessionId, workingDir);
      // ptyManagerがcols/rowsパラメータを受け付けないため、作成後にresizeで反映
      ptyManager.resize(sessionId, cols, rows);
    } else {
      // 通常モード: BasePTYAdapterを使用してClaude Codeを起動
      logger.info('HostAdapter: Creating Claude session', { sessionId, workingDir });

      const cols = options?.cols ?? 80;
      const rows = options?.rows ?? 24;

      // Claude Code起動コマンド構築
      const args: string[] = [];
      if (initialPrompt) {
        args.push('--print', initialPrompt);
      }
      if (options?.resumeSessionId) {
        args.push('--resume', options.resumeSessionId);
      }

      // 環境変数の構築
      const env: Record<string, string> = {
        ...options?.customEnvVars,
      };

      const ptyInstance = this.spawnPTY('claude', args, {
        cols,
        rows,
        cwd: workingDir,
        env,
      });

      this.setupDataHandlers(ptyInstance, sessionId);
      this.setupErrorHandlers(ptyInstance, sessionId);

      this.ptyInstances.set(sessionId, ptyInstance);
      this.workingDirs.set(sessionId, workingDir);
    }
  }

  write(sessionId: string, data: string): void {
    if (this.shellSessions.has(sessionId)) {
      ptyManager.write(sessionId, data);
    } else {
      const ptyInstance = this.ptyInstances.get(sessionId);
      if (ptyInstance) {
        ptyInstance.write(data);
      }
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    if (this.shellSessions.has(sessionId)) {
      ptyManager.resize(sessionId, cols, rows);
    } else {
      const ptyInstance = this.ptyInstances.get(sessionId);
      if (ptyInstance) {
        ptyInstance.resize(cols, rows);
      }
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    logger.info('HostAdapter: Destroying session', { sessionId });
    if (this.shellSessions.has(sessionId)) {
      ptyManager.kill(sessionId);
      this.shellSessions.delete(sessionId);
    } else {
      const ptyInstance = this.ptyInstances.get(sessionId);
      if (ptyInstance) {
        await this.cleanupPTY(ptyInstance);
        this.ptyInstances.delete(sessionId);
        this.workingDirs.delete(sessionId);
      }
    }
  }

  restartSession(_sessionId: string, _workingDir?: string): void | Promise<void> {
    logger.warn('HostAdapter: restartSession not implemented');
    throw new Error('restartSession not implemented in HostAdapter');
  }

  hasSession(sessionId: string): boolean {
    if (this.shellSessions.has(sessionId)) {
      return ptyManager.hasSession(sessionId);
    }
    return this.ptyInstances.has(sessionId);
  }

  getWorkingDir(sessionId: string): string | undefined {
    if (this.shellSessions.has(sessionId)) {
      return undefined;
    }
    return this.workingDirs.get(sessionId);
  }
}
