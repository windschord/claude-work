/**
 * useDockerTerminalフックのテスト
 * Docker session用のターミナル接続フック
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDockerTerminal } from '../useDockerTerminal';

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

// xterm.jsのモック
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    cols = 80;
    rows = 24;
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    write = vi.fn();
    dispose = vi.fn();
    open = vi.fn();
  }
  return {
    Terminal: MockTerminal,
  };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn();
    activate = vi.fn();
    dispose = vi.fn();
  }
  return {
    FitAddon: MockFitAddon,
  };
});

describe('useDockerTerminal', () => {
  let mockWebSocketInstance: MockWebSocket | null = null;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // 元のWebSocketを保存
    originalWebSocket = global.WebSocket;

    // WebSocketのグローバルモック
    const MockWebSocketConstructor = function (
      this: WebSocket,
      url: string
    ) {
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

  it('should return terminal instance after initialization', async () => {
    const { result } = renderHook(() => useDockerTerminal('session-123'));

    await waitFor(() => {
      expect(result.current.terminal).toBeTruthy();
    });
  });

  it('should connect to /ws/session/:id endpoint', async () => {
    renderHook(() => useDockerTerminal('session-456'));

    await waitFor(() => {
      expect(mockWebSocketInstance).toBeTruthy();
      expect(mockWebSocketInstance?.url).toContain('/ws/session/session-456');
    });
  });

  it('should set isConnected to true when WebSocket opens', async () => {
    const { result } = renderHook(() => useDockerTerminal('session-123'));

    // 初期状態は未接続
    expect(result.current.isConnected).toBe(false);

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should set isConnected to false when WebSocket closes', async () => {
    const { result } = renderHook(() => useDockerTerminal('session-123'));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // WebSocketを切断
    if (mockWebSocketInstance?.onclose) {
      mockWebSocketInstance.onclose(new CloseEvent('close', { code: 1000 }));
    }

    // 接続状態が更新されることを確認
    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('should send resize message on fit() when connected', async () => {
    const { result } = renderHook(() => useDockerTerminal('session-123'));

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

  it('should reconnect when calling reconnect()', async () => {
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

    const { result } = renderHook(() => useDockerTerminal('session-123'));

    // 初回接続を待つ
    await waitFor(() => {
      expect(connectionCount).toBe(1);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // 手動再接続
    result.current.reconnect();

    // 再接続が試みられることを確認
    await waitFor(() => {
      expect(connectionCount).toBe(2);
    });

    global.WebSocket = originalMock;
  });
});
