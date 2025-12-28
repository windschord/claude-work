/**
 * ProcessLifecycleManager テスト
 *
 * プロセスライフサイクル管理機能のユニットテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// モジュールのモック
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../process-manager', () => ({
  ProcessManager: {
    getInstance: vi.fn(() => ({
      getActiveProcesses: vi.fn(() => new Map()),
      stopProcess: vi.fn(),
      startClaudeCode: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })),
  },
}));

// テスト対象のインポート（モック設定後）
import {
  ProcessLifecycleManager,
  getProcessLifecycleManager,
} from '../process-lifecycle-manager';

describe('ProcessLifecycleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // シングルトンをリセット
    ProcessLifecycleManager.resetForTesting();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('シングルトンパターン', () => {
    it('getInstance()は同一インスタンスを返すべき', () => {
      const instance1 = ProcessLifecycleManager.getInstance();
      const instance2 = ProcessLifecycleManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('getProcessLifecycleManager()はgetInstance()と同一インスタンスを返すべき', () => {
      const instance1 = getProcessLifecycleManager();
      const instance2 = ProcessLifecycleManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('resetForTesting()後は新しいインスタンスを返すべき', () => {
      const instance1 = ProcessLifecycleManager.getInstance();
      ProcessLifecycleManager.resetForTesting();
      const instance2 = ProcessLifecycleManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('アクティビティ管理', () => {
    it('updateActivity()で最終アクティビティ時刻を更新できるべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const sessionId = 'test-session-1';

      manager.updateActivity(sessionId);

      const lastActivity = manager.getLastActivity(sessionId);
      expect(lastActivity).toBeInstanceOf(Date);
      expect(lastActivity!.getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('getLastActivity()は未登録セッションでnullを返すべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const lastActivity = manager.getLastActivity('nonexistent-session');
      expect(lastActivity).toBeNull();
    });

    it('clearActivity()でアクティビティを削除できるべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const sessionId = 'test-session-1';

      manager.updateActivity(sessionId);
      expect(manager.getLastActivity(sessionId)).not.toBeNull();

      manager.clearActivity(sessionId);
      expect(manager.getLastActivity(sessionId)).toBeNull();
    });
  });

  describe('アイドルチェック', () => {
    it('アイドル時間を超えたセッションを検出できるべき', async () => {
      const manager = ProcessLifecycleManager.getInstance();
      const sessionId = 'idle-session';

      // 過去の時刻を設定
      const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1時間前
      manager['activityMap'].set(sessionId, pastTime);

      const idleSessions = manager.getIdleSessions(30); // 30分タイムアウト
      expect(idleSessions).toContain(sessionId);
    });

    it('アクティブなセッションはアイドルとして検出されないべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const sessionId = 'active-session';

      manager.updateActivity(sessionId);

      const idleSessions = manager.getIdleSessions(30);
      expect(idleSessions).not.toContain(sessionId);
    });

    it('タイムアウト0でアイドルチェックが無効になるべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const sessionId = 'idle-session';

      const pastTime = new Date(Date.now() - 60 * 60 * 1000);
      manager['activityMap'].set(sessionId, pastTime);

      const idleSessions = manager.getIdleSessions(0); // 0 = 無効
      expect(idleSessions).toHaveLength(0);
    });
  });

  describe('アイドルチェッカー', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('startIdleChecker()でインターバルが開始されるべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      manager.startIdleChecker(30);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 1000 // 1分間隔
      );
    });

    it('stopIdleChecker()でインターバルが停止されるべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      manager.startIdleChecker(30);
      manager.stopIdleChecker();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('重複してstartIdleChecker()を呼んでも1つのインターバルのみ存在するべき', () => {
      const manager = ProcessLifecycleManager.getInstance();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      manager.startIdleChecker(30);
      manager.startIdleChecker(30);

      expect(setIntervalSpy).toHaveBeenCalledTimes(2);
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('グレースフルシャットダウン', () => {
    it('initiateShutdown()が正常に完了するべき', async () => {
      const manager = ProcessLifecycleManager.getInstance();

      await expect(manager.initiateShutdown()).resolves.not.toThrow();
    });

    it('シャットダウン時にアイドルチェッカーが停止されるべき', async () => {
      const manager = ProcessLifecycleManager.getInstance();
      manager.startIdleChecker(30);

      await manager.initiateShutdown();

      // インターバルが停止されていることを確認
      expect(manager['idleCheckInterval']).toBeNull();
    });
  });

  describe('環境変数からの設定読み取り', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('PROCESS_IDLE_TIMEOUT_MINUTESからタイムアウト値を読み取るべき', () => {
      process.env.PROCESS_IDLE_TIMEOUT_MINUTES = '45';
      const timeout = ProcessLifecycleManager.getIdleTimeoutMinutes();
      expect(timeout).toBe(45);
    });

    it('環境変数未設定時はデフォルト30分を返すべき', () => {
      delete process.env.PROCESS_IDLE_TIMEOUT_MINUTES;
      const timeout = ProcessLifecycleManager.getIdleTimeoutMinutes();
      expect(timeout).toBe(30);
    });

    it('最小値5分未満の場合は5分に補正されるべき', () => {
      process.env.PROCESS_IDLE_TIMEOUT_MINUTES = '3';
      const timeout = ProcessLifecycleManager.getIdleTimeoutMinutes();
      expect(timeout).toBe(5);
    });

    it('0の場合は無効化（0を返す）されるべき', () => {
      process.env.PROCESS_IDLE_TIMEOUT_MINUTES = '0';
      const timeout = ProcessLifecycleManager.getIdleTimeoutMinutes();
      expect(timeout).toBe(0);
    });
  });
});
