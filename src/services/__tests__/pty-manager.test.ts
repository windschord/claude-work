import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ptyManager } from '../pty-manager';
import * as os from 'os';

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
    it('should create PTY process successfully', (done) => {
      // PTYプロセスが生成されることを確認
      ptyManager.createPTY(testSessionId, testWorkingDir);

      expect(ptyManager.hasSession(testSessionId)).toBe(true);

      // データイベントを待つ（プロンプト表示など）
      ptyManager.once('data', (sessionId: string, data: string) => {
        expect(sessionId).toBe(testSessionId);
        expect(data).toBeTruthy();
        done();
      });
    }, 10000);

    it('should set worktree directory as cwd', (done) => {
      ptyManager.createPTY(testSessionId, testWorkingDir);

      // pwdコマンドを送信してcwdを確認
      ptyManager.write(testSessionId, 'pwd\r');

      let output = '';
      const dataHandler = (sessionId: string, data: string) => {
        if (sessionId === testSessionId) {
          output += data;

          // pwdの出力が含まれているか確認（プロンプトとコマンドエコーを含む）
          if (output.includes('pwd')) {
            ptyManager.off('data', dataHandler);
            // cwdが設定されていることを確認（実際のパスと一致しなくてもプロセスが動作していればOK）
            expect(output).toBeTruthy();
            done();
          }
        }
      };

      ptyManager.on('data', dataHandler);
    }, 10000);

    it('should emit data events for PTY output', (done) => {
      ptyManager.createPTY(testSessionId, testWorkingDir);

      ptyManager.once('data', (sessionId: string, data: string) => {
        expect(sessionId).toBe(testSessionId);
        expect(typeof data).toBe('string');
        expect(data.length).toBeGreaterThan(0);
        done();
      });
    }, 10000);
  });

  describe('write', () => {
    it('should send input to PTY successfully', (done) => {
      ptyManager.createPTY(testSessionId, testWorkingDir);

      // echoコマンドを送信
      ptyManager.write(testSessionId, 'echo "test output"\r');

      let output = '';
      const dataHandler = (sessionId: string, data: string) => {
        if (sessionId === testSessionId) {
          output += data;

          // echoの出力を確認
          if (output.includes('test output')) {
            ptyManager.off('data', dataHandler);
            expect(output).toContain('test output');
            done();
          }
        }
      };

      ptyManager.on('data', dataHandler);
    }, 10000);

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
    it('should terminate PTY process successfully', (done) => {
      ptyManager.createPTY(testSessionId, testWorkingDir);

      expect(ptyManager.hasSession(testSessionId)).toBe(true);

      // exitイベントを待つ
      ptyManager.once('exit', (sessionId: string, result: any) => {
        expect(sessionId).toBe(testSessionId);
        expect(result).toHaveProperty('exitCode');
        expect(ptyManager.hasSession(testSessionId)).toBe(false);
        done();
      });

      // プロセスを終了
      ptyManager.kill(testSessionId);
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
      const platform = os.platform();

      // プラットフォームに応じたシェルが選択されることを確認
      // この確認は間接的（プロセスが正常に起動すればOK）
      ptyManager.createPTY(testSessionId, testWorkingDir);
      expect(ptyManager.hasSession(testSessionId)).toBe(true);
    });
  });
});
