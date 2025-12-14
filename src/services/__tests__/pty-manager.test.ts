import { describe, it, expect, afterEach } from 'vitest';
import { ptyManager } from '../pty-manager';

describe('PTYManager', () => {
  const testSessionId = 'test-session-123';
  const testWorkingDir = '/tmp/test-worktree';

  afterEach(() => {
    // クリーンアップ
    if (ptyManager.hasSession(testSessionId)) {
      ptyManager.kill(testSessionId);
    }
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
      return new Promise<void>((resolve) => {
        ptyManager.createPTY(testSessionId, testWorkingDir);

        expect(ptyManager.hasSession(testSessionId)).toBe(true);

        // exitイベントを待つ
        ptyManager.once('exit', (sessionId: string, result: { exitCode: number; signal?: number }) => {
          expect(sessionId).toBe(testSessionId);
          expect(result).toHaveProperty('exitCode');
          expect(ptyManager.hasSession(testSessionId)).toBe(false);
          resolve();
        });

        // プロセスを終了
        ptyManager.kill(testSessionId);
      });
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
    it('should use correct shell based on platform', () => {
      // プラットフォームに応じたシェルが選択されることを確認
      // この確認は間接的（プロセスが正常に起動すればOK）
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);
    });
  });
});
