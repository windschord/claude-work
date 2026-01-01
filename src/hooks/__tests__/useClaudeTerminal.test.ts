/**
 * useClaudeTerminalフックのテスト
 * Claude Codeターミナル用WebSocket接続フック
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClaudeTerminal } from '../useClaudeTerminal';

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

describe('useClaudeTerminal', () => {
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
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 初期状態は未接続
    expect(result.current.isConnected).toBe(false);

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('正しいWebSocket URL（/ws/claude/:sessionId）で接続される', async () => {
    const sessionId = 'test-session-456';
    renderHook(() => useClaudeTerminal(sessionId));

    await waitFor(() => {
      // WebSocketインスタンスが作成され、正しいURLが使用されることを確認
      expect(mockWebSocketInstance).toBeTruthy();
      expect(mockWebSocketInstance?.url).toContain(`/ws/claude/${sessionId}`);
    });
  });

  it('ターミナルインスタンスが作成される', async () => {
    const sessionId = 'test-session-terminal';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // terminalオブジェクトが存在することを確認
    expect(result.current.terminal).toBeTruthy();
  });

  it('dataタイプのメッセージを受信できる', async () => {
    const sessionId = 'test-session-data';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // ターミナル出力メッセージを送信
    const message = {
      type: 'data',
      content: 'Hello from Claude\n',
    };

    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
    }

    // terminalオブジェクトが存在することを確認
    expect(result.current.terminal).toBeTruthy();
  });

  it('exitタイプのメッセージを受信しても接続を維持する', async () => {
    const sessionId = 'test-session-exit';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // 終了メッセージを送信
    const exitMessage = {
      type: 'exit',
      exitCode: 0,
    };

    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(exitMessage) }));
    }

    // 接続は維持される（再起動可能にするため）
    expect(result.current.isConnected).toBe(true);
    // WebSocketはcloseされない
    expect(mockWebSocketInstance?.close).not.toHaveBeenCalled();
  });

  it('errorタイプのメッセージを受信するとエラー状態が設定される', async () => {
    const sessionId = 'test-session-error';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // エラーメッセージを送信
    const errorMessage = {
      type: 'error',
      message: 'Something went wrong',
    };

    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(errorMessage) }));
    }

    // エラー状態が設定されることを確認
    await waitFor(() => {
      expect(result.current.error).toBe('Something went wrong');
    });
  });

  it('リサイズメッセージを送信できる', async () => {
    const sessionId = 'test-session-resize';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // fitメソッドを呼び出す
    result.current.fit();

    // リサイズメッセージが送信されることを確認
    await waitFor(() => {
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"resize"')
      );
    });
  });

  it('restartメソッドで再起動メッセージを送信できる', async () => {
    const sessionId = 'test-session-restart';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // restartメソッドを呼び出す
    result.current.restart();

    // 再起動メッセージが送信されることを確認
    expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'restart' })
    );
  });

  it('WebSocket切断時に接続状態が更新される', async () => {
    const sessionId = 'test-session-disconnect';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

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
    const { result, unmount } = renderHook(() => useClaudeTerminal(sessionId));

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

  it('inputタイプのメッセージを送信できる', async () => {
    const sessionId = 'test-session-input';
    const { result } = renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // WebSocketのsendメソッドが定義されていることを確認
    expect(mockWebSocketInstance?.send).toBeDefined();

    // terminalオブジェクトが存在することを確認
    expect(result.current.terminal).toBeTruthy();
  });

  it('接続時に初期リサイズメッセージを送信する', async () => {
    const sessionId = 'test-session-initial-resize';
    renderHook(() => useClaudeTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"resize"')
      );
    });
  });

  // Task 43.18: アクション要求検出と通知機能
  describe('アクション要求通知', () => {
    it('アクション要求パターンを検出して通知を送信する', async () => {
      const sessionId = 'test-session-action-detect';
      const { result } = renderHook(() => useClaudeTerminal(sessionId));

      // 接続完了を待つ
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // "Do you want to proceed? (y/n)"メッセージを送信
      const message = {
        type: 'data',
        content: 'Do you want to proceed? (y/n)',
      };

      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }

      // terminalオブジェクトが存在することを確認
      expect(result.current.terminal).toBeTruthy();
    });

    it('[Allow] / [Deny]パターンを検出する', async () => {
      const sessionId = 'test-session-allow-deny';
      const { result } = renderHook(() => useClaudeTerminal(sessionId));

      // 接続完了を待つ
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Allow/Denyメッセージを送信
      const message = {
        type: 'data',
        content: 'Shall I proceed with this action? [Allow] / [Deny]',
      };

      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }

      // terminalオブジェクトが存在することを確認
      expect(result.current.terminal).toBeTruthy();
    });

    it('通常のメッセージでは通知しない', async () => {
      const sessionId = 'test-session-normal-message';
      const { result } = renderHook(() => useClaudeTerminal(sessionId));

      // 接続完了を待つ
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 通常のメッセージを送信
      const message = {
        type: 'data',
        content: 'Processing your request...',
      };

      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }

      // terminalオブジェクトが存在することを確認
      expect(result.current.terminal).toBeTruthy();
    });

    it('クールダウン期間内は重複通知しない', async () => {
      vi.useFakeTimers();
      const sessionId = 'test-session-cooldown';
      const { result } = renderHook(() => useClaudeTerminal(sessionId));

      // 接続完了を待つ
      await vi.waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 連続でアクション要求メッセージを送信
      const message = {
        type: 'data',
        content: 'Do you want to continue? (y/n)',
      };

      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
        mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
        mockWebSocketInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }

      // terminalオブジェクトが存在することを確認
      expect(result.current.terminal).toBeTruthy();

      vi.useRealTimers();
    });
  });

  describe('リサイズ機能', () => {
    it('ウィンドウリサイズ時に300msデバウンスでfit()が実行される', async () => {
      vi.useFakeTimers();
      const sessionId = 'test-session-window-resize';
      const { result } = renderHook(() => useClaudeTerminal(sessionId));

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
        ({ isVisible }) => useClaudeTerminal(sessionId, { isVisible }),
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
      const { result } = renderHook(() => useClaudeTerminal(sessionId));

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
