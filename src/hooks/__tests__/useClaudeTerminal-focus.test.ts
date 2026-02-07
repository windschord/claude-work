/**
 * useClaudeTerminalフック - フォーカス状態管理テスト
 * T-001: isFocused stateのテスト
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

describe('useClaudeTerminal - フォーカス状態管理', () => {
  let mockWebSocketInstance: MockWebSocket | null = null;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;

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
    global.WebSocket = originalWebSocket;
  });

  it('isFocusedの初期値がfalseである', () => {
    const { result } = renderHook(() => useClaudeTerminal('test-focus-init'));
    expect(result.current.isFocused).toBe(false);
  });

  it('ターミナル作成後にisFocusedがReturnに含まれる', async () => {
    const { result } = renderHook(() => useClaudeTerminal('test-focus-return'));

    await waitFor(() => {
      expect(result.current.terminal).toBeTruthy();
    });

    expect(typeof result.current.isFocused).toBe('boolean');
  });

  it('isFocusedがboolean型である', () => {
    const { result } = renderHook(() => useClaudeTerminal('test-focus-type'));
    expect(result.current.isFocused).toBe(false);
    expect(typeof result.current.isFocused).toBe('boolean');
  });
});
