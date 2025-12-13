import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeleteProjectDialog } from '../DeleteProjectDialog';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('DeleteProjectDialog', () => {
  const mockDeleteProject = vi.fn();
  const mockFetchProjects = vi.fn();
  const mockOnClose = vi.fn();

  const mockProject = {
    id: '1',
    name: 'Test Project',
    path: '/path/to/project',
    default_model: 'claude-3-opus',
    run_scripts: [],
    session_count: 3,
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteProject.mockResolvedValue(undefined);
    mockFetchProjects.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      deleteProject: mockDeleteProject,
      fetchProjects: mockFetchProjects,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('ダイアログが開いている時、タイトルが表示される', () => {
    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    expect(screen.getByText('プロジェクトを削除')).toBeInTheDocument();
  });

  it('ダイアログが閉じている時、何も表示されない', () => {
    render(<DeleteProjectDialog isOpen={false} onClose={mockOnClose} project={mockProject} />);

    expect(screen.queryByText('プロジェクトを削除')).not.toBeInTheDocument();
  });

  it('削除確認メッセージが表示される', () => {
    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    expect(screen.getByText(/Test Project.*削除しますか/)).toBeInTheDocument();
  });

  it('worktreeが削除されない旨のメッセージが表示される', () => {
    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    expect(screen.getByText(/worktreeは削除されません/)).toBeInTheDocument();
  });

  it('「削除」ボタンと「キャンセル」ボタンが表示される', () => {
    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('「削除」ボタンクリックでプロジェクトが削除される', async () => {
    mockDeleteProject.mockResolvedValueOnce(undefined);

    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    const deleteButton = screen.getByRole('button', { name: '削除' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('1');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('削除失敗時にエラーメッセージが表示される', async () => {
    mockDeleteProject.mockRejectedValueOnce(new Error('プロジェクトの削除に失敗しました'));

    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    const deleteButton = screen.getByRole('button', { name: '削除' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('プロジェクトの削除に失敗しました')).toBeInTheDocument();
    });
  });

  it('ネットワークエラーで適切なエラーメッセージが表示される', async () => {
    mockDeleteProject.mockRejectedValueOnce(new Error('ネットワークエラーが発生しました'));

    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    const deleteButton = screen.getByRole('button', { name: '削除' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('ネットワークエラーが発生しました')).toBeInTheDocument();
    });
  });

  it('「キャンセル」ボタンクリックでダイアログが閉じる', () => {
    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('ローディング中は「削除」ボタンが無効化される', async () => {
    mockDeleteProject.mockImplementation(() => new Promise(() => {
      // Promise is never resolved to keep loading state
    }));

    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={mockProject} />);

    const deleteButton = screen.getByRole('button', { name: '削除' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteButton).toBeDisabled();
    });
  });

  it('projectがnullの場合、何も表示されない', () => {
    render(<DeleteProjectDialog isOpen={true} onClose={mockOnClose} project={null} />);

    expect(screen.queryByText('プロジェクトを削除')).not.toBeInTheDocument();
  });
});
