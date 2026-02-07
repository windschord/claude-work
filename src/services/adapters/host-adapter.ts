import { EventEmitter } from 'events';
import { claudePtyManager } from '../claude-pty-manager';
import { ptyManager, type PTYExitInfo as ShellPTYExitInfo } from '../pty-manager';
import { EnvironmentAdapter, CreateSessionOptions, PTYExitInfo } from '../environment-adapter';
import { logger } from '@/lib/logger';

/**
 * HostAdapter
 *
 * HOST環境（ローカル実行）用のアダプター。
 * - shellMode=false: ClaudePTYManagerでClaude Codeを起動
 * - shellMode=true: ptyManagerでシェルを起動
 */
export class HostAdapter extends EventEmitter implements EnvironmentAdapter {
  // shellModeで作成されたセッションのIDを管理
  private shellSessions: Set<string> = new Set();

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

    // ptyManagerからのイベントを転送（shellMode用）
    ptyManager.on('data', (sessionId: string, data: string) => {
      if (this.shellSessions.has(sessionId)) {
        this.emit('data', sessionId, data);
      }
    });

    ptyManager.on('exit', (sessionId: string, info: ShellPTYExitInfo) => {
      if (this.shellSessions.has(sessionId)) {
        this.emit('exit', sessionId, info as PTYExitInfo);
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
      logger.info('HostAdapter: Creating shell session', { sessionId, workingDir });
      this.shellSessions.add(sessionId);
      ptyManager.createPTY(sessionId, workingDir);
    } else {
      // 通常モード: ClaudePTYManagerを使用
      logger.info('HostAdapter: Creating Claude session', { sessionId, workingDir });
      claudePtyManager.createSession(sessionId, workingDir, initialPrompt, {
        resumeSessionId: options?.resumeSessionId,
        dockerMode: false, // 固定
        claudeCodeOptions: options?.claudeCodeOptions,
        customEnvVars: options?.customEnvVars,
      });
    }
  }

  write(sessionId: string, data: string): void {
    if (this.shellSessions.has(sessionId)) {
      ptyManager.write(sessionId, data);
    } else {
      claudePtyManager.write(sessionId, data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    if (this.shellSessions.has(sessionId)) {
      ptyManager.resize(sessionId, cols, rows);
    } else {
      claudePtyManager.resize(sessionId, cols, rows);
    }
  }

  destroySession(sessionId: string): void {
    logger.info('HostAdapter: Destroying session', { sessionId });
    if (this.shellSessions.has(sessionId)) {
      ptyManager.kill(sessionId);
      this.shellSessions.delete(sessionId);
    } else {
      claudePtyManager.destroySession(sessionId);
    }
  }

  restartSession(sessionId: string): void {
    logger.info('HostAdapter: Restarting session', { sessionId });
    // シェルセッションの再起動は現在サポートしていない
    if (!this.shellSessions.has(sessionId)) {
      claudePtyManager.restartSession(sessionId);
    }
  }

  hasSession(sessionId: string): boolean {
    if (this.shellSessions.has(sessionId)) {
      return ptyManager.hasSession(sessionId);
    }
    return claudePtyManager.hasSession(sessionId);
  }

  getWorkingDir(sessionId: string): string | undefined {
    // ptyManagerにはgetWorkingDirがないため、claudePtyManagerのみ
    if (this.shellSessions.has(sessionId)) {
      return undefined; // TODO: ptyManagerにgetWorkingDirを追加する場合はここを修正
    }
    return claudePtyManager.getWorkingDir(sessionId);
  }
}
