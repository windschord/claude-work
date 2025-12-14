/**
 * TerminalPanelコンポーネントのテスト
 * タスク6.7: ターミナル統合(フロントエンド)実装
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalPanel } from '../TerminalPanel';

// useTerminalフックのモック
vi.mock('@/hooks/useTerminal', () => ({
  useTerminal: vi.fn(() => ({
    terminal: {
      open: vi.fn(),
      write: vi.fn(),
      onData: vi.fn(),
      dispose: vi.fn(),
      cols: 80,
      rows: 24,
    },
    isConnected: true,
    fit: vi.fn(),
  })),
}));

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ターミナルパネルが表示される', () => {
    render(<TerminalPanel sessionId="test-session-123" />);

    // タイトルが表示される
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('接続状態インジケーターが表示される', () => {
    render(<TerminalPanel sessionId="test-session-456" />);

    // 接続状態が表示される
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('切断状態が正しく表示される', () => {
    // useTerminalフックを再モック（切断状態）
    vi.mocked(require('@/hooks/useTerminal').useTerminal).mockReturnValue({
      terminal: null,
      isConnected: false,
      fit: vi.fn(),
    });

    render(<TerminalPanel sessionId="test-session-789" />);

    // 切断状態が表示される
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('ターミナルコンテナが存在する', () => {
    const { container } = render(<TerminalPanel sessionId="test-session-container" />);

    // ターミナルのコンテナ要素が存在することを確認
    const terminalContainer = container.querySelector('[class*="flex-1"]');
    expect(terminalContainer).toBeInTheDocument();
  });

  it('useTerminalフックが正しいsessionIdで呼ばれる', () => {
    const sessionId = 'test-session-hook';
    const mockUseTerminal = vi.mocked(require('@/hooks/useTerminal').useTerminal);

    render(<TerminalPanel sessionId={sessionId} />);

    // useTerminalフックが正しいsessionIdで呼ばれることを確認
    expect(mockUseTerminal).toHaveBeenCalledWith(sessionId);
  });

  it('ターミナルのopenメソッドが呼ばれる', async () => {
    const mockOpen = vi.fn();
    vi.mocked(require('@/hooks/useTerminal').useTerminal).mockReturnValue({
      terminal: {
        open: mockOpen,
        write: vi.fn(),
        onData: vi.fn(),
        dispose: vi.fn(),
        cols: 80,
        rows: 24,
      },
      isConnected: true,
      fit: vi.fn(),
    });

    render(<TerminalPanel sessionId="test-session-open" />);

    // terminalのopenメソッドが呼ばれることを確認
    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
    });
  });

  it('fitメソッドが呼ばれる', async () => {
    const mockFit = vi.fn();
    vi.mocked(require('@/hooks/useTerminal').useTerminal).mockReturnValue({
      terminal: {
        open: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        dispose: vi.fn(),
        cols: 80,
        rows: 24,
      },
      isConnected: true,
      fit: mockFit,
    });

    render(<TerminalPanel sessionId="test-session-fit" />);

    // fitメソッドが呼ばれることを確認
    await waitFor(() => {
      expect(mockFit).toHaveBeenCalled();
    });
  });

  it('接続状態によって適切なスタイルが適用される', () => {
    // 接続状態
    const { rerender, container: connectedContainer } = render(
      <TerminalPanel sessionId="test-session-style" />
    );

    // 緑色のドットが表示される
    const greenDot = connectedContainer.querySelector('.bg-green-500');
    expect(greenDot).toBeInTheDocument();

    // 切断状態に変更
    vi.mocked(require('@/hooks/useTerminal').useTerminal).mockReturnValue({
      terminal: null,
      isConnected: false,
      fit: vi.fn(),
    });

    rerender(<TerminalPanel sessionId="test-session-style" />);

    // 赤色のドットが表示される
    const redDot = connectedContainer.querySelector('.bg-red-500');
    expect(redDot).toBeInTheDocument();
  });
});
