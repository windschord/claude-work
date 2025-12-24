import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessStatus } from '../ProcessStatus';

describe('ProcessStatus', () => {
  const mockOnRestart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('プロセスが実行中の場合', () => {
    it('緑のバッジが表示される', () => {
      render(<ProcessStatus running={true} loading={false} onRestart={mockOnRestart} />);

      const badge = screen.getByTestId('process-status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('「実行中」のテキストが表示される', () => {
      render(<ProcessStatus running={true} loading={false} onRestart={mockOnRestart} />);

      expect(screen.getByText('実行中')).toBeInTheDocument();
    });

    it('実行中のアイコンが表示される', () => {
      render(<ProcessStatus running={true} loading={false} onRestart={mockOnRestart} />);

      const icon = screen.getByTestId('process-status-icon-running');
      expect(icon).toBeInTheDocument();
    });

    it('再起動ボタンが表示されない', () => {
      render(<ProcessStatus running={true} loading={false} onRestart={mockOnRestart} />);

      expect(screen.queryByRole('button', { name: /再起動/ })).not.toBeInTheDocument();
    });
  });

  describe('プロセスが停止中の場合', () => {
    it('赤のバッジが表示される', () => {
      render(<ProcessStatus running={false} loading={false} onRestart={mockOnRestart} />);

      const badge = screen.getByTestId('process-status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });

    it('「停止」のテキストが表示される', () => {
      render(<ProcessStatus running={false} loading={false} onRestart={mockOnRestart} />);

      expect(screen.getByText('停止')).toBeInTheDocument();
    });

    it('停止中のアイコンが表示される', () => {
      render(<ProcessStatus running={false} loading={false} onRestart={mockOnRestart} />);

      const icon = screen.getByTestId('process-status-icon-stopped');
      expect(icon).toBeInTheDocument();
    });

    it('再起動ボタンが表示される', () => {
      render(<ProcessStatus running={false} loading={false} onRestart={mockOnRestart} />);

      const button = screen.getByRole('button', { name: /再起動/ });
      expect(button).toBeInTheDocument();
    });

    it('再起動ボタンをクリックするとonRestartが呼ばれる', () => {
      render(<ProcessStatus running={false} loading={false} onRestart={mockOnRestart} />);

      const button = screen.getByRole('button', { name: /再起動/ });
      fireEvent.click(button);

      expect(mockOnRestart).toHaveBeenCalledTimes(1);
    });
  });

  describe('ローディング中の場合', () => {
    it('スピナーが表示される', () => {
      render(<ProcessStatus running={false} loading={true} onRestart={mockOnRestart} />);

      const spinner = screen.getByTestId('process-status-spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('スピナーにanimate-spinクラスが設定されている', () => {
      render(<ProcessStatus running={false} loading={true} onRestart={mockOnRestart} />);

      const spinner = screen.getByTestId('process-status-spinner');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('バッジが表示されない', () => {
      render(<ProcessStatus running={false} loading={true} onRestart={mockOnRestart} />);

      expect(screen.queryByTestId('process-status-badge')).not.toBeInTheDocument();
    });

    it('再起動ボタンが表示されない', () => {
      render(<ProcessStatus running={false} loading={true} onRestart={mockOnRestart} />);

      expect(screen.queryByRole('button', { name: /再起動/ })).not.toBeInTheDocument();
    });
  });

  describe('再起動ボタンの状態', () => {
    it('停止中でローディング中の場合、再起動ボタンが無効化される', () => {
      render(<ProcessStatus running={false} loading={true} onRestart={mockOnRestart} />);

      const button = screen.queryByRole('button', { name: /再起動/ });
      expect(button).not.toBeInTheDocument();
    });

    it('停止中でローディング中でない場合、再起動ボタンが有効化される', () => {
      render(<ProcessStatus running={false} loading={false} onRestart={mockOnRestart} />);

      const button = screen.getByRole('button', { name: /再起動/ });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });
});
