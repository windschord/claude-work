import { EventEmitter } from 'events';
import { claudePtyManager } from '../claude-pty-manager';
import { EnvironmentAdapter, CreateSessionOptions, PTYExitInfo } from '../environment-adapter';
import { logger } from '@/lib/logger';

/**
 * HostAdapter
 *
 * HOST環境（ローカル実行）用のアダプター。
 * 既存のClaudePTYManagerをdockerMode: false固定でラップする。
 */
export class HostAdapter extends EventEmitter implements EnvironmentAdapter {
  constructor() {
    super();

    // ClaudePTYManagerからのイベントを転送
    claudePtyManager.on('data', (sessionId: string, data: string) => {
      this.emit('data', sessionId, data);
    });

    claudePtyManager.on('exit', (sessionId: string, info: PTYExitInfo) => {
      this.emit('exit', sessionId, info);
    });

    claudePtyManager.on('error', (sessionId: string, error: Error) => {
      this.emit('error', sessionId, error);
    });

    claudePtyManager.on('claudeSessionId', (sessionId: string, claudeSessionId: string) => {
      this.emit('claudeSessionId', sessionId, claudeSessionId);
    });

    logger.info('HostAdapter initialized');
  }

  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void {
    logger.info('HostAdapter: Creating session', { sessionId, workingDir });

    // dockerMode: false を固定で渡す（HostAdapterは常にローカル実行）
    claudePtyManager.createSession(sessionId, workingDir, initialPrompt, {
      resumeSessionId: options?.resumeSessionId,
      dockerMode: false, // 固定
    });
  }

  write(sessionId: string, data: string): void {
    claudePtyManager.write(sessionId, data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    claudePtyManager.resize(sessionId, cols, rows);
  }

  destroySession(sessionId: string): void {
    logger.info('HostAdapter: Destroying session', { sessionId });
    claudePtyManager.destroySession(sessionId);
  }

  restartSession(sessionId: string): void {
    logger.info('HostAdapter: Restarting session', { sessionId });
    claudePtyManager.restartSession(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return claudePtyManager.hasSession(sessionId);
  }

  getWorkingDir(sessionId: string): string | undefined {
    return claudePtyManager.getWorkingDir(sessionId);
  }
}
