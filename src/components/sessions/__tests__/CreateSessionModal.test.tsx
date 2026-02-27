import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionModal } from '../CreateSessionModal';

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * プロジェクトAPIのレスポンスを組み立てるヘルパー
 * environment オブジェクトを含む場合と含まない場合の両方に対応
 */
function makeProjectResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      project: {
        id: 'project-1',
        name: 'Test Project',
        environment_id: null,
        clone_location: null,
        environment: null,
        ...overrides,
      },
    }),
  };
}

/**
 * セッション作成APIの成功レスポンス
 */
function makeSessionResponse() {
  return {
    ok: true,
    json: async () => ({ session: { id: 'new-session-id' } }),
  };
}

/**
 * ブランチAPIのレスポンス
 */
function makeBranchesResponse(branches = [
  { name: 'main', isDefault: true, isRemote: false },
  { name: 'develop', isDefault: false, isRemote: false },
]) {
  return {
    ok: true,
    json: async () => ({ branches }),
  };
}

describe('CreateSessionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのフェッチモック: 環境なし（environment=null）のローカルプロジェクト
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/branches')) {
        return Promise.resolve(makeBranchesResponse());
      }
      if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
        return Promise.resolve(makeProjectResponse());
      }
      return Promise.resolve(makeSessionResponse());
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

  describe('実行環境の表示', () => {
    it('プロジェクト情報読み込み中はローディング表示される', () => {
      // fetch が解決しない Promise を返すことで読み込み中状態を作る
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('プロジェクト情報を読み込み中...')).toBeInTheDocument();
    });

    it('プロジェクトに環境が設定されている場合、読み取り専用で環境名とタイプを表示する', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse({
            environment_id: 'env-docker',
            environment: {
              id: 'env-docker',
              name: 'My Docker Env',
              type: 'DOCKER',
              config: '{}',
            },
          }));
        }
        return Promise.resolve(makeSessionResponse());
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('My Docker Env')).toBeInTheDocument();
        expect(screen.getByText('DOCKER')).toBeInTheDocument();
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });
    });

    it('プロジェクトに環境が設定されていない場合、環境が見つかりませんと表示する', async () => {
      // デフォルトのモックを使用（environment=null）
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('プロジェクトに設定された環境が見つかりません')).toBeInTheDocument();
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });
    });

    it('環境選択のラジオボタンは表示されない（常に読み取り専用）', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      // 環境選択のラジオボタンは存在しない（skipPermissionsのラジオボタンのみ）
      const radios = screen.queryAllByRole('radio');
      // Docker環境でない場合、skipPermissionsラジオも存在しない
      expect(radios).toHaveLength(0);
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

    it('プロジェクト情報読み込み中は作成ボタンがdisabled', () => {
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
      expect(createButton).toBeDisabled();
    });
  });

  describe('セッション作成', () => {
    it('作成ボタンクリックでセッション作成APIが呼ばれる', async () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      // プロジェクト情報取得完了を待つ
      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
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
        // environment_id は送信しない（サーバー側がプロジェクト設定から決定）
        expect(body).not.toHaveProperty('environment_id');
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('作成中は作成ボタンがdisabledになる', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse());
        }
        // セッション作成は解決しないPromise
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(createButton).toBeDisabled();
      });
    });

    it('作成中は「作成中...」と表示される', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse());
        }
        // セッション作成は解決しないPromise
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
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
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse());
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });
    });

    it('ネットワークエラー時にエラーメッセージが表示される', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse());
        }
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('エラー時はonSuccessが呼ばれない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse());
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
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
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse());
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

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('セッション作成に失敗しました')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
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

  describe('Docker環境のskipPermissions設定', () => {
    it('プロジェクトがDocker環境の場合、skipPermissionsオーバーライドが表示される', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse({
            environment_id: 'env-docker',
            environment: {
              id: 'env-docker',
              name: 'Docker Env',
              type: 'DOCKER',
              config: '{}',
            },
          }));
        }
        return Promise.resolve(makeSessionResponse());
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('パーミッション確認スキップ')).toBeInTheDocument();
      });

      // skipPermissionsのラジオボタンが3つ表示される
      const radios = screen.queryAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('プロジェクトがHOST環境の場合、skipPermissionsオーバーライドは表示されない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse({
            environment_id: 'env-host',
            environment: {
              id: 'env-host',
              name: 'Host Env',
              type: 'HOST',
              config: '{}',
            },
          }));
        }
        return Promise.resolve(makeSessionResponse());
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      expect(screen.queryByText('パーミッション確認スキップ')).not.toBeInTheDocument();
    });
  });

  describe('セッション作成時にenvironment_idを送信しない', () => {
    it('プロジェクトにenvironment_idが設定されている場合でも、セッション作成時にenvironment_idを送信しない', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) return Promise.resolve(makeBranchesResponse([]));
        if (url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
          return Promise.resolve(makeProjectResponse({
            environment_id: 'env-docker',
            environment: {
              id: 'env-docker',
              name: 'Docker Env',
              type: 'DOCKER',
              config: '{}',
            },
          }));
        }
        return Promise.resolve(makeSessionResponse());
      });

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={mockOnClose}
          projectId="project-1"
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('この環境はプロジェクト設定で変更できます')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: '作成' });
      fireEvent.click(createButton);

      await waitFor(() => {
        const sessionCreateCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sessions') && (call[1] as RequestInit)?.method === 'POST'
        );
        expect(sessionCreateCalls).toHaveLength(1);
        const body = JSON.parse((sessionCreateCalls[0][1] as RequestInit).body as string);
        // environment_id は送信しない（サーバー側がプロジェクト設定から決定）
        expect(body).not.toHaveProperty('environment_id');
      });
    });
  });
});
