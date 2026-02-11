/**
 * ProcessLifecycleManager - プロセスライフサイクル管理サービス
 *
 * Claude Codeプロセスのライフサイクルを自動管理します:
 * - サーバーシャットダウン時の全プロセス自動停止
 * - アイドルタイムアウトによるプロセス自動停止
 * - アクティビティトラッキング（最終アクティビティ時刻の記録）
 * - セッション再開時の--resumeオプション使用
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { ProcessManager } from './process-manager';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { AdapterFactory } from './adapter-factory';

// globalThisパターン（Next.js Hot Reload対策）
const globalForProcessLifecycleManager = globalThis as unknown as {
  processLifecycleManager: ProcessLifecycleManager | undefined;
};

/** デフォルトのアイドルタイムアウト（分） */
const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

/** 最小アイドルタイムアウト（分） */
const MIN_IDLE_TIMEOUT_MINUTES = 5;

/** アイドルチェック間隔（ミリ秒） */
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // 1分

/** グレースフル終了待機時間（ミリ秒） */
const SHUTDOWN_GRACE_PERIOD_MS = 5 * 1000; // 5秒

/**
 * プロセスライフサイクルイベント
 */
export interface ProcessLifecycleEvents {
  /** プロセスが一時停止された */
  processPaused: (sessionId: string, reason: 'idle_timeout' | 'manual' | 'server_shutdown') => void;
  /** プロセスが再開された */
  processResumed: (sessionId: string, resumedWithHistory: boolean) => void;
  /** サーバーがシャットダウンを開始 */
  serverShutdown: (reason: 'SIGTERM' | 'SIGINT') => void;
}

/**
 * プロセスライフサイクル管理クラス
 */
export class ProcessLifecycleManager extends EventEmitter {
  private static instance: ProcessLifecycleManager | null = null;

  /** セッションID -> 最終アクティビティ時刻 */
  private activityMap: Map<string, Date> = new Map();

  /** アイドルチェックのインターバルID */
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;

  /** シャットダウン中かどうか */
  private isShuttingDown = false;

  private constructor() {
    super();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): ProcessLifecycleManager {
    // globalThisから取得を試みる（モジュール間でシングルトンを共有）
    if (globalForProcessLifecycleManager.processLifecycleManager) {
      return globalForProcessLifecycleManager.processLifecycleManager;
    }

    if (!ProcessLifecycleManager.instance) {
      ProcessLifecycleManager.instance = new ProcessLifecycleManager();
    }

    // globalThisに保存（本番環境でもモジュール間で共有するため）
    globalForProcessLifecycleManager.processLifecycleManager =
      ProcessLifecycleManager.instance;

    return ProcessLifecycleManager.instance;
  }

  /**
   * テスト用にインスタンスをリセット
   */
  static resetForTesting(): void {
    if (ProcessLifecycleManager.instance) {
      ProcessLifecycleManager.instance.stopIdleChecker();
      ProcessLifecycleManager.instance.activityMap.clear();
      ProcessLifecycleManager.instance = null;
      globalForProcessLifecycleManager.processLifecycleManager = undefined;
    }
  }

  /**
   * 環境変数からアイドルタイムアウト値を取得
   * @returns タイムアウト（分）。0の場合は無効化。
   */
  static getIdleTimeoutMinutes(): number {
    const envValue = process.env.PROCESS_IDLE_TIMEOUT_MINUTES;

    if (!envValue) {
      return DEFAULT_IDLE_TIMEOUT_MINUTES;
    }

    const timeout = parseInt(envValue, 10);

    if (isNaN(timeout)) {
      return DEFAULT_IDLE_TIMEOUT_MINUTES;
    }

    // 0は無効化を意味する
    if (timeout === 0) {
      return 0;
    }

    // 最小値チェック
    if (timeout < MIN_IDLE_TIMEOUT_MINUTES) {
      return MIN_IDLE_TIMEOUT_MINUTES;
    }

    return timeout;
  }

  /**
   * セッションのアクティビティを更新
   * @param sessionId セッションID
   */
  updateActivity(sessionId: string): void {
    this.activityMap.set(sessionId, new Date());
  }

  /**
   * セッションの最終アクティビティ時刻を取得
   * @param sessionId セッションID
   * @returns 最終アクティビティ時刻、未登録の場合はnull
   */
  getLastActivity(sessionId: string): Date | null {
    return this.activityMap.get(sessionId) || null;
  }

  /**
   * セッションのアクティビティを削除
   * @param sessionId セッションID
   */
  clearActivity(sessionId: string): void {
    this.activityMap.delete(sessionId);
  }

  /**
   * アイドル状態のセッションIDリストを取得
   * @param timeoutMinutes タイムアウト（分）。0の場合は空配列を返す。
   * @returns アイドル状態のセッションIDリスト
   */
  getIdleSessions(timeoutMinutes: number): string[] {
    // 0は無効化を意味する
    if (timeoutMinutes === 0) {
      return [];
    }

    const now = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const idleSessions: string[] = [];

    for (const [sessionId, lastActivity] of this.activityMap) {
      if (now - lastActivity.getTime() > timeoutMs) {
        idleSessions.push(sessionId);
      }
    }

    return idleSessions;
  }

  /**
   * アイドルチェッカーを開始
   * @param timeoutMinutes タイムアウト（分）
   */
  startIdleChecker(timeoutMinutes: number): void {
    // 既存のインターバルを停止
    this.stopIdleChecker();

    // タイムアウト0は無効化
    if (timeoutMinutes === 0) {
      logger.info('Idle checker disabled (timeout = 0)');
      return;
    }

    logger.info(`Starting idle checker with ${timeoutMinutes} minute timeout`);

    this.idleCheckInterval = setInterval(() => {
      this.checkIdleProcesses(timeoutMinutes);
    }, IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * アイドルチェッカーを停止
   */
  stopIdleChecker(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  /**
   * アイドルプロセスをチェックして停止
   * @param timeoutMinutes タイムアウト（分）
   */
  private async checkIdleProcesses(timeoutMinutes: number): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const idleSessions = this.getIdleSessions(timeoutMinutes);

    for (const sessionId of idleSessions) {
      try {
        await this.pauseSession(sessionId, 'idle_timeout');
      } catch (error) {
        logger.error(`Failed to pause idle session ${sessionId}:`, error);
      }
    }
  }

  /**
   * セッションを一時停止
   * @param sessionId セッションID
   * @param reason 停止理由
   */
  async pauseSession(
    sessionId: string,
    reason: 'idle_timeout' | 'manual' | 'server_shutdown'
  ): Promise<void> {
    logger.info(`Pausing session ${sessionId} due to ${reason}`);

    try {
      // DBからセッション情報を取得
      const session = await db.query.sessions.findFirst({
        where: eq(schema.sessions.id, sessionId),
      });

      if (session?.environment_id) {
        // 新しい環境システム: AdapterFactory経由で停止
        const environment = await db.query.executionEnvironments.findFirst({
          where: eq(schema.executionEnvironments.id, session.environment_id),
        });
        if (environment) {
          try {
            const adapter = AdapterFactory.getAdapter(environment);
            adapter.destroySession(sessionId);
          } catch (adapterError) {
            logger.warn('Failed to get adapter, falling back to ProcessManager', {
              error: adapterError,
              sessionId,
              environmentId: session.environment_id,
            });
            const processManager = ProcessManager.getInstance();
            await processManager.stopProcess(sessionId);
          }
        } else {
          logger.warn('Environment not found, falling back to ProcessManager', {
            sessionId,
            environmentId: session.environment_id,
          });
          const processManager = ProcessManager.getInstance();
          await processManager.stopProcess(sessionId);
        }
      } else {
        // レガシー: ProcessManager
        const processManager = ProcessManager.getInstance();
        await processManager.stopProcess(sessionId);
      }

      // アクティビティをクリア
      this.clearActivity(sessionId);

      // イベント発火
      this.emit('processPaused', sessionId, reason);

      logger.info(`Session ${sessionId} stopped successfully`);
    } catch (error) {
      logger.error(`Failed to stop session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * セッションを再開
   * @param sessionId セッションID
   * @param worktreePath ワークツリーのパス
   * @param resumeSessionId Claude Codeの--resume用セッションID（オプション）
   * @returns プロセス情報
   */
  async resumeSession(
    sessionId: string,
    worktreePath: string,
    resumeSessionId?: string
  ): Promise<{ pid: number }> {
    logger.info(`Resuming session ${sessionId}`, {
      hasResumeSessionId: !!resumeSessionId,
    });

    try {
      const processManager = ProcessManager.getInstance();

      // プロセスを起動
      const processInfo = await processManager.startClaudeCode({
        sessionId,
        worktreePath,
        resumeSessionId,
      });

      // アクティビティを更新
      this.updateActivity(sessionId);

      // イベント発火
      this.emit('processResumed', sessionId, !!resumeSessionId);

      logger.info(`Session ${sessionId} resumed successfully`, {
        pid: processInfo.pid,
        resumedWithHistory: !!resumeSessionId,
      });

      return { pid: processInfo.pid };
    } catch (error) {
      logger.error(`Failed to resume session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * グレースフルシャットダウンを開始
   * @param signal シグナル名
   */
  async initiateShutdown(signal: 'SIGTERM' | 'SIGINT' = 'SIGTERM'): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Initiating graceful shutdown (${signal})...`);

    // アイドルチェッカーを停止
    this.stopIdleChecker();

    // シャットダウンイベント発火
    this.emit('serverShutdown', signal);

    try {
      const processManager = ProcessManager.getInstance();
      const activeProcesses = processManager.getActiveProcesses();

      // 全プロセスにSIGTERMを送信
      const stopPromises: Promise<void>[] = [];
      for (const sessionId of activeProcesses.keys()) {
        stopPromises.push(
          this.pauseSession(sessionId, 'server_shutdown').catch((err) => {
            logger.warn(`Failed to stop process ${sessionId}:`, err);
          })
        );
      }

      // グレース期間待機
      await Promise.race([
        Promise.all(stopPromises),
        new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_PERIOD_MS)),
      ]);

      logger.info('Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
    }
  }

  /**
   * シャットダウン中かどうか
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * ProcessLifecycleManagerインスタンスを取得するヘルパー関数
 */
export function getProcessLifecycleManager(): ProcessLifecycleManager {
  return ProcessLifecycleManager.getInstance();
}
