import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionModal } from '../CreateSessionModal';

// useEnvironmentsフックのモック
const mockEnvironments = [
  {
    id: 'env-1',
    name: 'Default Host',
    type: 'HOST' as const,
    description: 'デフォルトのホスト環境',
    config: '{}',
    is_default: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'env-2',
    name: 'Docker Env',
    type: 'DOCKER' as const,
    description: 'Docker環境',
    config: '{}',
    is_default: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'env-3',
    name: 'SSH Remote',
    type: 'SSH' as const,
    description: 'SSH接続環境',
    config: '{}',
    is_default: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: vi.fn(() => ({
    environments: mockEnvironments,
    isLoading: false,
    error: null,
    fetchEnvironments: vi.fn(),
    createEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    refreshEnvironment: vi.fn(),
  })),
}));

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CreateSessionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: 'new-session-id' } }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('モーダル表示', () => {
    it('isOpen=trueの場合、モーダルが表示される', () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('新規セッション作成')).toBeInTheDocument();
    });

    it('isOpen=falseの場合、モーダルが表示されない', () => {
      render(
        <CreateSessionModal
          isOpen={false}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('新規セッション作成')).not.toBeInTheDocument();
    });
  });

  describe('環境一覧の表示', () => {
    it('環境一覧がラジオボタンで表示される', () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // 環境名が表示される
      expect(screen.getByText('Default Host')).toBeInTheDocument();
      expect(screen.getByText('Docker Env')).toBeInTheDocument();
      expect(screen.getByText('SSH Remote')).toBeInTheDocument();

      // ラジオボタンが存在する
      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons).toHaveLength(3);
    });

    it('各環境のタイプバッジが表示される', () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('HOST')).toBeInTheDocument();
      expect(screen.getByText('DOCKER')).toBeInTheDocument();
      expect(screen.getByText('SSH')).toBeInTheDocument();
    });

    it('デフォルト環境が初期選択されている', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // Headless UIのRadioGroupはaria-checkedを使用
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        // デフォルト環境（env-1）が選択されている
        expect(radioButtons[0]).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('環境を選択できる', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const radioButtons = screen.getAllByRole('radio');

      // 2番目の環境（Docker Env）を選択
      fireEvent.click(radioButtons[1]);

      // Headless UIのRadioGroupはaria-checkedを使用
      await waitFor(() => {
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
        expect(radioButtons[0]).toHaveAttribute('aria-checked', 'false');
      });
    });
  });

  describe('ボタン', () => {
    it('「作成」ボタンと「キャンセル」ボタンが表示される', () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('button', { name: '作成' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });

    it('キャンセルボタンクリックでonCloseが呼ばれる', () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('セッション作成', () => {
    it('作成ボタンクリックでセッションが作成される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            project_id: 'project-1',
            environment_id: 'env-1', // デフォルト環境
          }),
        });
      });
    });

    it('選択した環境でセッションが作成される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // Docker環境を選択
      const radioButtons = screen.getAllByRole('radio');
      fireEvent.click(radioButtons[1]);

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            project_id: 'project-1',
            environment_id: 'env-2', // Docker環境
          }),
        });
      });
    });

    it('セッション作成成功時にonSuccessが呼ばれる', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith('new-session-id');
      });
    });

    it('セッション作成成功時にモーダルが閉じる', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('作成中は作成ボタンがdisabledになる', async () => {
      // 解決されないPromiseを返してローディング状態を維持
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(createButton).toBeDisabled();
      });
    });

    it('作成中は「作成中...」と表示される', async () => {
      // 解決されないPromiseを返してローディング状態を維持
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '作成中...' })).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('セッション作成失敗時にエラーメッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'セッション作成に失敗しました' }),
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });
    });

    it('ネットワークエラー時にエラーメッセージが表示される', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('エラー時はonSuccessが呼ばれない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'セッション作成に失敗しました' }),
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('エラー時はモーダルが閉じない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'セッション作成に失敗しました' }),
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });

      // onCloseが作成ボタンクリックで呼ばれていないことを確認
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('環境読み込み中', () => {
    it('環境読み込み中はローディング表示される', async () => {
      const { useEnvironments } = await import('@/hooks/useEnvironments');
      vi.mocked(useEnvironments).mockReturnValueOnce({
        environments: [],
        isLoading: true,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('環境を読み込み中...')).toBeInTheDocument();
    });
  });

  describe('デフォルト環境がない場合', () => {
    it('デフォルト環境がない場合、最初の環境が選択される', async () => {
      const noDefaultEnvironments = [
        {
          id: 'env-1',
          name: 'Host Environment',
          type: 'HOST' as const,
          description: 'ホスト環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-2',
          name: 'Docker Environment',
          type: 'DOCKER' as const,
          description: 'Docker環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const { useEnvironments } = await import('@/hooks/useEnvironments');
      vi.mocked(useEnvironments).mockReturnValueOnce({
        environments: noDefaultEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // Headless UIのRadioGroupはaria-checkedを使用
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        // 最初の環境が選択されている
        expect(radioButtons[0]).toHaveAttribute('aria-checked', 'true');
      });
    });
  });
});
