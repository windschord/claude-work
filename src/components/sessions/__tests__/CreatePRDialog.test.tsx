import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatePRDialog } from '../CreatePRDialog';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CreatePRDialog', () => {
  const defaultProps = {
    isOpen: true,
    sessionId: 'session-123',
    branchName: 'claude-work/feature-branch',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('フォームが表示される', () => {
    render(<CreatePRDialog {...defaultProps} />);

    expect(screen.getByLabelText(/タイトル/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/説明/i)).toBeInTheDocument();
  });

  it('ブランチ名が表示される', () => {
    render(<CreatePRDialog {...defaultProps} />);

    expect(screen.getByText('claude-work/feature-branch')).toBeInTheDocument();
  });

  it('タイトル未入力時にエラーが表示される', async () => {
    render(<CreatePRDialog {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /作成/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/タイトルは必須です/i)).toBeInTheDocument();
    });
  });

  it('作成ボタンでAPIが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pr_url: 'https://github.com/owner/repo/pull/123',
        pr_number: 123,
      }),
    });

    render(<CreatePRDialog {...defaultProps} />);

    const titleInput = screen.getByLabelText(/タイトル/i);
    fireEvent.change(titleInput, { target: { value: 'Test PR Title' } });

    const submitButton = screen.getByRole('button', { name: /作成/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-123/pr',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });
  });

  it('成功時にonSuccessコールバックが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pr_url: 'https://github.com/owner/repo/pull/123',
        pr_number: 123,
      }),
    });

    const onSuccess = vi.fn();
    render(<CreatePRDialog {...defaultProps} onSuccess={onSuccess} />);

    const titleInput = screen.getByLabelText(/タイトル/i);
    fireEvent.change(titleInput, { target: { value: 'Test PR Title' } });

    const submitButton = screen.getByRole('button', { name: /作成/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        url: 'https://github.com/owner/repo/pull/123',
        number: 123,
      });
    });
  });

  it('isOpen=falseの場合はダイアログが表示されない', () => {
    render(<CreatePRDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByLabelText(/タイトル/i)).not.toBeInTheDocument();
  });

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const onClose = vi.fn();
    render(<CreatePRDialog {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
