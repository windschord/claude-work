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
    // URLに応じて異なるレスポンスを返す
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/branches')) {
        // ブランチ一覧API
        return Promise.resolve({
          ok: true,
          json: async () => ({
            branches: [
              { name: 'main', isDefault: true, isRemote: false },
              { name: 'develop', isDefault: false, isRemote: false },
            ],
          }),
        });
      }
      // プロジェクト詳細API (環境設定なし)
      if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            project: {
              id: 'project-1',
              name: 'Test Project',
              environment_id: null,
            },
          }),
        });
      }
      // セッション作成API
      return Promise.resolve({
        ok: true,
        json: async () => ({ session: { id: 'new-session-id' } }),
      });
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
    it('環境一覧がラジオボタンで表示される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後にradioボタンが表示される
      await waitFor(() => {
        expect(screen.getByText('Default Host')).toBeInTheDocument();
        expect(screen.getByText('Docker Env')).toBeInTheDocument();
        expect(screen.getByText('SSH Remote')).toBeInTheDocument();
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons).toHaveLength(3);
      });
    });

    it('各環境のタイプバッジが表示される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('HOST')).toBeInTheDocument();
        expect(screen.getByText('DOCKER')).toBeInTheDocument();
        expect(screen.getByText('SSH')).toBeInTheDocument();
      });
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
        // ソート後: Docker Env(0), Default Host(1), SSH Remote(2)
        // デフォルト環境（Default Host, is_default=true）が選択されている
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
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

      // プロジェクト情報取得完了後にradioボタンが表示されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons).toHaveLength(3);
      });

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

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      // ブランチ読み込み完了を待つ
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        const sessionCreateCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sessions') && (call[1] as RequestInit)?.method === 'POST'
        );
        expect(sessionCreateCalls).toHaveLength(1);
        const body = JSON.parse((sessionCreateCalls[0][1] as RequestInit).body as string);
        expect(body.environment_id).toBe('env-1'); // デフォルト環境
        expect(body.source_branch).toBe('main');
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

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      // ブランチ読み込み完了を待つ
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // ソート後: Docker Env(0), Default Host(1), SSH Remote(2)
      // Docker環境を選択
      const radioButtons = screen.getAllByRole('radio');
      fireEvent.click(radioButtons[0]); // Docker Envはソート後0番目

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        const sessionCreateCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sessions') && (call[1] as RequestInit)?.method === 'POST'
        );
        expect(sessionCreateCalls).toHaveLength(1);
        const body = JSON.parse((sessionCreateCalls[0][1] as RequestInit).body as string);
        expect(body.environment_id).toBe('env-2'); // Docker環境
        expect(body.source_branch).toBe('main');
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

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

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

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('作成中は作成ボタンがdisabledになる', async () => {
      // ブランチは即座に返し、セッション作成は解決しないPromiseを返す
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: { id: 'project-1', name: 'Test Project', environment_id: null },
            }),
          });
        }
        return new Promise(() => {});
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(createButton).toBeDisabled();
      });
    });

    it('作成中は「作成中...」と表示される', async () => {
      // ブランチは即座に返し、セッション作成は解決しないPromiseを返す
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: { id: 'project-1', name: 'Test Project', environment_id: null },
            }),
          });
        }
        return new Promise(() => {});
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '作成中...' })).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('セッション作成失敗時にエラーメッセージが表示される', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: { id: 'project-1', name: 'Test Project', environment_id: null },
            }),
          });
        }
        // セッション作成APIはエラーを返す
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: 'セッション作成に失敗しました' }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });
    });

    it('ネットワークエラー時にエラーメッセージが表示される', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: { id: 'project-1', name: 'Test Project', environment_id: null },
            }),
          });
        }
        // セッション作成APIはネットワークエラー
        return Promise.reject(new Error('Network error'));
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('エラー時はonSuccessが呼ばれない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: { id: 'project-1', name: 'Test Project', environment_id: null },
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: 'セッション作成に失敗しました' }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('エラー時はモーダルが閉じない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: { id: 'project-1', name: 'Test Project', environment_id: null },
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: 'セッション作成に失敗しました' }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了後、環境が選択されるのを待つ
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

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
      const defaultEnvMock = {
        environments: mockEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      };
      vi.mocked(useEnvironments).mockReturnValue({
        environments: [],
        isLoading: true,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });

      try {
        render(
          <CreateSessionModal
            isOpen={true}
            onClose={mockOnClose}
            projectId="project-1"
            onSuccess={mockOnSuccess}
          />
        );

        expect(screen.getByText('環境を読み込み中...')).toBeInTheDocument();
      } finally {
        // 元のモックに戻す
        vi.mocked(useEnvironments).mockReturnValue(defaultEnvMock);
      }
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
      vi.mocked(useEnvironments).mockReturnValue({
        environments: noDefaultEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });

      try {
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
          // 最初の環境が選択されている（ソート後: Docker(0), Host(1)）
          expect(radioButtons[0]).toHaveAttribute('aria-checked', 'true');
        });
      } finally {
        // 元のモックに戻す
        vi.mocked(useEnvironments).mockReturnValue({
          environments: mockEnvironments,
          isLoading: false,
          error: null,
          fetchEnvironments: vi.fn(),
          createEnvironment: vi.fn(),
          updateEnvironment: vi.fn(),
          deleteEnvironment: vi.fn(),
          refreshEnvironment: vi.fn(),
        });
      }
    });
  });

  describe('環境の表示順（TASK-010）', () => {
    it('環境がDocker→Host→SSHの順で表示される', async () => {
      // 逆順で定義された環境
      const unsortedEnvironments = [
        {
          id: 'env-ssh',
          name: 'SSH Remote',
          type: 'SSH' as const,
          description: 'SSH環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-host',
          name: 'Host Local',
          type: 'HOST' as const,
          description: 'ホスト環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-docker',
          name: 'Docker Container',
          type: 'DOCKER' as const,
          description: 'Docker環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const { useEnvironments } = await import('@/hooks/useEnvironments');
      vi.mocked(useEnvironments).mockReturnValue({
        environments: unsortedEnvironments,
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

      // プロジェクト情報取得完了後にradioボタンが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByText('Docker Container')).toBeInTheDocument();
      });

      // 環境名がDocker→Host→SSHの順で表示されることを確認
      expect(screen.getByText('Host Local')).toBeInTheDocument();
      expect(screen.getByText('SSH Remote')).toBeInTheDocument();

      // ラジオボタンの順序を確認（DOM構造に依存しないアプローチ）
      const radioButtons = screen.getAllByRole('radio');
      // 最初のラジオボタンがDocker環境であることを確認
      const firstRadio = radioButtons[0];
      const firstContainer = firstRadio.closest('[role="radio"]');
      expect(firstContainer?.textContent).toContain('Docker Container');

      // 2番目がHost環境
      const secondContainer = radioButtons[1].closest('[role="radio"]');
      expect(secondContainer?.textContent).toContain('Host Local');

      // 3番目がSSH環境
      const thirdContainer = radioButtons[2].closest('[role="radio"]');
      expect(thirdContainer?.textContent).toContain('SSH Remote');

      // 元のモックに戻す
      vi.mocked(useEnvironments).mockReturnValue({
        environments: mockEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });
    });

    it('同じタイプ内ではis_default=trueが最初に表示される', async () => {
      const environmentsWithDefaults = [
        {
          id: 'env-docker-2',
          name: 'Docker 2',
          type: 'DOCKER' as const,
          description: 'Docker環境2',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-docker-1',
          name: 'Docker Default',
          type: 'DOCKER' as const,
          description: 'デフォルトDocker',
          config: '{}',
          is_default: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-host',
          name: 'Host',
          type: 'HOST' as const,
          description: 'ホスト環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const { useEnvironments } = await import('@/hooks/useEnvironments');
      vi.mocked(useEnvironments).mockReturnValue({
        environments: environmentsWithDefaults,
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

      // プロジェクト情報取得完了後にradioボタンが表示されるのを待つ
      // Docker環境がデフォルトのため isDockerEnvironment=true になり、
      // 3つの環境選択ラジオ + 3つの skipPermissionsOverride ラジオ = 6 になる
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons).toHaveLength(6);
      });

      const radioButtons = screen.getAllByRole('radio');

      // Docker Defaultが最初（インデックス0-2が環境選択ラジオ、3-5がskipPermissionsOverride）
      const firstContainer = radioButtons[0].closest('[role="radio"]');
      expect(firstContainer?.textContent).toContain('Docker Default');

      // 次にDocker 2
      const secondContainer = radioButtons[1].closest('[role="radio"]');
      expect(secondContainer?.textContent).toContain('Docker 2');

      // 最後にHost
      const thirdContainer = radioButtons[2].closest('[role="radio"]');
      expect(thirdContainer?.textContent).toContain('Host');

      // 元のモックに戻す
      vi.mocked(useEnvironments).mockReturnValue({
        environments: mockEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });
    });

    it('デフォルト環境がない場合は最初のDocker環境が選択される', async () => {
      const noDefaultEnvironments = [
        {
          id: 'env-host',
          name: 'Host',
          type: 'HOST' as const,
          description: 'ホスト環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-docker',
          name: 'Docker',
          type: 'DOCKER' as const,
          description: 'Docker環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const { useEnvironments } = await import('@/hooks/useEnvironments');
      vi.mocked(useEnvironments).mockReturnValue({
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

      // Docker環境が選択されていることを確認（ソート後は最初）
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        // Docker環境（ソート後1番目）が選択されている
        expect(radioButtons[0]).toHaveAttribute('aria-checked', 'true');
      });

      // 元のモックに戻す
      vi.mocked(useEnvironments).mockReturnValue({
        environments: mockEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });
    });
  });

  describe('ブランチ選択機能', () => {
    it('プロジェクト選択時にブランチ一覧を取得する', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/branches');
      });
    });

    it('デフォルトブランチが自動選択される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });
    });

    it('ブランチListboxが表示される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        const branchLabel = screen.getByText('ベースブランチ');
        expect(branchLabel).toBeInTheDocument();
      });
    });

    it('セッション作成時に選択したブランチ名が送信される', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      const submitButton = screen.getByText('作成');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/project-1/sessions',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"source_branch":"main"'),
          })
        );
      });
    });
  });

  describe('プロジェクトのデフォルト環境が設定されている場合', () => {
    it('プロジェクトにenvironment_id(Docker)が設定されている場合、その環境が読み取り専用で表示される', async () => {
      // プロジェクトAPIがDocker環境のIDを返すようモック
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (url.match(/\/api\/projects\/[^/]+$/)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: {
                id: 'project-1',
                name: 'Test Project',
                environment_id: 'env-2', // Docker Env
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { id: 'new-session-id' } }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクトの環境設定が読み取り専用で表示される
      await waitFor(() => {
        expect(screen.getByText('Docker Env')).toBeInTheDocument();
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      // 環境選択ラジオボタンは表示されない（読み取り専用表示のため）
      // ただし Docker 環境が選択されるため isDockerEnvironment=true になり
      // skipPermissionsOverride の 3 つのラジオボタンは表示される
      expect(screen.queryAllByRole('radio')).toHaveLength(3);
    });

    it('プロジェクトにenvironment_idが設定されている場合、セッション作成時にenvironment_idを送信しない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (url.match(/\/api\/projects\/[^/]+$/)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: {
                id: 'project-1',
                name: 'Test Project',
                environment_id: 'env-2', // Docker Env
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { id: 'new-session-id' } }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト環境読み込み完了を待つ
      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      // environment_idがリクエストボディに含まれないことを確認
      await waitFor(() => {
        const sessionCreateCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sessions') && (call[1] as RequestInit)?.method === 'POST'
        );
        expect(sessionCreateCalls).toHaveLength(1);
        const body = JSON.parse((sessionCreateCalls[0][1] as RequestInit).body as string);
        expect(body).not.toHaveProperty('environment_id');
      });
    });
  });

  describe('clone_location=dockerのプロジェクトの場合', () => {
    it('environment_idがnullでclone_location=dockerの場合、Docker環境が自動選択され読み取り専用で表示される', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: {
                id: 'project-1',
                name: 'Docker Clone Project',
                environment_id: null,
                clone_location: 'docker',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { id: 'new-session-id' } }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // Docker環境が読み取り専用で表示される
      await waitFor(() => {
        expect(screen.getByText('Docker Env')).toBeInTheDocument();
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      // 環境選択ラジオボタンは表示されない（読み取り専用表示のため）
      // ただし Docker 環境が自動選択されるため isDockerEnvironment=true になり
      // skipPermissionsOverride の 3 つのラジオボタンは表示される
      expect(screen.queryAllByRole('radio')).toHaveLength(3);
    });

    it('clone_location=dockerの場合、セッション作成時にenvironment_idを送信しない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: {
                id: 'project-1',
                name: 'Docker Clone Project',
                environment_id: null,
                clone_location: 'docker',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { id: 'new-session-id' } }),
        });
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // 読み取り専用表示を待つ
      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      // サーバー側がclone_locationに基づいてDocker環境を自動選択するため、environment_idは送信しない
      await waitFor(() => {
        const sessionCreateCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sessions') && (call[1] as RequestInit)?.method === 'POST'
        );
        expect(sessionCreateCalls).toHaveLength(1);
        const body = JSON.parse((sessionCreateCalls[0][1] as RequestInit).body as string);
        expect(body).not.toHaveProperty('environment_id');
      });
    });

    it('clone_locationがnull(ローカルプロジェクト)の場合、環境選択が可能', async () => {
      // デフォルトのmockFetchはclone_location無しのプロジェクトを返す
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // ラジオボタンが表示される（選択可能）
      await waitFor(() => {
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons).toHaveLength(3);
      });
    });

    it('clone_location=dockerでDocker環境が未登録の場合、フォールバック通知が表示される', async () => {
      // Docker環境を含まない環境リストをモック
      const noDockerEnvironments = [
        {
          id: 'env-host',
          name: 'Host Only',
          type: 'HOST' as const,
          description: 'ホスト環境',
          config: '{}',
          is_default: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-ssh',
          name: 'SSH Only',
          type: 'SSH' as const,
          description: 'SSH環境',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const { useEnvironments } = await import('@/hooks/useEnvironments');
      vi.mocked(useEnvironments).mockReturnValue({
        environments: noDockerEnvironments,
        isLoading: false,
        error: null,
        fetchEnvironments: vi.fn(),
        createEnvironment: vi.fn(),
        updateEnvironment: vi.fn(),
        deleteEnvironment: vi.fn(),
        refreshEnvironment: vi.fn(),
      });

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ branches: [] }),
          });
        }
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              project: {
                id: 'project-1',
                name: 'Docker Clone Project',
                environment_id: null,
                clone_location: 'docker',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ session: { id: 'new-session-id' } }),
        });
      });

      try {
        render(
          <CreateSessionModal
            isOpen={true}
            onClose={mockOnClose}
            projectId="project-1"
            onSuccess={mockOnSuccess}
          />
        );

        // フォールバック通知が表示される
        await waitFor(() => {
          expect(screen.getByText('Docker環境が登録されていないため、サーバー側でDocker環境が自動選択されます')).toBeInTheDocument();
        });

        // ラジオボタンは表示されない（読み取り専用表示のため）
        expect(screen.queryAllByRole('radio')).toHaveLength(0);

        // 作成ボタンが有効（フォールバック環境が選択されているため）
        const createButton = screen.getByRole('button', { name: '作成' });
        fireEvent.click(createButton);

        // environment_idは送信しない（サーバー側で決定）
        await waitFor(() => {
          const sessionCreateCalls = mockFetch.mock.calls.filter(
            (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sessions') && (call[1] as RequestInit)?.method === 'POST'
          );
          expect(sessionCreateCalls).toHaveLength(1);
          const body = JSON.parse((sessionCreateCalls[0][1] as RequestInit).body as string);
          expect(body).not.toHaveProperty('environment_id');
        });
      } finally {
        // 元のモックに戻す
        vi.mocked(useEnvironments).mockReturnValue({
          environments: mockEnvironments,
          isLoading: false,
          error: null,
          fetchEnvironments: vi.fn(),
          createEnvironment: vi.fn(),
          updateEnvironment: vi.fn(),
          deleteEnvironment: vi.fn(),
          refreshEnvironment: vi.fn(),
        });
      }
    });
  });
});
