/**
 * ClaudeTerminalPanelコンポーネントのテスト
 * Claude Code専用ターミナルUIのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClaudeTerminalPanel } from '../ClaudeTerminalPanel';

// useClaudeTerminalフックをモック
const mockFit = vi.fn();
const mockRestart = vi.fn();

// モックの戻り値を保持する変数
let mockReturnValue = {
  terminal: null as unknown,
  isConnected: false,
  fit: mockFit,
  restart: mockRestart,
  error: null as string | null,
};

vi.mock('@/hooks/useClaudeTerminal', () => ({
  useClaudeTerminal: vi.fn(() => mockReturnValue),
}));

// IntersectionObserverをモック
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor() {}
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// requestAnimationFrameをモック
global.requestAnimationFrame = vi.fn((callback) => {
  callback(0);
  return 0;
});

describe('ClaudeTerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック値にリセット
    mockReturnValue = {
      terminal: null,
      isConnected: false,
      fit: mockFit,
      restart: mockRestart,
      error: null,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('コンポーネントが正常にレンダリングされる', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    // コンポーネントがレンダリングされることを確認
    // 初期状態またはマウント後の状態のいずれかを確認
    await waitFor(() => {
      // ヘッダーかローディングメッセージのどちらかが表示される
      expect(screen.queryByText('Claude Code') || screen.queryByText('Loading Claude Code...')).toBeTruthy();
    });
  });

  it('マウント後にヘッダーを表示する', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    // マウント後にヘッダーが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });
  });

  it('接続状態が表示される', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      // 未接続状態の場合
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('接続時は「Connected」と表示される', async () => {
    // モック値を更新
    mockReturnValue = {
      terminal: null,
      isConnected: true,
      fit: mockFit,
      restart: mockRestart,
      error: null,
    };

    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('再起動ボタンがクリックできる', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      expect(screen.getByText('Restart')).toBeInTheDocument();
    });

    const restartButton = screen.getByText('Restart');
    fireEvent.click(restartButton);

    expect(mockRestart).toHaveBeenCalled();
  });

  it('エラー時はエラーメッセージを表示する', async () => {
    // モック値を更新
    mockReturnValue = {
      terminal: null,
      isConnected: false,
      fit: mockFit,
      restart: mockRestart,
      error: 'Connection failed',
    };

    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to initialize Claude terminal')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('isVisible=falseの時はhiddenクラスが適用される', async () => {
    const { container } = render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={false} />
    );

    await waitFor(() => {
      // hiddenクラスを持つ要素が存在することを確認
      expect(container.querySelector('.hidden')).toBeInTheDocument();
    });
  });

  it('isVisible=trueの時はhiddenクラスが適用されない', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      const header = screen.getByText('Claude Code');
      // 親要素にhiddenクラスがないことを確認
      expect(header.closest('.hidden')).toBeNull();
    });
  });

  it('ターミナルエリアにaria-labelが設定される', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      expect(screen.getByRole('application')).toHaveAttribute(
        'aria-label',
        'Claude Code Terminal'
      );
    });
  });

  it('再起動ボタンにタイトル属性が設定される', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session" isVisible={true} />
    );

    await waitFor(() => {
      const restartButton = screen.getByTitle('Restart Claude Code');
      expect(restartButton).toBeInTheDocument();
    });
  });

  it('sessionIdがpropsとして渡される', async () => {
    render(
      <ClaudeTerminalPanel sessionId="test-session-123" isVisible={true} />
    );

    await waitFor(() => {
      // コンポーネントがレンダリングされることを確認
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });
  });
});
