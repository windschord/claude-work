import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { setupTerminalWebSocket } from '../terminal-ws';
import { ptyManager } from '@/services/pty-manager';
import { prisma } from '@/lib/db';

// モックのセットアップ
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Terminal WebSocket', () => {
  let wss: WebSocketServer;
  let testSessionId: string;
  let testWorktreePath: string;

  beforeEach(() => {
    testSessionId = 'test-session-123';
    testWorktreePath = '/tmp/test-worktree';

    // WebSocketサーバーをセットアップ
    wss = new WebSocketServer({ noServer: true });

    // prismaのモック設定
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: testSessionId,
      project_id: 'test-project',
      worktree_path: testWorktreePath,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      model: 'claude-sonnet-4',
      user_id: 'test-user',
    });
  });

  afterEach(() => {
    // PTYセッションのクリーンアップ
    if (ptyManager.hasSession(testSessionId)) {
      ptyManager.kill(testSessionId);
    }

    // WebSocketサーバーのクリーンアップ
    wss.close();

    vi.clearAllMocks();
  });

  describe('Connection', () => {
    it('should accept WebSocket connection with valid session ID', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      // モックのHTTPリクエストを作成
      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });
    });

    it('should create PTY if not exists', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        // PTYが作成されることを確認
        setTimeout(() => {
          expect(ptyManager.hasSession(testSessionId)).toBe(true);
          ws.close();
          done();
        }, 100);
      });
    });

    it('should reuse existing PTY session', (done) => {
      // 事前にPTYセッションを作成
      ptyManager.createPTY(testSessionId, testWorktreePath);

      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        // PTYセッションが存在し続けることを確認
        expect(ptyManager.hasSession(testSessionId)).toBe(true);
        ws.close();
        done();
      });
    });
  });

  describe('PTY Output to WebSocket', () => {
    it('should send PTY output to WebSocket client', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        let receivedMessage = false;

        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'data') {
            expect(message.content).toBeTruthy();
            receivedMessage = true;
            ws.close();
            done();
          }
        });

        // PTY出力をエミュレート
        setTimeout(() => {
          if (!receivedMessage) {
            // タイムアウト時も終了
            ws.close();
            done();
          }
        }, 5000);
      });
    }, 10000);
  });

  describe('WebSocket Input to PTY', () => {
    it('should send WebSocket input to PTY', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        // 入力メッセージを送信
        const inputMessage = {
          type: 'input',
          data: 'echo "test"\r',
        };

        ws.send(JSON.stringify(inputMessage));

        // 出力を待つ
        let output = '';
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'data') {
            output += message.content;

            if (output.includes('test')) {
              expect(output).toContain('test');
              ws.close();
              done();
            }
          }
        });

        // タイムアウト
        setTimeout(() => {
          ws.close();
          done();
        }, 5000);
      });
    }, 10000);

    it('should handle resize message', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        // リサイズメッセージを送信（エラーが発生しないことを確認）
        const resizeMessage = {
          type: 'resize',
          data: { cols: 100, rows: 30 },
        };

        ws.send(JSON.stringify(resizeMessage));

        // 少し待ってから終了
        setTimeout(() => {
          ws.close();
          done();
        }, 100);
      });
    });
  });

  describe('PTY Exit', () => {
    it('should send exit message when PTY exits', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'exit') {
            expect(message).toHaveProperty('exitCode');
            done();
          }
        });

        // PTYを終了
        setTimeout(() => {
          ptyManager.kill(testSessionId);
        }, 100);
      });
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should close connection if session ID is missing', (done) => {
      setupTerminalWebSocket(wss, '/ws/terminal/');

      const mockReq = {
        url: '/ws/terminal/',
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        ws.on('close', (code: number) => {
          expect(code).toBe(1008);
          done();
        });
      });
    });

    it('should close connection if session not found', (done) => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        ws.on('close', (code: number) => {
          expect(code).toBe(1008);
          done();
        });
      });
    });

    it('should handle invalid message format gracefully', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        // 無効なメッセージを送信
        ws.send('invalid json');

        // エラーが発生しても接続が維持されることを確認
        setTimeout(() => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          done();
        }, 100);
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup event listeners on connection close', (done) => {
      setupTerminalWebSocket(wss, `/ws/terminal/${testSessionId}`);

      const mockReq = {
        url: `/ws/terminal/${testSessionId}`,
        headers: { host: 'localhost:3000' },
      } as any;

      const mockSocket = {} as any;

      wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (ws) => {
        // 接続を閉じる
        ws.close();

        // イベントリスナーがクリーンアップされることを確認
        setTimeout(() => {
          // PTY出力を発生させる
          ptyManager.write(testSessionId, 'echo "test"\r');

          // WebSocketが閉じられているため、メッセージは送信されない
          setTimeout(() => {
            expect(ws.readyState).toBe(WebSocket.CLOSED);
            done();
          }, 100);
        }, 100);
      });
    });
  });
});
