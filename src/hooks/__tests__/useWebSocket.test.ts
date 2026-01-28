import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import type { ServerMessage } from '@/types/websocket';

// WebSocketモック
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

    // 非同期でopenイベントを発火
    // Note: vi.useFakeTimers()を使用している場合は、手動でopenイベントを発火する必要がある
    // 何もしない（手動でsimulateOpen()を呼ぶ必要がある）
  }

  // テスト用ヘルパーメソッド: 手動でopenイベントを発火
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  send(_data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // 送信処理のモック（実際には何もしない）
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  // テスト用ヘルパーメソッド
  simulateMessage(data: ServerMessage): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code: number = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code }));
    }
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    // グローバルなWebSocketをモックで置き換え
     
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should establish WebSocket connection', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // 初期状態はconnecting
    expect(result.current.status).toBe('connecting');

    // WebSocketが作成されていることを確認
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain(`/ws/sessions/${sessionId}`);

    // openイベントをシミュレート
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // 接続完了後はconnected
    expect(result.current.status).toBe('connected');
  });

  it('should call onMessage callback when receiving message', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    renderHook(() => useWebSocket(sessionId, onMessage));

    // WebSocket接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const testMessage: ServerMessage = {
      type: 'output',
      content: 'Test output',
    };

    // メッセージ受信をシミュレート
    await act(async () => {
      MockWebSocket.instances[0].simulateMessage(testMessage);
    });

    // onMessageが呼ばれることを確認
    expect(onMessage).toHaveBeenCalledWith(testMessage);
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('should send message', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // WebSocket接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const sendSpy = vi.spyOn(MockWebSocket.instances[0], 'send');

    // メッセージ送信
    act(() => {
      result.current.send({ type: 'input', content: 'Test input' });
    });

    // sendが呼ばれることを確認
    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({ type: 'input', content: 'Test input' })
    );
  });

  it('should auto-reconnect on disconnect', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // 初回接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');
    expect(MockWebSocket.instances).toHaveLength(1);

    // 切断をシミュレート
    await act(async () => {
      MockWebSocket.instances[0].simulateClose(1006); // 異常切断
    });

    expect(result.current.status).toBe('disconnected');

    // 1秒後に再接続（1回目の再接続間隔）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // 新しいWebSocket接続が作成される
    expect(MockWebSocket.instances).toHaveLength(2);

    // 再接続が成功
    await act(async () => {
      MockWebSocket.instances[1].simulateOpen();
    });

    expect(result.current.status).toBe('connected');
  });

  it('should use exponential backoff for reconnection', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // 初回接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    // 複数回切断して再接続間隔を確認
    for (let i = 0; i < 3; i++) {
      const expectedDelay = 1000 * Math.pow(2, i);

      // 切断をシミュレート
      await act(async () => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateClose(1006);
      });

      expect(result.current.status).toBe('disconnected');

      // 期待される遅延時間後に再接続
      await act(async () => {
        await vi.advanceTimersByTimeAsync(expectedDelay);
      });

      // 接続を確立
      await act(async () => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateOpen();
      });

      expect(result.current.status).toBe('connected');
    }
  });

  it('should stop reconnecting after max attempts', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // 初回接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    // 最大5回連続で失敗する再接続を試みる
    for (let i = 0; i < 6; i++) {
      // 切断をシミュレート（常に最新のWebSocketを取得）
      await act(async () => {
        const lastWS = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        lastWS.simulateClose(1006);
      });

      // 5回目までは再接続を試みる
      if (i < 5) {
        expect(result.current.status).toBe('disconnected');

        // 再接続待機
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000 * Math.pow(2, i));
        });

        // 新しいWebSocketが作成されたが、openイベントは発火しない
      } else {
        // 6回目の切断で、最大再接続回数を超えたためerrorになる
        expect(result.current.status).toBe('error');

        // 長時間待機しても再接続しない
        const instanceCount = MockWebSocket.instances.length;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100000);
        });

        // 新しい接続は作成されない
        expect(MockWebSocket.instances).toHaveLength(instanceCount);
      }
    }
  });

  it('should close connection on unmount', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result, unmount } = renderHook(() => useWebSocket(sessionId, onMessage));

    // WebSocket接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    const closeSpy = vi.spyOn(MockWebSocket.instances[0], 'close');

    // アンマウント
    unmount();

    // closeが呼ばれることを確認
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should disconnect manually', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // WebSocket接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    const closeSpy = vi.spyOn(MockWebSocket.instances[0], 'close');

    // 手動で切断
    act(() => {
      result.current.disconnect();
    });

    // closeが呼ばれることを確認
    expect(closeSpy).toHaveBeenCalled();

    // 切断後は再接続しない
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('should handle error event', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    renderHook(() => useWebSocket(sessionId, onMessage));

    // WebSocket接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // エラーイベントをシミュレート
    await act(async () => {
      MockWebSocket.instances[0].simulateError();
    });

    // エラーがログ出力されることを確認
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should handle invalid JSON in message', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    renderHook(() => useWebSocket(sessionId, onMessage));

    // WebSocket接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 不正なJSONメッセージを送信
    await act(async () => {
      if (MockWebSocket.instances[0].onmessage) {
        MockWebSocket.instances[0].onmessage(
          new MessageEvent('message', { data: 'invalid json' })
        );
      }
    });

    // onMessageは呼ばれない
    expect(onMessage).not.toHaveBeenCalled();

    // エラーがログ出力される
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should reset reconnect count on successful connection', async () => {
    const onMessage = vi.fn();
    const sessionId = 'test-session-id';

    const { result } = renderHook(() => useWebSocket(sessionId, onMessage));

    // 初回接続を確立
    await act(async () => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // 1回切断して再接続
    await act(async () => {
      MockWebSocket.instances[0].simulateClose(1006);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // 1秒（1回目の再接続間隔）
    });

    await act(async () => {
      MockWebSocket.instances[1].simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    // 再度切断
    await act(async () => {
      MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateClose(1006);
    });

    // 再接続間隔が1秒（リセットされている）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });

    const instanceCountBefore = MockWebSocket.instances.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // 1秒後に再接続される
    expect(MockWebSocket.instances.length).toBe(instanceCountBefore + 1);
  });
});
