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

// useEnvironments hookのモック
const mockUseEnvironments = vi.fn();
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: () => mockUseEnvironments(),
}));

describe('AddProjectModal', () => {
  const mockAddProject = vi.fn();
  const mockCloneProject = vi.fn();
  const mockFetchProjects = vi.fn();
  const mockOnClose = vi.fn();

  const renderModal = () => render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);
  const switchToLocalTab = () => {
    fireEvent.click(screen.getByRole('tab', { name: 'ローカル' }));
  };

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
    mockUseEnvironments.mockReturnValue({
      environments: [
        { id: 'env-1', name: 'Default Docker', type: 'DOCKER', is_default: true, description: 'Test env', config: '{}' },
      ],
      isLoading: false,
      error: null,
      hostEnvironmentDisabled: false,
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
    renderModal();
    switchToLocalTab();

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('「追加」ボタンと「キャンセル」ボタンが表示される', () => {
    renderModal();
    switchToLocalTab();

    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('空のパスでは「追加」ボタンが無効化される', () => {
    renderModal();
    switchToLocalTab();

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).toBeDisabled();
  });

  it('パスを入力すると「追加」ボタンが有効化される', () => {
    renderModal();
    switchToLocalTab();

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });

    expect(addButton).not.toBeDisabled();
  });

  it('有効なパスでプロジェクト追加が成功する', async () => {
    mockAddProject.mockResolvedValueOnce(undefined);

    renderModal();
    switchToLocalTab();

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddProject).toHaveBeenCalledWith('/valid/path', 'env-1');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('無効なパスでエラーメッセージが表示される', async () => {
    mockAddProject.mockRejectedValueOnce(new Error('有効なパスを入力してください'));

    renderModal();
    switchToLocalTab();

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

    renderModal();
    switchToLocalTab();

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

    renderModal();
    switchToLocalTab();

    const input = screen.getByPlaceholderText('/path/to/git/repo');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(input, { target: { value: '/valid/path' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('ネットワークエラーが発生しました')).toBeInTheDocument();
    });
  });

  it('キャンセルボタンをクリックするとonCloseが呼ばれる', () => {
    renderModal();
    switchToLocalTab();

    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('ローディング中は「追加」ボタンが無効化される', async () => {
    mockAddProject.mockImplementation(() => new Promise(() => {
      // Promise is never resolved to keep loading state
    }));

    renderModal();
    switchToLocalTab();

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

    it('デフォルトで「リモート」タブが選択されている', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const remoteTab = screen.getByRole('tab', { name: 'リモート' });
      expect(remoteTab).toHaveAttribute('aria-selected', 'true');
    });

    it('デフォルトでRemoteRepoFormが表示される', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByPlaceholderText('https://github.com/user/repo.git')).toBeInTheDocument();
    });

    it('「ローカル」タブをクリックするとローカルフォームが表示される', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const localTab = screen.getByRole('tab', { name: 'ローカル' });

      fireEvent.click(localTab);

      expect(screen.getByPlaceholderText('/path/to/git/repo')).toBeInTheDocument();
    });
  });

  describe('HOST環境無効化時のタブ制御', () => {
    it('hostEnvironmentDisabled=trueの場合、ローカルタブが非表示になる', () => {
      mockUseEnvironments.mockReturnValue({
        environments: [
          { id: 'env-1', name: 'Default Docker', type: 'DOCKER', is_default: true, description: 'Test env', config: '{}' },
        ],
        isLoading: false,
        error: null,
        hostEnvironmentDisabled: true,
      });

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByRole('tab', { name: 'ローカル' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'リモート' })).not.toBeInTheDocument();
    });

    it('hostEnvironmentDisabled=trueの場合、リモートフォームが直接表示される', () => {
      mockUseEnvironments.mockReturnValue({
        environments: [
          { id: 'env-1', name: 'Default Docker', type: 'DOCKER', is_default: true, description: 'Test env', config: '{}' },
        ],
        isLoading: false,
        error: null,
        hostEnvironmentDisabled: true,
      });

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByPlaceholderText('https://github.com/user/repo.git')).toBeInTheDocument();
    });

    it('hostEnvironmentDisabled=falseの場合、両タブが表示される', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('tab', { name: 'ローカル' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'リモート' })).toBeInTheDocument();
    });

    it('環境ロード中はタブもリモートフォームも表示されない', () => {
      mockUseEnvironments.mockReturnValue({
        environments: [],
        isLoading: true,
        error: null,
        hostEnvironmentDisabled: false,
      });

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByRole('tab', { name: 'ローカル' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'リモート' })).not.toBeInTheDocument();
      expect(screen.getByText('環境を読み込み中...')).toBeInTheDocument();
    });
  });

  describe('RemoteRepoForm統合', () => {
    it('リモートタブでcloneが成功するとモーダルが閉じる', async () => {
      mockCloneProject.mockResolvedValueOnce(undefined);

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const urlInput = screen.getByPlaceholderText('https://github.com/user/repo.git');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'https://github.com/test/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockCloneProject).toHaveBeenCalledWith(
          'https://github.com/test/repo.git',
          'env-1',
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

      const urlInput = screen.getByPlaceholderText('https://github.com/user/repo.git');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'https://github.com/test/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockFetchProjects).toHaveBeenCalled();
      });
    });

    it('clone失敗時にエラーメッセージが表示される', async () => {
      mockCloneProject.mockRejectedValueOnce(new Error('リポジトリのcloneに失敗しました'));

      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      const urlInput = screen.getByPlaceholderText('https://github.com/user/repo.git');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'https://github.com/test/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(screen.getByText('リポジトリのcloneに失敗しました')).toBeInTheDocument();
      });
    });

    it('リモートタブのキャンセルボタンでモーダルが閉じる', () => {
      render(<AddProjectModal isOpen={true} onClose={mockOnClose} />);

      // リモートタブのキャンセルボタンをクリック
      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
