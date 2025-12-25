import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CreatePRButton } from '../CreatePRButton';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  };
  return {
    default: toast,
    toast,
    Toaster: () => null,
  };
});

describe('CreatePRButton', () => {
  const sessionId = 'test-session-id';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('「PR作成」ボタンが表示される', () => {
    render(<CreatePRButton sessionId={sessionId} />);
    expect(screen.getByText('PR作成')).toBeInTheDocument();
  });

  it('ボタンクリックでAPIが呼ばれる', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, pr_url: 'https://github.com/owner/repo/pull/123' }),
    });

    render(<CreatePRButton sessionId={sessionId} />);
    const button = screen.getByText('PR作成');
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/sessions/${sessionId}/pr`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });

  it('ローディング中はボタンが無効化される', async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pendingPromise);

    render(<CreatePRButton sessionId={sessionId} />);
    const button = screen.getByText('PR作成');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('PR作成中...')).toBeInTheDocument();
    });

    expect(screen.getByRole('button')).toBeDisabled();

    // Clean up
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true, pr_url: 'https://github.com/owner/repo/pull/123' }),
    });
  });

  it('PR作成成功時にトースト通知が表示される', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, pr_url: 'https://github.com/owner/repo/pull/123' }),
    });

    render(<CreatePRButton sessionId={sessionId} />);
    const button = screen.getByText('PR作成');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('PR作成失敗時にエラートースト通知が表示される', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'PR作成に失敗しました', details: 'エラー詳細' }),
    });

    render(<CreatePRButton sessionId={sessionId} />);
    const button = screen.getByText('PR作成');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('PR作成に失敗しました: エラー詳細');
    });
  });

  it('ネットワークエラー時にエラートースト通知が表示される', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    render(<CreatePRButton sessionId={sessionId} />);
    const button = screen.getByText('PR作成');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('PR作成に失敗しました');
    });
  });
});
