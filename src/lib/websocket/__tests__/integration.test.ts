import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../connection-manager';
import { WebSocket } from 'ws';

/**
 * WebSocket接続管理の統合テスト
 *
 * TASK-004: すべてのWebSocketタイプ（Session/Claude/Terminal）の統合動作を検証
 * - 複数セッションの独立性
 * - ブロードキャスト機能の正確性
 * - イベントハンドラー重複防止
 * - PTY破棄タイマーの動作
 * - allConnectionsClosedイベント
 */

// モックWebSocketの作成
class MockWebSocket extends EventEmitter {
  public readyState = WebSocket.OPEN;
  public sentMessages: string[] = [];

  send(data: string | Buffer): void {
    if (this.readyState === WebSocket.OPEN) {
      this.sentMessages.push(data.toString());
    }
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }

  // WebSocketインターフェースを満たすためのプロパティ
  get CONNECTING() { return WebSocket.CONNECTING; }
  get OPEN() { return WebSocket.OPEN; }
  get CLOSING() { return WebSocket.CLOSING; }
  get CLOSED() { return WebSocket.CLOSED; }
}

describe('WebSocket Connection Management Integration', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // クリーンアップ
    connectionManager.removeAllListeners();
  });

  describe('Multiple Sessions Independence', () => {
    it('should manage connections for multiple sessions independently', () => {
      const session1ws1 = new MockWebSocket() as unknown as WebSocket;
      const session1ws2 = new MockWebSocket() as unknown as WebSocket;
      const session2ws1 = new MockWebSocket() as unknown as WebSocket;

      // セッション1に2つの接続
      connectionManager.addConnection('session1', session1ws1);
      connectionManager.addConnection('session1', session1ws2);

      // セッション2に1つの接続
      connectionManager.addConnection('session2', session2ws1);

      expect(connectionManager.getConnectionCount('session1')).toBe(2);
      expect(connectionManager.getConnectionCount('session2')).toBe(1);
    });

    it('should broadcast message only to connections in the same session', () => {
      const session1ws1 = new MockWebSocket() as unknown as WebSocket;
      const session1ws2 = new MockWebSocket() as unknown as WebSocket;
      const session2ws1 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', session1ws1);
      connectionManager.addConnection('session1', session1ws2);
      connectionManager.addConnection('session2', session2ws1);

      // セッション1へのブロードキャスト（stringはそのまま送信される）
      connectionManager.broadcast('session1', 'message for session1');

      // セッション1の接続はメッセージを受信
      expect((session1ws1 as unknown as MockWebSocket).sentMessages).toContain(
        'message for session1'
      );
      expect((session1ws2 as unknown as MockWebSocket).sentMessages).toContain(
        'message for session1'
      );

      // セッション2の接続は受信しない
      expect((session2ws1 as unknown as MockWebSocket).sentMessages).not.toContain(
        'message for session1'
      );
    });

    it('should remove connections from specific session without affecting others', () => {
      const session1ws1 = new MockWebSocket() as unknown as WebSocket;
      const session2ws1 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', session1ws1);
      connectionManager.addConnection('session2', session2ws1);

      // セッション1の接続を削除
      connectionManager.removeConnection('session1', session1ws1);

      expect(connectionManager.getConnectionCount('session1')).toBe(0);
      expect(connectionManager.getConnectionCount('session2')).toBe(1);
    });
  });

  describe('Broadcast Functionality', () => {
    it('should broadcast string message to all connections', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const ws3 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', ws1);
      connectionManager.addConnection('session1', ws2);
      connectionManager.addConnection('session1', ws3);

      connectionManager.broadcast('session1', 'test message');

      expect((ws1 as unknown as MockWebSocket).sentMessages).toContain('test message');
      expect((ws2 as unknown as MockWebSocket).sentMessages).toContain('test message');
      expect((ws3 as unknown as MockWebSocket).sentMessages).toContain('test message');
    });

    it('should broadcast ServerMessage object to all connections', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', ws1);
      connectionManager.addConnection('session1', ws2);

      const message = { type: 'data', content: 'test content' };
      connectionManager.broadcast('session1', message);

      const expectedMessage = JSON.stringify(message);
      expect((ws1 as unknown as MockWebSocket).sentMessages).toContain(expectedMessage);
      expect((ws2 as unknown as MockWebSocket).sentMessages).toContain(expectedMessage);
    });

    it('should skip closed connections during broadcast', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', ws1);
      connectionManager.addConnection('session1', ws2);

      // ws2を閉じる
      (ws2 as unknown as MockWebSocket).readyState = WebSocket.CLOSED;

      connectionManager.broadcast('session1', 'test message');

      // ws1のみメッセージを受信
      expect((ws1 as unknown as MockWebSocket).sentMessages.length).toBe(1);
      expect((ws2 as unknown as MockWebSocket).sentMessages.length).toBe(0);
    });

    it('should handle broadcast to non-existent session gracefully', () => {
      // 接続がないセッションへのブロードキャスト
      expect(() => {
        connectionManager.broadcast('non-existent-session', 'test message');
      }).not.toThrow();
    });
  });

  describe('Event Handler Management', () => {
    it('should register event handler for a session', () => {
      const handler = vi.fn();

      connectionManager.registerHandler('session1', 'data', handler);

      expect(connectionManager.hasHandler('session1', 'data')).toBe(true);
    });

    it('should prevent duplicate event handler registration', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      connectionManager.registerHandler('session1', 'data', handler1);
      connectionManager.registerHandler('session1', 'data', handler2);

      // 2回目の登録は上書き（警告が出る）
      expect(connectionManager.hasHandler('session1', 'data')).toBe(true);
    });

    it('should unregister event handler', () => {
      const handler = vi.fn();

      connectionManager.registerHandler('session1', 'data', handler);
      connectionManager.unregisterHandler('session1', 'data');

      expect(connectionManager.hasHandler('session1', 'data')).toBe(false);
    });

    it('should manage handlers for multiple events independently', () => {
      const dataHandler = vi.fn();
      const exitHandler = vi.fn();

      connectionManager.registerHandler('session1', 'data', dataHandler);
      connectionManager.registerHandler('session1', 'exit', exitHandler);

      expect(connectionManager.hasHandler('session1', 'data')).toBe(true);
      expect(connectionManager.hasHandler('session1', 'exit')).toBe(true);

      connectionManager.unregisterHandler('session1', 'data');

      expect(connectionManager.hasHandler('session1', 'data')).toBe(false);
      expect(connectionManager.hasHandler('session1', 'exit')).toBe(true);
    });

    it('should isolate handlers between different sessions', () => {
      const session1Handler = vi.fn();
      const session2Handler = vi.fn();

      connectionManager.registerHandler('session1', 'data', session1Handler);
      connectionManager.registerHandler('session2', 'data', session2Handler);

      expect(connectionManager.hasHandler('session1', 'data')).toBe(true);
      expect(connectionManager.hasHandler('session2', 'data')).toBe(true);

      connectionManager.unregisterHandler('session1', 'data');

      expect(connectionManager.hasHandler('session1', 'data')).toBe(false);
      expect(connectionManager.hasHandler('session2', 'data')).toBe(true);
    });
  });

  describe('allConnectionsClosed Event', () => {
    it('should emit allConnectionsClosed when last connection is removed', () => {
      return new Promise<void>((resolve) => {
        const ws1 = new MockWebSocket() as unknown as WebSocket;

        connectionManager.on('allConnectionsClosed', (sessionId: string) => {
          expect(sessionId).toBe('session1');
          resolve();
        });

        connectionManager.addConnection('session1', ws1);
        connectionManager.removeConnection('session1', ws1);
      });
    });

    it('should not emit allConnectionsClosed when other connections remain', () => {
      return new Promise<void>((resolve) => {
        const ws1 = new MockWebSocket() as unknown as WebSocket;
        const ws2 = new MockWebSocket() as unknown as WebSocket;

        let eventEmitted = false;
        connectionManager.on('allConnectionsClosed', () => {
          eventEmitted = true;
        });

        connectionManager.addConnection('session1', ws1);
        connectionManager.addConnection('session1', ws2);
        connectionManager.removeConnection('session1', ws1);

        // 少し待ってイベントが発火しないことを確認
        setTimeout(() => {
          expect(eventEmitted).toBe(false);
          expect(connectionManager.getConnectionCount('session1')).toBe(1);
          resolve();
        }, 50);
      });
    });

    it('should emit allConnectionsClosed for each session independently', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const emittedSessions: string[] = [];
      connectionManager.on('allConnectionsClosed', (sessionId: string) => {
        emittedSessions.push(sessionId);
      });

      connectionManager.addConnection('session1', ws1);
      connectionManager.addConnection('session2', ws2);

      connectionManager.removeConnection('session1', ws1);
      connectionManager.removeConnection('session2', ws2);

      expect(emittedSessions).toContain('session1');
      expect(emittedSessions).toContain('session2');
      expect(emittedSessions.length).toBe(2);
    });
  });

  describe('Connection Lifecycle', () => {
    it('should handle add -> remove -> re-add sequence', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', ws1);
      expect(connectionManager.getConnectionCount('session1')).toBe(1);

      connectionManager.removeConnection('session1', ws1);
      expect(connectionManager.getConnectionCount('session1')).toBe(0);

      // 再度追加
      connectionManager.addConnection('session1', ws1);
      expect(connectionManager.getConnectionCount('session1')).toBe(1);
    });

    it('should handle multiple rapid add/remove operations', () => {
      const connections: WebSocket[] = [];

      // 10個の接続を追加
      for (let i = 0; i < 10; i++) {
        const ws = new MockWebSocket() as unknown as WebSocket;
        connections.push(ws);
        connectionManager.addConnection('session1', ws);
      }

      expect(connectionManager.getConnectionCount('session1')).toBe(10);

      // 5個を削除
      for (let i = 0; i < 5; i++) {
        connectionManager.removeConnection('session1', connections[i]);
      }

      expect(connectionManager.getConnectionCount('session1')).toBe(5);
    });

    it('should cleanup session when all connections are removed', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const handler = vi.fn();

      connectionManager.addConnection('session1', ws1);
      connectionManager.registerHandler('session1', 'data', handler);

      connectionManager.removeConnection('session1', ws1);

      // セッションがクリーンアップされている
      expect(connectionManager.getConnectionCount('session1')).toBe(0);
      expect(connectionManager.hasHandler('session1', 'data')).toBe(false);
    });
  });

  describe('Metrics Collection', () => {
    it('should track total and active connections', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', ws1);
      connectionManager.addConnection('session1', ws2);

      const metrics = connectionManager.getMetrics();
      expect(metrics.totalConnections).toBe(2);
      expect(metrics.activeConnections).toBe(2);

      connectionManager.removeConnection('session1', ws1);

      const metricsAfter = connectionManager.getMetrics();
      expect(metricsAfter.activeConnections).toBe(1);
    });

    it('should track messages sent', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;

      connectionManager.addConnection('session1', ws1);

      const metricsBefore = connectionManager.getMetrics();
      const messagesSentBefore = metricsBefore.messagesSent;

      connectionManager.broadcast('session1', 'test message');

      const metricsAfter = connectionManager.getMetrics();
      expect(metricsAfter.messagesSent).toBe(messagesSentBefore + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle broadcast error without affecting other connections', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      // ws1のsendメソッドをエラーを投げるようにモック
      vi.spyOn(ws1 as unknown as MockWebSocket, 'send').mockImplementation(() => {
        throw new Error('Send failed');
      });

      connectionManager.addConnection('session1', ws1);
      connectionManager.addConnection('session1', ws2);

      // エラーが発生してもブロードキャストは続行される
      expect(() => {
        connectionManager.broadcast('session1', 'test message');
      }).not.toThrow();

      // ws2はメッセージを受信
      expect((ws2 as unknown as MockWebSocket).sentMessages.length).toBe(1);
    });

    it('should handle removeConnection for non-existent connection gracefully', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;

      expect(() => {
        connectionManager.removeConnection('non-existent-session', ws1);
      }).not.toThrow();
    });
  });
});
