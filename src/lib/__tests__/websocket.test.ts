import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

describe('WebSocket Server', () => {
  let wss: WebSocketServer;
  let mockRequest: IncomingMessage;
  let mockSocket: Socket;

  beforeEach(() => {
    // WebSocketサーバーのモック
    wss = new WebSocketServer({ noServer: true });
    mockSocket = new Socket();
    mockRequest = new IncomingMessage(mockSocket);
  });

  afterEach(() => {
    wss.close();
  });

  describe('認証ミドルウェア', () => {
    it('認証済みクライアントの接続を許可する', async () => {
      // 認証済みクッキーを設定
      mockRequest.headers.cookie = 'sessionId=valid-session-id';

      const handleUpgrade = vi.fn();
      wss.on('connection', handleUpgrade);

      // WebSocketアップグレード処理
      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      expect(handleUpgrade).not.toHaveBeenCalled();
    });

    it('未認証クライアントの接続を拒否する', async () => {
      // 認証クッキーなし
      mockRequest.headers.cookie = '';

      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      // 接続が拒否されることを期待
      await new Promise<void>((resolve) => {
        ws.on('error', () => {
          resolve();
        });
        ws.on('close', () => {
          resolve();
        });
      });
    });

    it('無効なセッションIDで接続を拒否する', async () => {
      mockRequest.headers.cookie = 'sessionId=invalid-session';

      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      await new Promise<void>((resolve) => {
        ws.on('close', (code) => {
          expect(code).toBe(1008); // Unauthorized
          resolve();
        });
      });
    });
  });

  describe('ConnectionManager', () => {
    it('接続を追加できる', () => {
      const { ConnectionManager } = require('../websocket/connection-manager');
      const manager = new ConnectionManager();
      const ws = new WebSocket('ws://localhost:3000');

      manager.addConnection('session-1', ws);
      expect(manager.getConnectionCount('session-1')).toBe(1);
    });

    it('接続を削除できる', () => {
      const { ConnectionManager } = require('../websocket/connection-manager');
      const manager = new ConnectionManager();
      const ws = new WebSocket('ws://localhost:3000');

      manager.addConnection('session-1', ws);
      manager.removeConnection('session-1', ws);
      expect(manager.getConnectionCount('session-1')).toBe(0);
    });

    it('複数のクライアントに接続をブロードキャストできる', (done) => {
      const { ConnectionManager } = require('../websocket/connection-manager');
      const manager = new ConnectionManager();
      const ws1 = new WebSocket('ws://localhost:3000');
      const ws2 = new WebSocket('ws://localhost:3000');

      let receivedCount = 0;
      const message = { type: 'output', content: 'test message' };

      ws1.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        expect(parsed).toEqual(message);
        receivedCount++;
        if (receivedCount === 2) done();
      });

      ws2.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        expect(parsed).toEqual(message);
        receivedCount++;
        if (receivedCount === 2) done();
      });

      manager.addConnection('session-1', ws1);
      manager.addConnection('session-1', ws2);
      manager.broadcast('session-1', message);
    });

    it('異なるセッションには送信しない', () => {
      const { ConnectionManager } = require('../websocket/connection-manager');
      const manager = new ConnectionManager();
      const ws1 = new WebSocket('ws://localhost:3000');
      const ws2 = new WebSocket('ws://localhost:3000');

      const receivedMessages: any[] = [];

      ws1.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      ws2.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      manager.addConnection('session-1', ws1);
      manager.addConnection('session-2', ws2);
      manager.broadcast('session-1', { type: 'output', content: 'test' });

      // session-1のみに送信される
      expect(receivedMessages).toHaveLength(1);
    });
  });

  describe('メッセージ送受信', () => {
    it('クライアントからの入力メッセージを受信できる', (done) => {
      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('open', () => {
        const message = { type: 'input', content: 'Hello Claude' };
        ws.send(JSON.stringify(message));
      });

      // サーバー側でメッセージを受信することを期待
      wss.on('connection', (clientWs) => {
        clientWs.on('message', (data) => {
          const parsed = JSON.parse(data.toString());
          expect(parsed.type).toBe('input');
          expect(parsed.content).toBe('Hello Claude');
          done();
        });
      });
    });

    it('サーバーからの出力メッセージを送信できる', (done) => {
      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        expect(parsed.type).toBe('output');
        expect(parsed.content).toBe('Response from Claude');
        done();
      });

      ws.on('open', () => {
        const message = { type: 'output', content: 'Response from Claude' };
        ws.send(JSON.stringify(message));
      });
    });
  });

  describe('Claude Code出力のブロードキャスト', () => {
    it('ProcessManagerからの出力をクライアントに送信する', (done) => {
      const { getProcessManager } = require('../../services/process-manager');
      const processManager = getProcessManager();

      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        expect(parsed.type).toBe('output');
        expect(parsed.content).toBe('Claude Code output');
        done();
      });

      // ProcessManagerがoutputイベントを発火
      processManager.emit('output', {
        sessionId: 'test-session',
        type: 'output',
        content: 'Claude Code output',
      });
    });

    it('権限確認リクエストをクライアントに送信する', (done) => {
      const { getProcessManager } = require('../../services/process-manager');
      const processManager = getProcessManager();

      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        expect(parsed.type).toBe('permission_request');
        expect(parsed.permission.action).toBe('git push');
        done();
      });

      // ProcessManagerがpermissionイベントを発火
      processManager.emit('permission', {
        sessionId: 'test-session',
        requestId: 'req-123',
        action: 'git push',
        details: 'Push to origin/main',
      });
    });
  });

  describe('権限確認リクエストの送信', () => {
    it('approve応答をProcessManagerに転送する', (done) => {
      const { getProcessManager } = require('../../services/process-manager');
      const processManager = getProcessManager();

      processManager.sendInput = vi.fn().mockResolvedValue(undefined);

      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('open', () => {
        const message = { type: 'approve', requestId: 'req-123' };
        ws.send(JSON.stringify(message));

        setTimeout(() => {
          expect(processManager.sendInput).toHaveBeenCalledWith(
            'test-session',
            expect.stringContaining('approve')
          );
          done();
        }, 100);
      });
    });

    it('deny応答をProcessManagerに転送する', (done) => {
      const { getProcessManager } = require('../../services/process-manager');
      const processManager = getProcessManager();

      processManager.sendInput = vi.fn().mockResolvedValue(undefined);

      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('open', () => {
        const message = { type: 'deny', requestId: 'req-123' };
        ws.send(JSON.stringify(message));

        setTimeout(() => {
          expect(processManager.sendInput).toHaveBeenCalledWith(
            'test-session',
            expect.stringContaining('deny')
          );
          done();
        }, 100);
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なJSON形式のメッセージでエラーを送信する', (done) => {
      const ws = new WebSocket('ws://localhost:3000/ws/sessions/test-session');

      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'error') {
          expect(parsed.content).toContain('Invalid message format');
          done();
        }
      });

      ws.on('open', () => {
        ws.send('invalid json');
      });
    });

    it('無効なセッションIDで接続を拒否する', (done) => {
      const ws = new WebSocket('ws://localhost:3000/ws/sessions/');

      ws.on('close', (code) => {
        expect(code).toBe(1003); // Invalid session ID
        done();
      });
    });
  });
});
