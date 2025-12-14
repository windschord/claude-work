import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MergeModal } from '../MergeModal';
import { useAppStore } from '@/store';

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('MergeModal', () => {
  const mockMerge = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const sessionId = 'test-session-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('モーダルが閉じている時は何も表示されない', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={false}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByText('mainブランチにマージ')).not.toBeInTheDocument();
  });

  it('モーダルが開いている時にタイトルと入力フォームが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('mainブランチにマージ')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('コミットメッセージを入力')).toBeInTheDocument();
  });

  it('コミットメッセージを入力できる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByPlaceholderText('コミットメッセージを入力') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'テスト用コミットメッセージ' } });

    expect(textarea.value).toBe('テスト用コミットメッセージ');
  });

  it('「マージ」ボタンクリックでmerge関数が呼ばれる', async () => {
    mockMerge.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByPlaceholderText('コミットメッセージを入力');
    fireEvent.change(textarea, { target: { value: 'マージコミット' } });

    const mergeButton = screen.getByText('マージ');
    fireEvent.click(mergeButton);

    await waitFor(() => {
      expect(mockMerge).toHaveBeenCalledWith(sessionId, 'マージコミット');
    });
  });

  it('マージ成功後にonSuccessが呼ばれる', async () => {
    mockMerge.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByPlaceholderText('コミットメッセージを入力');
    fireEvent.change(textarea, { target: { value: 'マージコミット' } });

    const mergeButton = screen.getByText('マージ');
    fireEvent.click(mergeButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('「キャンセル」ボタンクリックでonCloseが呼ばれる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByText('キャンセル');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('コミットメッセージが空の場合、マージボタンが無効化される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: false,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const mergeButton = screen.getByText('マージ');
    expect(mergeButton).toBeDisabled();
  });

  it('ローディング中はボタンが無効化される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isGitOperationLoading: true,
      merge: mockMerge,
    });

    render(
      <MergeModal
        isOpen={true}
        sessionId={sessionId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const mergeButton = screen.getByText('マージ');
    const cancelButton = screen.getByText('キャンセル');

    expect(mergeButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });
});
