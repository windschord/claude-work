import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddProjectModal } from '../AddProjectModal';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('AddProjectModal', () => {
  const mockAddProject = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      addProject: mockAddProject,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('モーダルが開いている時、タイトルが表示される', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('プロジェクトを追加')).toBeInTheDocument();
  });

  it('モーダルが閉じている時、何も表示されない', () => {
    render(<AddProjectModal isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByText('プロジェクトを追加')).not.toBeInTheDocument();
  });

  it('パス入力フォームが表示される', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('「追加」ボタンと「キャンセル」ボタンが表示される', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('空のパスでは「追加」ボタンが無効化される', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).toBeDisabled();
  });

  it('パスを入力すると「追加」ボタンが有効化される', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });

    expect(addButton).not.toBeDisabled();
  });

  it('有効なパスでプロジェクト追加が成功する', async () => {
    mockAddProject.mockResolvedValueOnce(undefined);

    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddProject).toHaveBeenCalledWith('/valid/path');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('無効なパスでエラーメッセージが表示される', async () => {
    mockAddProject.mockRejectedValueOnce(new Error('有効なパスを入力してください'));

    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/invalid/path' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('有効なパスを入力してください')).toBeInTheDocument();
    });
  });

  it('Gitリポジトリでない場合のエラーメッセージが表示される', async () => {
    mockAddProject.mockRejectedValueOnce(
      new Error('指定されたパスはGitリポジトリではありません')
    );

    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/not/a/git/repo' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText('指定されたパスはGitリポジトリではありません')
      ).toBeInTheDocument();
    });
  });

  it('ネットワークエラーで適切なエラーメッセージが表示される', async () => {
    mockAddProject.mockRejectedValueOnce(new Error('ネットワークエラーが発生しました'));

    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('ネットワークエラーが発生しました')).toBeInTheDocument();
    });
  });

  it('「キャンセル」ボタンクリックでモーダルが閉じる', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('ローディング中は「追加」ボタンが無効化される', async () => {
    mockAddProject.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });
    fireEvent.click(addButton);

    expect(addButton).toBeDisabled();
  });
});
