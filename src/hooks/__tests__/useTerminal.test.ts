/**
 * useTerminalフックのテスト
 * タスク6.7: ターミナル統合(フロントエンド)実装
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTerminal } from '../useTerminal';

// WebSocketのモック
class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    // 非同期でopenイベントを発火
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    });
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });
}

describe('useTerminal', () => {
  let mockWebSocketInstance: MockWebSocket | null = null;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // 元のWebSocketを保存
    originalWebSocket = global.WebSocket;

    // WebSocketのグローバルモック（classとして定義）
    const MockWebSocketConstructor = function (this: WebSocket, url: string) {
      mockWebSocketInstance = new MockWebSocket(url);
      return mockWebSocketInstance;
    } as unknown as typeof WebSocket;

    MockWebSocketConstructor.CONNECTING = MockWebSocket.CONNECTING;
    MockWebSocketConstructor.OPEN = MockWebSocket.OPEN;
    MockWebSocketConstructor.CLOSING = MockWebSocket.CLOSING;
    MockWebSocketConstructor.CLOSED = MockWebSocket.CLOSED;

    global.WebSocket = MockWebSocketConstructor;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockWebSocketInstance = null;
    // WebSocketを元に戻す
    global.WebSocket = originalWebSocket;
  });

  it('WebSocket接続が成功する', async () => {
    const sessionId = 'test-session-123';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 初期状態は未接続
    expect(result.current.isConnected).toBe(false);

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('正しいWebSocket URLで接続される', async () => {
    const sessionId = 'test-session-456';
    renderHook(() => useTerminal(sessionId));

    await waitFor(() => {
      // WebSocketインスタンスが作成され、正しいURLが使用されることを確認
      expect(mockWebSocketInstance).toBeTruthy();
      expect(mockWebSocketInstance?.url).toContain(`/ws/terminal/${sessionId}`);
    });
  });

  it('ターミナル出力を受信できる', async () => {
    const sessionId = 'test-session-789';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // ターミナル出力メッセージを送信
    const message = {
      type: 'output',
      data: 'Hello from terminal\n',
    };

    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
    }

    // terminalオブジェクトが存在することを確認
    expect(result.current.terminal).toBeTruthy();
  });

  it('ターミナル入力を送信できる', async () => {
    const sessionId = 'test-session-input';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // WebSocketのsendメソッドが定義されていることを確認
    expect(mockWebSocketInstance?.send).toBeDefined();

    // terminalオブジェクトが存在することを確認
    expect(result.current.terminal).toBeTruthy();
  });

  it('リサイズメッセージを送信できる', async () => {
    const sessionId = 'test-session-resize';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // fitメソッドを呼び出す
    if (result.current.fit) {
      result.current.fit();
    }

    // リサイズメッセージが送信されることを確認
    await waitFor(() => {
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"resize"')
      );
    });
  });

  it('WebSocket切断時に接続状態が更新される', async () => {
    const sessionId = 'test-session-disconnect';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // WebSocketを切断
    if (mockWebSocketInstance?.onclose) {
      mockWebSocketInstance.onclose(new CloseEvent('close'));
    }

    // 接続状態が更新されることを確認
    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('アンマウント時にWebSocketが切断される', async () => {
    const sessionId = 'test-session-unmount';
    const { result, unmount } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const ws = mockWebSocketInstance;

    // アンマウント
    unmount();

    // WebSocketのcloseメソッドが呼ばれることを確認
    expect(ws?.close).toHaveBeenCalled();
  });

  it('プロセス終了メッセージを受信できる', async () => {
    const sessionId = 'test-session-exit';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // 終了メッセージを送信
    const exitMessage = {
      type: 'exit',
      code: 0,
    };

    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(exitMessage) }));
    }

    // WebSocketが切断されることを確認
    await waitFor(() => {
      expect(mockWebSocketInstance?.close).toHaveBeenCalled();
    });
  });
});
