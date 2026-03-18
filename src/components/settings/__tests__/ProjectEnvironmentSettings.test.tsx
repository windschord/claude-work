import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ProjectEnvironmentSettings } from '../ProjectEnvironmentSettings';

// useProjectEnvironment hookのモック
const mockUseProjectEnvironment = vi.fn();
vi.mock('@/hooks/useProjectEnvironment', () => ({
  useProjectEnvironment: (projectId: string) => mockUseProjectEnvironment(projectId),
}));

// fetchのモック（テスト全体で共通のモック設定）
const mockFetch = vi.fn();
beforeAll(() => {
  global.fetch = mockFetch;
});

describe('ProjectEnvironmentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [] }),
    });
  });

  it('ローディング中は「読み込み中...」が表示される', () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: null,
      isLoading: true,
      error: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('エラー時はエラーメッセージが表示される', () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: null,
      isLoading: false,
      error: '環境の取得に失敗しました',
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    expect(screen.getByText('環境の取得に失敗しました')).toBeInTheDocument();
  });

  it('環境がnullの場合、「環境情報がありません」が表示される', async () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: null,
      isLoading: false,
      error: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('環境情報がありません')).toBeInTheDocument();
    });
  });

  it('DOCKER環境が表示される', async () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: {
        id: 'env-1',
        name: 'Docker Default',
        type: 'DOCKER',
        description: null,
        config: '{}',
        project_id: 'project-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      isLoading: false,
      error: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Docker Default')).toBeInTheDocument();
    });

    expect(screen.getByText('DOCKER')).toBeInTheDocument();
  });

  it('HOST環境が表示される', async () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: {
        id: 'env-2',
        name: 'Host Environment',
        type: 'HOST',
        description: null,
        config: '{}',
        project_id: 'project-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      isLoading: false,
      error: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Host Environment')).toBeInTheDocument();
    });

    expect(screen.getByText('HOST')).toBeInTheDocument();
  });

  it('セッション数が表示される', async () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: {
        id: 'env-1',
        name: 'Docker Default',
        type: 'DOCKER',
        description: null,
        config: '{}',
        project_id: 'project-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      isLoading: false,
      error: null,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: [
          { id: 's1', status: 'active' },
          { id: 's2', status: 'idle' },
        ],
      }),
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText(/アクティブセッション: 2件/)).toBeInTheDocument();
    });
  });

  it('セッション数が0件の場合、設定変更の案内が表示される', async () => {
    mockUseProjectEnvironment.mockReturnValue({
      environment: {
        id: 'env-1',
        name: 'Docker Default',
        type: 'DOCKER',
        description: null,
        config: '{}',
        project_id: 'project-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      isLoading: false,
      error: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText(/環境の詳細設定はプロジェクト設定の環境セクションで変更できます/)).toBeInTheDocument();
    });
  });
});
