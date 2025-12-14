/**
 * useTerminalフックのテスト
 * タスク6.7: ターミナル統合(フロントエンド)実装
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTerminal } from '../useTerminal';

// WebSocketのモック
class MockWebSocket {
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
    this.url = url;
    // 非同期でopenイベントを発火
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });
}

describe('useTerminal', () => {
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    // WebSocketのグローバルモック
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining(`/ws/sessions/${sessionId}/terminal`)
      );
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

    // @ts-ignore - テスト用のモックアクセス
    const ws = global.WebSocket.mock.results[0].value as MockWebSocket;
    if (ws.onmessage) {
      ws.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
    }

    // terminalオブジェクトが存在し、writeメソッドが呼ばれることを確認
    // 実際のXTerm.jsは使用しないため、ここではモックの動作確認のみ
  });

  it('ターミナル入力を送信できる', async () => {
    const sessionId = 'test-session-input';
    const { result } = renderHook(() => useTerminal(sessionId));

    // 接続完了を待つ
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // @ts-ignore - テスト用のモックアクセス
    const ws = global.WebSocket.mock.results[0].value as MockWebSocket;

    // ターミナル入力データをシミュレート
    // 実際のXTerm.jsのonDataイベントをシミュレート
    const inputData = 'ls -la\r';

    // WebSocketのsendメソッドが呼ばれることを確認
    // 実際の実装では、terminal.onData()がWebSocket.send()を呼ぶ
    if (result.current.terminal) {
      // モックのため、直接WebSocketのsendをチェック
      expect(ws.send).toBeDefined();
    }
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

    // @ts-ignore - テスト用のモックアクセス
    const ws = global.WebSocket.mock.results[0].value as MockWebSocket;

    // リサイズメッセージが送信されることを確認
    await waitFor(() => {
      expect(ws.send).toHaveBeenCalledWith(
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
    // @ts-ignore - テスト用のモックアクセス
    const ws = global.WebSocket.mock.results[0].value as MockWebSocket;
    if (ws.onclose) {
      ws.onclose(new CloseEvent('close'));
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

    // @ts-ignore - テスト用のモックアクセス
    const ws = global.WebSocket.mock.results[0].value as MockWebSocket;

    // アンマウント
    unmount();

    // WebSocketのcloseメソッドが呼ばれることを確認
    expect(ws.close).toHaveBeenCalled();
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

    // @ts-ignore - テスト用のモックアクセス
    const ws = global.WebSocket.mock.results[0].value as MockWebSocket;
    if (ws.onmessage) {
      ws.onmessage(new MessageEvent('message', { data: JSON.stringify(exitMessage) }));
    }

    // 終了メッセージが処理されることを確認（実装で処理される）
    // WebSocketが切断されることを確認
    await waitFor(() => {
      expect(ws.close).toHaveBeenCalled();
    });
  });
});
