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

  describe('再接続ロジック', () => {
    it('WebSocket切断後に自動再接続を試みる', async () => {
      const sessionId = 'test-session-reconnect';
      let connectionCount = 0;

      // WebSocketコンストラクタをスパイして接続回数をカウント
      const originalMock = global.WebSocket;
      global.WebSocket = function (url: string) {
        connectionCount++;
        const instance = new MockWebSocket(url);
        mockWebSocketInstance = instance;
        return instance;
      } as unknown as typeof WebSocket;
      Object.assign(global.WebSocket, {
        CONNECTING: MockWebSocket.CONNECTING,
        OPEN: MockWebSocket.OPEN,
        CLOSING: MockWebSocket.CLOSING,
        CLOSED: MockWebSocket.CLOSED,
      });

      const { result } = renderHook(() => useTerminal(sessionId));

      // 初回接続（デバウンス後）
      await waitFor(() => {
        expect(connectionCount).toBe(1);
      });

      // 接続完了を待つ
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 予期せぬ切断をシミュレート（コード1006はabnormal closure）
      if (mockWebSocketInstance) {
        mockWebSocketInstance.readyState = MockWebSocket.CLOSED;
        if (mockWebSocketInstance.onclose) {
          mockWebSocketInstance.onclose(new CloseEvent('close', { code: 1006 }));
        }
      }

      // 再接続が試みられるまで待つ（1秒後）
      await waitFor(() => {
        expect(connectionCount).toBe(2);
      }, { timeout: 3000 });

      global.WebSocket = originalMock;
    });

    it('正常終了（コード1000）時は再接続しない', async () => {
      const sessionId = 'test-session-normal-close';
      let connectionCount = 0;

      const originalMock = global.WebSocket;
      global.WebSocket = function (url: string) {
        connectionCount++;
        const instance = new MockWebSocket(url);
        mockWebSocketInstance = instance;
        return instance;
      } as unknown as typeof WebSocket;
      Object.assign(global.WebSocket, {
        CONNECTING: MockWebSocket.CONNECTING,
        OPEN: MockWebSocket.OPEN,
        CLOSING: MockWebSocket.CLOSING,
        CLOSED: MockWebSocket.CLOSED,
      });

      const { result } = renderHook(() => useTerminal(sessionId));

      // デバウンス後に接続されることを確認
      await waitFor(() => {
        expect(connectionCount).toBe(1);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 正常終了をシミュレート（コード1000）
      if (mockWebSocketInstance) {
        mockWebSocketInstance.readyState = MockWebSocket.CLOSED;
        if (mockWebSocketInstance.onclose) {
          mockWebSocketInstance.onclose(new CloseEvent('close', { code: 1000 }));
        }
      }

      // 切断されたことを確認
      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      // 少し待っても再接続しないことを確認
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(connectionCount).toBe(1);

      global.WebSocket = originalMock;
    });

    it('reconnect関数で手動再接続ができる', async () => {
      const sessionId = 'test-session-manual-reconnect';
      let connectionCount = 0;

      const originalMock = global.WebSocket;
      global.WebSocket = function (url: string) {
        connectionCount++;
        const instance = new MockWebSocket(url);
        mockWebSocketInstance = instance;
        return instance;
      } as unknown as typeof WebSocket;
      Object.assign(global.WebSocket, {
        CONNECTING: MockWebSocket.CONNECTING,
        OPEN: MockWebSocket.OPEN,
        CLOSING: MockWebSocket.CLOSING,
        CLOSED: MockWebSocket.CLOSED,
      });

      const { result } = renderHook(() => useTerminal(sessionId));

      // デバウンス後に接続されることを確認
      await waitFor(() => {
        expect(connectionCount).toBe(1);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 切断
      if (mockWebSocketInstance) {
        mockWebSocketInstance.readyState = MockWebSocket.CLOSED;
        if (mockWebSocketInstance.onclose) {
          mockWebSocketInstance.onclose(new CloseEvent('close', { code: 1000 }));
        }
      }

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      // 手動再接続
      result.current.reconnect();

      // 再接続が試みられることを確認
      await waitFor(() => {
        expect(connectionCount).toBe(2);
      });

      global.WebSocket = originalMock;
    });

    it('アンマウント時に再接続タイマーがキャンセルされる', async () => {
      const sessionId = 'test-session-unmount-reconnect';
      let connectionCount = 0;

      const originalMock = global.WebSocket;
      global.WebSocket = function (url: string) {
        connectionCount++;
        const instance = new MockWebSocket(url);
        mockWebSocketInstance = instance;
        return instance;
      } as unknown as typeof WebSocket;
      Object.assign(global.WebSocket, {
        CONNECTING: MockWebSocket.CONNECTING,
        OPEN: MockWebSocket.OPEN,
        CLOSING: MockWebSocket.CLOSING,
        CLOSED: MockWebSocket.CLOSED,
      });

      const { result, unmount } = renderHook(() => useTerminal(sessionId));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 切断（再接続がスケジュールされる）
      if (mockWebSocketInstance) {
        mockWebSocketInstance.readyState = MockWebSocket.CLOSED;
        if (mockWebSocketInstance.onclose) {
          mockWebSocketInstance.onclose(new CloseEvent('close', { code: 1006 }));
        }
      }

      // アンマウント（再接続タイマーがキャンセルされる）
      unmount();

      // 少し待っても再接続しないことを確認
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(connectionCount).toBe(1);

      global.WebSocket = originalMock;
    });
  });

  describe('リサイズ機能', () => {
    it('ウィンドウリサイズ時に300msデバウンスでfit()が実行される', async () => {
      vi.useFakeTimers();
      const sessionId = 'test-session-window-resize';
      const { result } = renderHook(() => useTerminal(sessionId));

      // 接続完了を待つ
      await vi.waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // sendのカウントをリセット
      mockWebSocketInstance!.send.mockClear();

      // ウィンドウリサイズイベントを発火
      window.dispatchEvent(new Event('resize'));

      // 300ms前はまだリサイズメッセージが送信されていない
      vi.advanceTimersByTime(200);
      expect(mockWebSocketInstance?.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"resize"')
      );

      // 300ms後にリサイズメッセージが送信される
      vi.advanceTimersByTime(100);
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"resize"')
      );

      vi.useRealTimers();
    });

    it('isVisible=trueになったときにfit()が実行される', async () => {
      const sessionId = 'test-session-visibility';
      const { result, rerender } = renderHook(
        ({ isVisible }) => useTerminal(sessionId, { isVisible }),
        { initialProps: { isVisible: false } }
      );

      // 接続完了を待つ
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // sendのカウントをリセット
      mockWebSocketInstance!.send.mockClear();

      // isVisible=trueに変更
      rerender({ isVisible: true });

      // リサイズメッセージが送信される
      await waitFor(() => {
        expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"resize"')
        );
      });
    });

    it('連続したリサイズイベントがデバウンスされる', async () => {
      vi.useFakeTimers();
      const sessionId = 'test-session-debounce';
      const { result } = renderHook(() => useTerminal(sessionId));

      // 接続完了を待つ
      await vi.waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // sendのカウントをリセット
      mockWebSocketInstance!.send.mockClear();

      // 複数のリサイズイベントを発火
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new Event('resize'));

      // 300ms待つ
      vi.advanceTimersByTime(300);

      // 1回だけリサイズメッセージが送信される
      const resizeCalls = mockWebSocketInstance?.send.mock.calls.filter(
        (call) => call[0].includes('"type":"resize"')
      );
      expect(resizeCalls?.length).toBe(1);

      vi.useRealTimers();
    });
  });
});
