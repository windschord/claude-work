/**
 * TerminalPanelコンポーネントのテスト
 * タスク6.7: ターミナル統合(フロントエンド)実装
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalPanel } from '../TerminalPanel';

// useTerminalフックのモック
const mockUseTerminal = vi.fn();

vi.mock('@/hooks/useTerminal', () => ({
  useTerminal: (...args: any[]) => mockUseTerminal(...args),
}));

describe('TerminalPanel', () => {
  beforeEach(() => {
    // デフォルトのモック実装
    mockUseTerminal.mockReturnValue({
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
    });
    vi.clearAllMocks();
  });

  it('ターミナルパネルが表示される', () => {
    render(<TerminalPanel sessionId="test-session-123" />);

    // タイトルが表示される
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('接続状態インジケーターが表示される', () => {
    const { container } = render(<TerminalPanel sessionId="test-session-456" />);

    // 接続状態が表示される（複数存在する可能性があるためgetAllByTextを使用）
    const connectedElements = screen.getAllByText('Connected');
    expect(connectedElements.length).toBeGreaterThan(0);
    expect(connectedElements[0]).toBeInTheDocument();
  });

  it('切断状態が正しく表示される', () => {
    // useTerminalフックを再モック（切断状態）
    mockUseTerminal.mockReturnValue({
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

    render(<TerminalPanel sessionId={sessionId} />);

    // useTerminalフックが正しいsessionIdで呼ばれることを確認
    expect(mockUseTerminal).toHaveBeenCalledWith(sessionId);
  });

  it('ターミナルのopenメソッドが呼ばれる', async () => {
    const mockOpen = vi.fn();
    mockUseTerminal.mockReturnValue({
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
    mockUseTerminal.mockReturnValue({
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
    const { container } = render(
      <TerminalPanel sessionId="test-session-style-connected" />
    );

    // 緑色のドットが表示される
    const greenDot = container.querySelector('.bg-green-500');
    expect(greenDot).toBeInTheDocument();

    // 切断状態に変更
    mockUseTerminal.mockReturnValue({
      terminal: null,
      isConnected: false,
      fit: vi.fn(),
    });

    const { container: disconnectedContainer } = render(
      <TerminalPanel sessionId="test-session-style-disconnected" />
    );

    // 赤色のドットが表示される
    const redDot = disconnectedContainer.querySelector('.bg-red-500');
    expect(redDot).toBeInTheDocument();
  });
});
