import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddProjectWizard } from '../index';

// Mock useEnvironments
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: () => ({
    environments: [
      { id: 'env-1', name: 'Docker Default', type: 'DOCKER', is_default: true, config: '{}', created_at: '', updated_at: '' },
    ],
    isLoading: false,
    error: null,
    fetchEnvironments: vi.fn(),
    hostEnvironmentDisabled: false,
  }),
}));

// Mock useGitHubPATs
vi.mock('@/hooks/useGitHubPATs', () => ({
  useGitHubPATs: () => ({
    pats: [],
    isLoading: false,
    error: null,
    fetchPATs: vi.fn(),
    createPAT: vi.fn(),
  }),
}));

const mockFetchProjects = vi.fn();

// Mock useAppStore
vi.mock('@/store', () => ({
  useAppStore: () => ({
    fetchProjects: mockFetchProjects,
    addProject: vi.fn(),
    cloneProject: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AddProjectWizard', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=trueの時にモーダルが表示される', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('プロジェクトを追加')).toBeInTheDocument();
  });

  it('isOpen=falseの時にモーダルが非表示', () => {
    render(<AddProjectWizard isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('プロジェクトを追加')).not.toBeInTheDocument();
  });

  it('プログレスバーが表示される', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('環境')).toBeInTheDocument();
    expect(screen.getByText('認証')).toBeInTheDocument();
    expect(screen.getByText('リポジトリ')).toBeInTheDocument();
    expect(screen.getByText('セッション')).toBeInTheDocument();
  });

  it('初期ステップはStep 1（環境選択）', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('実行環境を選択')).toBeInTheDocument();
  });

  it('「次へ」ボタンで Step 2 に遷移する', async () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

    const nextButton = screen.getByRole('button', { name: '次へ' });

    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('認証情報設定')).toBeInTheDocument();
    });
  });

  it('Step 2で「戻る」ボタンクリックでStep 1に戻る', async () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

    // Step 2に進む
    const nextButton = screen.getByRole('button', { name: '次へ' });
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('認証情報設定')).toBeInTheDocument();
    });

    // 「戻る」をクリック
    const backButton = screen.getByRole('button', { name: '戻る' });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('実行環境を選択')).toBeInTheDocument();
    });
  });

  it('Step 1では「戻る」ボタンが非表示', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.queryByRole('button', { name: '戻る' })).not.toBeInTheDocument();
  });

  it('「キャンセル」ボタンでonCloseが呼ばれる', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('Step 2から Step 3 に遷移できる', async () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

    // Step 1 -> Step 2
    const nextButton1 = screen.getByRole('button', { name: '次へ' });
    await waitFor(() => { expect(nextButton1).not.toBeDisabled(); });
    fireEvent.click(nextButton1);

    await waitFor(() => {
      expect(screen.getByText('認証情報設定')).toBeInTheDocument();
    });

    // Step 2 -> Step 3
    const nextButton2 = screen.getByRole('button', { name: '次へ' });
    fireEvent.click(nextButton2);

    await waitFor(() => {
      expect(screen.getByText('リポジトリ設定')).toBeInTheDocument();
    });
  });

  describe('プロジェクト作成フロー', () => {
    /** Step 1 -> Step 2 -> Step 3 まで遷移するヘルパー */
    async function navigateToStep3() {
      render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

      // Step 1 -> Step 2
      const nextButton1 = screen.getByRole('button', { name: '次へ' });
      await waitFor(() => { expect(nextButton1).not.toBeDisabled(); });
      fireEvent.click(nextButton1);
      await waitFor(() => {
        expect(screen.getByText('認証情報設定')).toBeInTheDocument();
      });

      // Step 2 -> Step 3
      const nextButton2 = screen.getByRole('button', { name: '次へ' });
      fireEvent.click(nextButton2);
      await waitFor(() => {
        expect(screen.getByText('リポジトリ設定')).toBeInTheDocument();
      });
    }

    it('ローカルプロジェクト追加のfetch呼び出しにenvironment_idが含まれる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ project: { id: 'proj-1' } }),
      });
      global.fetch = mockFetch;
      mockFetchProjects.mockResolvedValue(undefined);

      await navigateToStep3();

      // ローカルパスを入力
      const pathInput = screen.getByPlaceholderText('/path/to/git/repo');
      fireEvent.change(pathInput, { target: { value: '/tmp/my-repo' } });

      // 「次へ」でプロジェクト作成を実行
      const nextButton = screen.getByRole('button', { name: '次へ' });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
          method: 'POST',
        }));
      });

      // fetch呼び出しのbodyを検証
      const callArgs = mockFetch.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === '/api/projects'
      );
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1].body as string);
      expect(body).toHaveProperty('environment_id', 'env-1');
      expect(body).toHaveProperty('path', '/tmp/my-repo');
    });

    it('リモートプロジェクトcloneのfetch呼び出しにenvironment_idが含まれる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ project: { id: 'proj-2' } }),
      });
      global.fetch = mockFetch;
      mockFetchProjects.mockResolvedValue(undefined);

      await navigateToStep3();

      // リモートに切り替え
      const remoteButton = screen.getByText('リモート');
      fireEvent.click(remoteButton);

      // URL入力
      const urlInput = screen.getByPlaceholderText('git@github.com:user/repo.git');
      fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });

      // 「次へ」でプロジェクト作成を実行
      const nextButton = screen.getByRole('button', { name: '次へ' });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/projects/clone', expect.objectContaining({
          method: 'POST',
        }));
      });

      // fetch呼び出しのbodyを検証
      const callArgs = mockFetch.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === '/api/projects/clone'
      );
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1].body as string);
      expect(body).toHaveProperty('environment_id', 'env-1');
      expect(body).toHaveProperty('url', 'https://github.com/user/repo.git');
    });

    it('ローカルプロジェクト追加成功時にStep 4に遷移する', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ project: { id: 'proj-1' } }),
      });
      global.fetch = mockFetch;
      mockFetchProjects.mockResolvedValue(undefined);

      await navigateToStep3();

      // ローカルパスを入力
      const pathInput = screen.getByPlaceholderText('/path/to/git/repo');
      fireEvent.change(pathInput, { target: { value: '/tmp/my-repo' } });

      // 「次へ」でプロジェクト作成を実行
      const nextButton = screen.getByRole('button', { name: '次へ' });
      fireEvent.click(nextButton);

      // Step 4に遷移
      await waitFor(() => {
        expect(screen.getByText('プロジェクトを追加しました')).toBeInTheDocument();
      });
    });

    it('プロジェクト作成失敗時にStep 4でエラーが表示される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'テスト用エラーメッセージ' }),
      });
      global.fetch = mockFetch;

      await navigateToStep3();

      // ローカルパスを入力
      const pathInput = screen.getByPlaceholderText('/path/to/git/repo');
      fireEvent.change(pathInput, { target: { value: '/tmp/bad-repo' } });

      // 「次へ」でプロジェクト作成を実行
      const nextButton = screen.getByRole('button', { name: '次へ' });
      fireEvent.click(nextButton);

      // Step 4にエラー表示で遷移
      await waitFor(() => {
        expect(screen.getByText('プロジェクト追加に失敗しました')).toBeInTheDocument();
        expect(screen.getByText('テスト用エラーメッセージ')).toBeInTheDocument();
      });
    });

    it('プロジェクト作成失敗時に「もう一度試す」でStep 3に戻れる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'テスト用エラー' }),
      });
      global.fetch = mockFetch;

      await navigateToStep3();

      // ローカルパスを入力
      const pathInput = screen.getByPlaceholderText('/path/to/git/repo');
      fireEvent.change(pathInput, { target: { value: '/tmp/bad-repo' } });

      // 「次へ」でプロジェクト作成を実行
      const nextButton = screen.getByRole('button', { name: '次へ' });
      fireEvent.click(nextButton);

      // Step 4にエラー表示で遷移
      await waitFor(() => {
        expect(screen.getByText('プロジェクト追加に失敗しました')).toBeInTheDocument();
      });

      // 「もう一度試す」をクリック
      const retryButton = screen.getByRole('button', { name: 'もう一度試す' });
      fireEvent.click(retryButton);

      // Step 3に戻る
      await waitFor(() => {
        expect(screen.getByText('リポジトリ設定')).toBeInTheDocument();
      });
    });
  });
});
