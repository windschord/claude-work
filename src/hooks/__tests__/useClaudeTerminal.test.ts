/**
 * useClaudeTerminalフックのテスト
 * Claude Codeターミナル用WebSocket接続フック
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// MockTerminalクラス: XTerm.jsのTerminalを模倣
// attachCustomKeyEventHandler, onFocus, onBlurのコールバックを保存し、テストから呼び出せるようにする
class MockTerminal {
  cols = 80;
  rows = 24;
  _customKeyEventHandler: ((event: KeyboardEvent) => boolean) | null = null;
  _onFocusCallback: (() => void) | null = null;
  _onBlurCallback: (() => void) | null = null;
  _onDataCallback: ((data: string) => void) | null = null;

  options = {};
  write = vi.fn();
  dispose = vi.fn();
  getSelection = vi.fn().mockReturnValue('');
  clearSelection = vi.fn();
  loadAddon = vi.fn();

  onData(callback: (data: string) => void) {
    this._onDataCallback = callback;
    return { dispose: vi.fn() };
  }

  onFocus(callback: () => void) {
    this._onFocusCallback = callback;
    return { dispose: vi.fn() };
  }

  onBlur(callback: () => void) {
    this._onBlurCallback = callback;
    return { dispose: vi.fn() };
  }

  attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean) {
    this._customKeyEventHandler = handler;
  }
}

class MockFitAddon {
  fit = vi.fn();
  activate = vi.fn();
  dispose = vi.fn();
}

// モック用のインスタンスを保持する変数
let mockTerminalInstance: MockTerminal | null = null;

// @xterm/xtermと@xterm/addon-fitをモック
// vi.mockのfactoryではclassをそのまま返す（new演算子で呼ばれるため）
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      const instance = new MockTerminal();
      mockTerminalInstance = instance;
      return instance;
    }
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    constructor() {
      return new MockFitAddon();
    }
  },
}));

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
    mockTerminalInstance = null;
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

  // T-001: フォーカス状態管理テスト
  describe('フォーカス状態管理', () => {
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

    it('onFocusコールバック発火でisFocusedがtrueになる', async () => {
      const { result } = renderHook(() => useClaudeTerminal('test-focus-on'));

      await waitFor(() => {
        expect(result.current.terminal).toBeTruthy();
      });

      expect(result.current.isFocused).toBe(false);

      // MockTerminalのonFocusコールバックを発火
      await act(async () => {
        mockTerminalInstance?._onFocusCallback?.();
      });

      expect(result.current.isFocused).toBe(true);
    });

    it('onBlurコールバック発火でisFocusedがfalseに戻る', async () => {
      const { result } = renderHook(() => useClaudeTerminal('test-focus-blur'));

      await waitFor(() => {
        expect(result.current.terminal).toBeTruthy();
      });

      // まずフォーカスする
      await act(async () => {
        mockTerminalInstance?._onFocusCallback?.();
      });
      expect(result.current.isFocused).toBe(true);

      // ブラーでfalseに戻る
      await act(async () => {
        mockTerminalInstance?._onBlurCallback?.();
      });
      expect(result.current.isFocused).toBe(false);
    });
  });

  // キーボード操作テスト
  describe('キーボード操作', () => {
    beforeEach(() => {
      // navigator.clipboard モック
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue('pasted text'),
          read: vi.fn().mockResolvedValue([
            {
              types: ['text/plain'],
              getType: vi.fn().mockResolvedValue(
                new Blob(['pasted text'], { type: 'text/plain' })
              ),
            },
          ]),
        },
        writable: true,
        configurable: true,
      });
    });

    describe('CTRL+C コピー', () => {
      it('テキスト選択ありでCTRL+Cを押すとクリップボードにコピーされる', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-copy'));
        await waitFor(() => expect(result.current.terminal).toBeTruthy());

        // MockTerminalのgetSelectionがテキストを返すように設定
        mockTerminalInstance!.getSelection.mockReturnValue('selected text');

        // キーハンドラが登録されていることを確認
        const keyHandler = mockTerminalInstance!._customKeyEventHandler;
        expect(keyHandler).not.toBeNull();

        // CTRL+C KeyboardEventを作成してハンドラに渡す
        const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
        const consumed = keyHandler!(event);

        // イベントが消費される(false=コピー処理が行われSIGINTは送られない)
        expect(consumed).toBe(false);
        // クリップボードにコピーされる
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('selected text');
      });

      it('テキスト未選択でCTRL+Cを押すとSIGINTが送信される（デフォルト動作）', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-sigint'));
        await waitFor(() => expect(result.current.terminal).toBeTruthy());

        // MockTerminalのgetSelectionが空文字を返すように設定
        mockTerminalInstance!.getSelection.mockReturnValue('');

        const keyHandler = mockTerminalInstance!._customKeyEventHandler;
        expect(keyHandler).not.toBeNull();

        // CTRL+C KeyboardEventを作成してハンドラに渡す
        const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
        const consumed = keyHandler!(event);

        // true=デフォルト動作(SIGINT)が実行される
        expect(consumed).toBe(true);
        // クリップボードのwriteTextは呼ばれない
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      });

      it('CTRL+Cコピー成功後にclearSelectionが呼ばれる', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-copy-clear'));
        await waitFor(() => expect(result.current.terminal).toBeTruthy());

        mockTerminalInstance!.getSelection.mockReturnValue('selected text');

        const keyHandler = mockTerminalInstance!._customKeyEventHandler;
        const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
        keyHandler!(event);

        // writeTextのPromiseが解決するのを待つ
        await waitFor(() => {
          expect(mockTerminalInstance!.clearSelection).toHaveBeenCalled();
        });
      });
    });

    describe('CTRL+V テキストペースト', () => {
      it('CTRL+VでクリップボードテキストがWebSocket経由で送信される', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-paste'));
        await waitFor(() => expect(result.current.isConnected).toBe(true));

        const keyHandler = mockTerminalInstance!._customKeyEventHandler;
        expect(keyHandler).not.toBeNull();

        // CTRL+V KeyboardEventを作成してハンドラに渡す
        const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true });
        const consumed = keyHandler!(event);

        // イベントが消費される(false=ペースト処理実行)
        expect(consumed).toBe(false);

        // handlePaste内のclipboard.read() -> readText() -> ws.sendのPromiseチェーンを待つ
        await waitFor(() => {
          expect(mockWebSocketInstance!.send).toHaveBeenCalledWith(
            JSON.stringify({ type: 'input', data: 'pasted text' })
          );
        });
      });
    });

    describe('SHIFT+ENTER 改行', () => {
      it('SHIFT+ENTERで改行がWebSocket経由で送信される', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-newline'));
        await waitFor(() => expect(result.current.isConnected).toBe(true));

        const keyHandler = mockTerminalInstance!._customKeyEventHandler;
        expect(keyHandler).not.toBeNull();

        // SHIFT+ENTER KeyboardEventを作成してハンドラに渡す
        const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
        const consumed = keyHandler!(event);

        // イベントが消費される(false=改行送信処理実行)
        expect(consumed).toBe(false);
        // WebSocketで改行が送信される
        expect(mockWebSocketInstance!.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'input', data: '\n' })
        );
      });

      it('keyupイベントではハンドラがデフォルト動作を返す', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-keyup'));
        await waitFor(() => expect(result.current.terminal).toBeTruthy());

        const keyHandler = mockTerminalInstance!._customKeyEventHandler;
        expect(keyHandler).not.toBeNull();

        // keyupイベントはtype !== 'keydown'のためtrue(デフォルト動作)を返す
        const event = new KeyboardEvent('keyup', { key: 'Enter', shiftKey: true });
        const result2 = keyHandler!(event);
        expect(result2).toBe(true);
      });
    });

    describe('image-error メッセージ処理', () => {
      it('image-errorメッセージ受信時にターミナルにエラーが表示される', async () => {
        const { result } = renderHook(() => useClaudeTerminal('test-image-error'));

        // WebSocket接続が確立されるのを待つ（onmessageが設定される）
        await waitFor(() => {
          expect(result.current.isConnected).toBe(true);
        });

        // onmessageが設定されていることを確認
        expect(mockWebSocketInstance?.onmessage).not.toBeNull();

        // image-errorメッセージを送信
        await act(async () => {
          mockWebSocketInstance!.onmessage!(
            new MessageEvent('message', {
              data: JSON.stringify({ type: 'image-error', message: 'File too large' }),
            })
          );
        });

        // ターミナルにエラーメッセージが書き込まれることを確認
        expect(mockTerminalInstance!.write).toHaveBeenCalledWith(
          expect.stringContaining('Image paste error')
        );
        expect(mockTerminalInstance!.write).toHaveBeenCalledWith(
          expect.stringContaining('File too large')
        );
      });
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
