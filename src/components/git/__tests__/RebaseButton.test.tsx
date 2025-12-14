import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RebaseButton } from '../RebaseButton';
import { useAppStore } from '@/store';
import toast from 'react-hot-toast';

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RebaseButton', () => {
  const mockRebase = vi.fn();
  const sessionId = 'test-session-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('「mainから取り込み」ボタンが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      conflictFiles: null,
      rebase: mockRebase,
    });

    render(<RebaseButton sessionId={sessionId} />);
    expect(screen.getByText('mainから取り込み')).toBeInTheDocument();
  });

  it('ボタンクリックでrebase関数が呼ばれる', async () => {
    mockRebase.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      conflictFiles: null,
      rebase: mockRebase,
    });

    render(<RebaseButton sessionId={sessionId} />);
    const button = screen.getByText('mainから取り込み');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRebase).toHaveBeenCalledWith(sessionId);
    });
  });

  it('ローディング中はボタンが無効化されスピナーが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: true,
      conflictFiles: null,
      rebase: mockRebase,
    });

    render(<RebaseButton sessionId={sessionId} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('処理中...')).toBeInTheDocument();
  });

  it('rebase成功時にトースト通知が表示される', async () => {
    mockRebase.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      conflictFiles: null,
      rebase: mockRebase,
    });

    render(<RebaseButton sessionId={sessionId} />);
    const button = screen.getByText('mainから取り込み');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('rebase成功');
    });
  });

  it('rebase失敗時にエラートースト通知が表示される', async () => {
    mockRebase.mockRejectedValue(new Error('rebaseに失敗しました'));
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      conflictFiles: null,
      rebase: mockRebase,
    });

    render(<RebaseButton sessionId={sessionId} />);
    const button = screen.getByText('mainから取り込み');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('rebaseに失敗しました');
    });
  });
});
