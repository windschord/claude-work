import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddProjectModal } from '../AddProjectModal';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// GitHub PAT hookのモック
vi.mock('@/hooks/useGitHubPATs', () => ({
  useGitHubPATs: vi.fn(() => ({
    pats: [],
    isLoading: false,
  })),
}));

describe('AddProjectModal', () => {
  const mockAddProject = vi.fn();
  const mockCloneProject = vi.fn();
  const mockFetchProjects = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddProject.mockResolvedValue(undefined);
    mockCloneProject.mockResolvedValue(undefined);
    mockFetchProjects.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      addProject: mockAddProject,
      cloneProject: mockCloneProject,
      fetchProjects: mockFetchProjects,
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

  it('キャンセルボタンをクリックするとonCloseが呼ばれる', () => {
    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('ローディング中は「追加」ボタンが無効化される', async () => {
    mockAddProject.mockImplementation(() => new Promise(() => {
      // Promise is never resolved to keep loading state
    }));

    render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(addButton).toBeDisabled();
    });
  });

  // --- タブUIとRemoteRepoForm統合のテストケース ---

  describe('タブUI', () => {
    it('「ローカル」と「リモート」タブが表示される', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('tab', { name: 'ローカル' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'リモート' })).toBeInTheDocument();
    });

    it('デフォルトで「ローカル」タブが選択されている', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const localTab = screen.getByRole('tab', { name: 'ローカル' });
      expect(localTab).toHaveAttribute('aria-selected', 'true');
    });

    it('「リモート」タブをクリックするとRemoteRepoFormが表示される', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      fireEvent.click(remoteTab);

      expect(screen.getByPlaceholderText('git@github.com:user/repo.git')).toBeInTheDocument();
    });

    it('「ローカル」タブに戻るとローカルフォームが表示される', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      const localTab = screen.getByRole('tab', { name: 'ローカル' });

      fireEvent.click(remoteTab);
      fireEvent.click(localTab);

      expect(screen.getByPlaceholderText('/path/to/git/repo')).toBeInTheDocument();
    });
  });

  describe('RemoteRepoForm統合', () => {
    it('リモートタブでcloneが成功するとモーダルが閉じる', async () => {
      mockCloneProject.mockResolvedValueOnce(undefined);

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      fireEvent.click(remoteTab);

      const urlInput = screen.getByPlaceholderText('git@github.com:user/repo.git');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'git@github.com:test/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockCloneProject).toHaveBeenCalledWith(
          'git@github.com:test/repo.git',
          undefined,
          'docker',
          undefined
        );
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('clone成功後にプロジェクト一覧が更新される', async () => {
      mockCloneProject.mockResolvedValueOnce(undefined);

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      fireEvent.click(remoteTab);

      const urlInput = screen.getByPlaceholderText('git@github.com:user/repo.git');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'git@github.com:test/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockFetchProjects).toHaveBeenCalled();
      });
    });

    it('clone失敗時にエラーメッセージが表示される', async () => {
      mockCloneProject.mockRejectedValueOnce(new Error('リポジトリのcloneに失敗しました'));

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      fireEvent.click(remoteTab);

      const urlInput = screen.getByPlaceholderText('git@github.com:user/repo.git');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'git@github.com:test/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(screen.getByText('リポジトリのcloneに失敗しました')).toBeInTheDocument();
      });
    });

    it('リモートタブのキャンセルボタンでモーダルが閉じる', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      fireEvent.click(remoteTab);

      const cancelButtons = screen.getAllByRole('button', { name: 'キャンセル' });
      // リモートタブのキャンセルボタンをクリック（2番目のキャンセルボタン）
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
