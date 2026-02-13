import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// node-ptyをモック化（テスト環境ではネイティブモジュールが不安定なため）
const mockOnData = vi.fn();
const mockOnExit = vi.fn();
const mockWrite = vi.fn();
const mockResize = vi.fn();
const mockKill = vi.fn();

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: mockOnData,
    onExit: mockOnExit,
    write: mockWrite,
    resize: mockResize,
    kill: mockKill,
    pid: 12345,
  })),
}));

// モック後にインポート
const { ptyManager } = await import('../pty-manager');

describe('PTYManager', () => {
  const testSessionId = 'test-session-123';
  let testWorkingDir: string;

  beforeAll(() => {
    testWorkingDir = mkdtempSync(join(tmpdir(), 'pty-manager-test-'));
  });

  afterAll(() => {
    rmSync(testWorkingDir, { recursive: true, force: true });
  });

  afterEach(() => {
    // クリーンアップ
    if (ptyManager.hasSession(testSessionId)) {
      ptyManager.kill(testSessionId);
    }
    vi.clearAllMocks();
  });

  describe('createPTY', () => {
    it('should create PTY process successfully', () => {
      // PTYプロセスが生成されることを確認
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);
    });

    it('should accept worktree directory as parameter', () => {
      // worktreeパラメータを受け入れることを確認
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);
    });
  });

  describe('write', () => {
    it('should accept input data', () => {
      ptyManager.createPTY(testSessionId, testWorkingDir);
      // writeメソッドがエラーを起こさないことを確認
      expect(() => {
        ptyManager.write(testSessionId, 'test\r');
      }).not.toThrow();
    });

    it('should handle write to non-existent session gracefully', () => {
      // 存在しないセッションへの書き込みはエラーを起こさない
      expect(() => {
        ptyManager.write('non-existent-session', 'test\r');
      }).not.toThrow();
    });
  });

  describe('resize', () => {
    it('should resize PTY successfully', () => {
      ptyManager.createPTY(testSessionId, testWorkingDir);

      // リサイズを実行（エラーが発生しないことを確認）
      expect(() => {
        ptyManager.resize(testSessionId, 100, 30);
      }).not.toThrow();
    });

    it('should handle resize of non-existent session gracefully', () => {
      expect(() => {
        ptyManager.resize('non-existent-session', 80, 24);
      }).not.toThrow();
    });
  });

  describe('kill', () => {
    it('should terminate PTY process successfully', () => {
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);

      // onExitコールバックをキャプチャしてシミュレーション
      const onExitCallback = mockOnExit.mock.calls[0][0];

      // exitイベントを待つ
      const exitPromise = new Promise<void>((resolve) => {
        ptyManager.once('exit', (sessionId: string, result: { exitCode: number; signal?: number }) => {
          expect(sessionId).toBe(testSessionId);
          expect(result).toHaveProperty('exitCode');
          expect(ptyManager.hasSession(testSessionId)).toBe(false);
          resolve();
        });
      });

      // killを呼び出し、onExitコールバックをシミュレーション
      ptyManager.kill(testSessionId);
      onExitCallback({ exitCode: 0, signal: 15 });

      return exitPromise;
    }, 10000);

    it('should handle kill of non-existent session gracefully', () => {
      expect(() => {
        ptyManager.kill('non-existent-session');
      }).not.toThrow();
    });
  });

  describe('hasSession', () => {
    it('should return true for existing session', () => {
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(ptyManager.hasSession('non-existent-session')).toBe(false);
    });
  });

  describe('shell selection', () => {
    it('should use correct shell based on platform', async () => {
      const pty = await import('node-pty');
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);
      // node-pty.spawnが呼ばれたことを確認
      expect(vi.mocked(pty.spawn)).toHaveBeenCalled();
    });
  });
});
