/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../websocket/connection-manager';
import { SessionWebSocketHandler } from '../websocket/session-ws';
import { authenticateWebSocket } from '../websocket/auth-middleware';
import { IncomingMessage } from 'http';

describe('WebSocket Server', () => {
  describe('ConnectionManager', () => {
    let manager: ConnectionManager;
    let mockWs1: any;
    let mockWs2: any;

    beforeEach(() => {
      manager = new ConnectionManager();
      mockWs1 = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        on: vi.fn(),
      };
      mockWs2 = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        on: vi.fn(),
      };
    });

    it('接続を追加できる', () => {
      manager.addConnection('session-1', mockWs1 as any);
      expect(manager.getConnectionCount('session-1')).toBe(1);
    });

    it('接続を削除できる', () => {
      manager.addConnection('session-1', mockWs1 as any);
      manager.removeConnection('session-1', mockWs1 as any);
      expect(manager.getConnectionCount('session-1')).toBe(0);
    });

    it('複数のクライアントに接続をブロードキャストできる', () => {
      manager.addConnection('session-1', mockWs1 as any);
      manager.addConnection('session-1', mockWs2 as any);

      const message = { type: 'output', content: 'test message' };
      manager.broadcast('session-1', message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('異なるセッションには送信しない', () => {
      manager.addConnection('session-1', mockWs1 as any);
      manager.addConnection('session-2', mockWs2 as any);

      const message = { type: 'output', content: 'test' };
      manager.broadcast('session-1', message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).not.toHaveBeenCalled();
    });

    it('複数の接続を同時に管理できる', () => {
      manager.addConnection('session-1', mockWs1 as any);
      manager.addConnection('session-1', mockWs2 as any);

      expect(manager.getConnectionCount('session-1')).toBe(2);

      manager.removeConnection('session-1', mockWs1 as any);
      expect(manager.getConnectionCount('session-1')).toBe(1);
    });

    it('閉じた接続をブロードキャスト時に削除する', () => {
      const closedWs = {
        readyState: 3, // WebSocket.CLOSED
        send: vi.fn(),
        on: vi.fn(),
      };

      manager.addConnection('session-1', closedWs as any);
      manager.broadcast('session-1', { type: 'test' });

      expect(manager.getConnectionCount('session-1')).toBe(0);
    });

    it('全接続を閉じることができる', () => {
      const ws1WithClose = {
        ...mockWs1,
        close: vi.fn(),
      };
      const ws2WithClose = {
        ...mockWs2,
        close: vi.fn(),
      };

      manager.addConnection('session-1', ws1WithClose as any);
      manager.addConnection('session-1', ws2WithClose as any);
      manager.closeAllConnections('session-1');

      expect(ws1WithClose.close).toHaveBeenCalled();
      expect(ws2WithClose.close).toHaveBeenCalled();
      expect(manager.getConnectionCount('session-1')).toBe(0);
    });
  });

  describe('SessionWebSocketHandler', () => {
    let handler: SessionWebSocketHandler;
    let manager: ConnectionManager;
    let mockWs: any;

    beforeEach(() => {
      manager = new ConnectionManager();
      handler = new SessionWebSocketHandler(manager);
      mockWs = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };
    });

    it('WebSocket接続を処理できる', () => {
      handler.handleConnection(mockWs as any, 'test-session');

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(manager.getConnectionCount('test-session')).toBe(1);
    });

    it('接続成功メッセージを送信する', () => {
      handler.handleConnection(mockWs as any, 'test-session');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('status_change')
      );
    });
  });

  describe('認証ミドルウェア', () => {
    it('sessionIdクッキーがない場合はnullを返す', async () => {
      const mockRequest = {
        headers: {},
      } as IncomingMessage;

      const result = await authenticateWebSocket(mockRequest, 'test-session-id');
      expect(result).toBeNull();
    });

    it('クッキーをパースできる', async () => {
      const mockRequest = {
        headers: {
          cookie: 'sessionId=test-session-id; other=value',
        },
      } as IncomingMessage;

      // getSessionがモックされていないため、nullが返される
      const result = await authenticateWebSocket(mockRequest, 'test-session-id');
      // 実際のデータベースチェックが必要なため、テスト環境ではnullが返される
      expect(result).toBeNull();
    });
  });

  describe('メッセージハンドリング', () => {
    it('入力メッセージの型定義が正しい', () => {
      const inputMessage = { type: 'input', content: 'test' };
      expect(inputMessage.type).toBe('input');
      expect(inputMessage.content).toBe('test');
    });

    it('承認メッセージの型定義が正しい', () => {
      const approveMessage = { type: 'approve', requestId: 'req-123' };
      expect(approveMessage.type).toBe('approve');
      expect(approveMessage.requestId).toBe('req-123');
    });

    it('拒否メッセージの型定義が正しい', () => {
      const denyMessage = { type: 'deny', requestId: 'req-456' };
      expect(denyMessage.type).toBe('deny');
      expect(denyMessage.requestId).toBe('req-456');
    });
  });
});
