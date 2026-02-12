import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { ConnectionManager } from '../connection-manager';
import { ScrollbackBuffer } from '@/services/scrollback-buffer';
import { performance } from 'node:perf_hooks';

// WebSocketモックの作成
function createMockWebSocket(): WebSocket {
  const ws = {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as WebSocket;
  return ws;
}

describe('ConnectionManager - 接続プール管理', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    ConnectionManager.resetInstance();
    manager = ConnectionManager.getInstance();
  });

  describe('addConnection', () => {
    it('接続が追加される', () => {
      const ws = createMockWebSocket();

      manager.addConnection('session1', ws);

      expect(manager.getConnectionCount('session1')).toBe(1);
      expect(manager.hasConnections('session1')).toBe(true);
    });

    it('同じセッションに複数の接続を追加できる', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      expect(manager.getConnectionCount('session1')).toBe(2);
    });

    it('異なるセッションの接続を独立して管理する', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('session1', ws1);
      manager.addConnection('session2', ws2);

      expect(manager.getConnectionCount('session1')).toBe(1);
      expect(manager.getConnectionCount('session2')).toBe(1);
    });

    it('接続エラー/クローズハンドラーが設定される', () => {
      const ws = createMockWebSocket();

      manager.addConnection('session1', ws);

      expect(ws.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('removeConnection', () => {
    it('接続が削除される', () => {
      const ws = createMockWebSocket();

      manager.addConnection('session1', ws);
      manager.removeConnection('session1', ws);

      expect(manager.getConnectionCount('session1')).toBe(0);
      expect(manager.hasConnections('session1')).toBe(false);
    });

    it('存在しない接続を削除してもエラーにならない', () => {
      const ws = createMockWebSocket();

      expect(() => {
        manager.removeConnection('nonexistent', ws);
      }).not.toThrow();
    });

    it('最後の接続が削除されたときallConnectionsClosedイベントが発火する', () => {
      const ws = createMockWebSocket();
      const handler = vi.fn();

      manager.on('allConnectionsClosed', handler);
      manager.addConnection('session1', ws);
      manager.removeConnection('session1', ws);

      expect(handler).toHaveBeenCalledWith('session1');
    });

    it('複数接続があるときは最後の接続が削除されるまでイベントが発火しない', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const handler = vi.fn();

      manager.on('allConnectionsClosed', handler);
      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      manager.removeConnection('session1', ws1);
      expect(handler).not.toHaveBeenCalled();

      manager.removeConnection('session1', ws2);
      expect(handler).toHaveBeenCalledWith('session1');
    });
  });

  describe('getConnections', () => {
    it('セッションの接続セットを返す', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      const connections = manager.getConnections('session1');
      expect(connections.size).toBe(2);
      expect(connections.has(ws1)).toBe(true);
      expect(connections.has(ws2)).toBe(true);
    });

    it('存在しないセッションは空のSetを返す', () => {
      const connections = manager.getConnections('nonexistent');
      expect(connections.size).toBe(0);
    });
  });

  describe('hasConnections', () => {
    it('接続があるときtrueを返す', () => {
      const ws = createMockWebSocket();

      manager.addConnection('session1', ws);

      expect(manager.hasConnections('session1')).toBe(true);
    });

    it('接続がないときfalseを返す', () => {
      expect(manager.hasConnections('session1')).toBe(false);
    });
  });

  describe('getConnectionCount', () => {
    it('正しい接続数を返す', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      expect(manager.getConnectionCount('session1')).toBe(0);

      manager.addConnection('session1', ws1);
      expect(manager.getConnectionCount('session1')).toBe(1);

      manager.addConnection('session1', ws2);
      expect(manager.getConnectionCount('session1')).toBe(2);

      manager.removeConnection('session1', ws1);
      expect(manager.getConnectionCount('session1')).toBe(1);
    });
  });
});

describe('ConnectionManager - ブロードキャスト', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('broadcast', () => {
    it('全接続にメッセージを送信する', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      manager.broadcast('session1', 'test message');

      expect(ws1.send).toHaveBeenCalledWith('test message');
      expect(ws2.send).toHaveBeenCalledWith('test message');
    });

    it('Bufferメッセージを送信できる', () => {
      const ws = createMockWebSocket();
      const buffer = Buffer.from('binary data');

      manager.addConnection('session1', ws);
      manager.broadcast('session1', buffer);

      expect(ws.send).toHaveBeenCalledWith(buffer);
    });

    it('接続がOPEN状態でない場合はスキップする', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      ws2.readyState = WebSocket.CLOSING;

      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      manager.broadcast('session1', 'test message');

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('送信エラーが発生しても他の接続に影響しない', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      ws1.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      expect(() => {
        manager.broadcast('session1', 'test message');
      }).not.toThrow();

      expect(ws2.send).toHaveBeenCalledWith('test message');
    });

    it('接続がない場合は何もしない', () => {
      expect(() => {
        manager.broadcast('session1', 'test message');
      }).not.toThrow();
    });

    it('異なるセッションの接続には送信しない', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('session1', ws1);
      manager.addConnection('session2', ws2);

      manager.broadcast('session1', 'test message');

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe('sendToConnection', () => {
    it('指定した接続にメッセージを送信する', () => {
      const ws = createMockWebSocket();

      manager.sendToConnection(ws, 'test message');

      expect(ws.send).toHaveBeenCalledWith('test message');
    });

    it('接続がOPEN状態でない場合は送信しない', () => {
      const ws = createMockWebSocket();
      ws.readyState = WebSocket.CLOSED;

      manager.sendToConnection(ws, 'test message');

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('送信エラーが発生しても例外を投げない', () => {
      const ws = createMockWebSocket();
      ws.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      expect(() => {
        manager.sendToConnection(ws, 'test message');
      }).not.toThrow();
    });
  });
});

describe('ConnectionManager - スクロールバックバッファ', () => {
  let manager: ConnectionManager;
  let buffer: ScrollbackBuffer;

  beforeEach(() => {
    manager = new ConnectionManager();
    buffer = new ScrollbackBuffer();
  });

  describe('setScrollbackBuffer', () => {
    it('バッファが設定される', () => {
      buffer.append('session1', 'test output');

      manager.setScrollbackBuffer('session1', buffer);

      // バッファが設定されたことを確認（内部状態なので間接的にテスト）
      const ws = createMockWebSocket();
      manager.addConnection('session1', ws);

      // 新規接続時にバッファが送信されるはず
      expect(ws.send).toHaveBeenCalledWith('test output');
    });
  });

  describe('sendScrollbackToConnection', () => {
    it('新規接続にバッファを送信する', () => {
      buffer.append('session1', 'line1\n');
      buffer.append('session1', 'line2\n');

      manager.setScrollbackBuffer('session1', buffer);

      const ws = createMockWebSocket();
      manager.sendScrollbackToConnection('session1', ws);

      expect(ws.send).toHaveBeenCalledWith('line1\nline2\n');
    });

    it('バッファがない場合は何もしない', () => {
      const ws = createMockWebSocket();

      expect(() => {
        manager.sendScrollbackToConnection('session1', ws);
      }).not.toThrow();

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('接続がOPEN状態でない場合は送信しない', () => {
      buffer.append('session1', 'test output');
      manager.setScrollbackBuffer('session1', buffer);

      const ws = createMockWebSocket();
      ws.readyState = WebSocket.CLOSED;

      manager.sendScrollbackToConnection('session1', ws);

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('addConnection時に自動的にバッファが送信される', () => {
      buffer.append('session1', 'test output');
      manager.setScrollbackBuffer('session1', buffer);

      const ws = createMockWebSocket();
      manager.addConnection('session1', ws);

      expect(ws.send).toHaveBeenCalledWith('test output');
    });
  });
});

describe('ConnectionManager - イベントハンドラー管理', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('registerHandler', () => {
    it('ハンドラーが登録される', () => {
      const handler = vi.fn();

      manager.registerHandler('session1', 'data', handler);

      expect(manager.hasHandler('session1', 'data')).toBe(true);
    });

    it('同じイベントに複数回登録すると警告が出て上書きされる', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.registerHandler('session1', 'data', handler1);
      manager.registerHandler('session1', 'data', handler2);

      expect(manager.hasHandler('session1', 'data')).toBe(true);
      // 警告ログの確認は実装で対応
    });

    it('異なるイベントを複数登録できる', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.registerHandler('session1', 'data', handler1);
      manager.registerHandler('session1', 'exit', handler2);

      expect(manager.hasHandler('session1', 'data')).toBe(true);
      expect(manager.hasHandler('session1', 'exit')).toBe(true);
    });
  });

  describe('unregisterHandler', () => {
    it('ハンドラーが削除される', () => {
      const handler = vi.fn();

      manager.registerHandler('session1', 'data', handler);
      manager.unregisterHandler('session1', 'data');

      expect(manager.hasHandler('session1', 'data')).toBe(false);
    });

    it('存在しないハンドラーを削除してもエラーにならない', () => {
      expect(() => {
        manager.unregisterHandler('session1', 'nonexistent');
      }).not.toThrow();
    });
  });

  describe('hasHandler', () => {
    it('ハンドラーが存在するときtrueを返す', () => {
      const handler = vi.fn();

      manager.registerHandler('session1', 'data', handler);

      expect(manager.hasHandler('session1', 'data')).toBe(true);
    });

    it('ハンドラーが存在しないときfalseを返す', () => {
      expect(manager.hasHandler('session1', 'data')).toBe(false);
    });
  });
});

describe('ConnectionManager - クリーンアップ', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('cleanup', () => {
    it('接続プール、ハンドラー、バッファが削除される', () => {
      const ws = createMockWebSocket();
      const buffer = new ScrollbackBuffer();
      buffer.append('session1', 'test');
      const handler = vi.fn();

      manager.addConnection('session1', ws);
      manager.setScrollbackBuffer('session1', buffer);
      manager.registerHandler('session1', 'data', handler);

      manager.cleanup('session1');

      expect(manager.hasConnections('session1')).toBe(false);
      expect(manager.hasHandler('session1', 'data')).toBe(false);

      // バッファが削除されたことを確認
      const ws2 = createMockWebSocket();
      manager.addConnection('session1', ws2);
      // バッファが削除されているので送信されない
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('存在しないセッションをクリーンアップしてもエラーにならない', () => {
      expect(() => {
        manager.cleanup('nonexistent');
      }).not.toThrow();
    });
  });
});

describe('ConnectionManager - メトリクス', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('getMetrics', () => {
    it('メトリクスを取得できる', () => {
      const metrics = manager.getMetrics();

      expect(metrics).toHaveProperty('totalConnections');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('messagesSent');
      expect(metrics).toHaveProperty('messagesDropped');
    });

    it('接続追加時にtotalConnectionsとactiveConnectionsが増加する', () => {
      const ws = createMockWebSocket();

      const before = manager.getMetrics();
      manager.addConnection('session1', ws);
      const after = manager.getMetrics();

      expect(after.totalConnections).toBe(before.totalConnections + 1);
      expect(after.activeConnections).toBe(before.activeConnections + 1);
    });

    it('接続削除時にactiveConnectionsが減少する', () => {
      const ws = createMockWebSocket();

      manager.addConnection('session1', ws);
      const before = manager.getMetrics();
      manager.removeConnection('session1', ws);
      const after = manager.getMetrics();

      expect(after.activeConnections).toBe(before.activeConnections - 1);
      expect(after.totalConnections).toBe(before.totalConnections); // totalは減らない
    });

    it('ブロードキャスト時にmessagesSentが増加する', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('session1', ws1);
      manager.addConnection('session1', ws2);

      const before = manager.getMetrics();
      manager.broadcast('session1', 'test');
      const after = manager.getMetrics();

      expect(after.messagesSent).toBe(before.messagesSent + 2);
    });

    it('送信エラー時にmessagesDroppedが増加する', () => {
      const ws = createMockWebSocket();
      ws.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      manager.addConnection('session1', ws);

      const before = manager.getMetrics();
      manager.broadcast('session1', 'test');
      const after = manager.getMetrics();

      expect(after.messagesDropped).toBe(before.messagesDropped + 1);
    });
  });
});

describe('ConnectionManager - パフォーマンステスト', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  it('broadcast()が100ms以内に完了する（NFR-PERF-001）', () => {
    // 10個の接続を追加
    for (let i = 0; i < 10; i++) {
      const ws = createMockWebSocket();
      manager.addConnection('session1', ws);
    }

    const startTime = performance.now();
    manager.broadcast('session1', 'test message');
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  it('大量の接続でもbroadcast()が完了する', () => {
    // 100個の接続を追加
    for (let i = 0; i < 100; i++) {
      const ws = createMockWebSocket();
      manager.addConnection('session1', ws);
    }

    expect(() => {
      manager.broadcast('session1', 'test message');
    }).not.toThrow();
  });
});
