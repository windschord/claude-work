import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ProjectEnvironmentSettings } from '../ProjectEnvironmentSettings';

// next/linkをモック
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} data-testid="next-link" {...props}>{children}</a>
  ),
}));

// useEnvironments hookのモック
const mockUseEnvironments = vi.fn();
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: () => mockUseEnvironments(),
}));

// fetchのモック（テスト全体で共通のモック設定）
const mockFetch = vi.fn();
beforeAll(() => {
  global.fetch = mockFetch;
});

// URL別にfetchレスポンスを返すヘルパー
function setupMockFetch(projectData: Record<string, unknown>, sessionsData: Record<string, unknown> = { sessions: [] }) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/sessions')) {
      return Promise.resolve({
        ok: true,
        json: async () => sessionsData,
      });
    }
    // プロジェクトAPI
    return Promise.resolve({
      ok: true,
      json: async () => ({ project: projectData }),
    });
  });
}

describe('ProjectEnvironmentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのuseEnvironments戻り値
    mockUseEnvironments.mockReturnValue({
      environments: [],
      isLoading: false,
      error: null,
    });
  });

  it('clone_location=nullかつhostEnvironmentDisabled=trueの場合、Docker (自動選択) と表示される', async () => {
    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: null,
      environment_id: null,
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" hostEnvironmentDisabled={true} />);

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });

    // DOCKER バッジが表示される
    expect(screen.getByText('DOCKER')).toBeInTheDocument();
    // HOST が表示されない
    expect(screen.queryByText('HOST')).not.toBeInTheDocument();
    expect(screen.queryByText('Host (自動選択)')).not.toBeInTheDocument();
  });

  it('clone_location=hostかつhostEnvironmentDisabled=trueの場合、Docker (自動選択) と表示される', async () => {
    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: 'host',
      environment_id: null,
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" hostEnvironmentDisabled={true} />);

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });
  });

  it('clone_location=nullかつhostEnvironmentDisabled=falseの場合、Host (自動選択) と表示される', async () => {
    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: null,
      environment_id: null,
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" hostEnvironmentDisabled={false} />);

    await waitFor(() => {
      expect(screen.getByText('Host (自動選択)')).toBeInTheDocument();
    });
  });

  it('clone_location=dockerの場合、hostEnvironmentDisabledに関係なくDocker (自動選択) と表示される', async () => {
    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: 'docker',
      environment_id: null,
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });
  });

  it('useEnvironmentsのisLoading=trueの場合、プロジェクトAPI完了後もローディング表示が続く', async () => {
    // useEnvironmentsがローディング中を返すようにモック
    mockUseEnvironments.mockReturnValue({
      environments: [],
      isLoading: true,
      error: null,
    });

    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: null,
      environment_id: null,
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" hostEnvironmentDisabled={true} />);

    // プロジェクトAPIが完了しても、環境APIがロード中なのでローディング表示
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    expect(screen.queryByText('Docker (自動選択)')).not.toBeInTheDocument();
    expect(screen.queryByText('Host (自動選択)')).not.toBeInTheDocument();
  });

  it('environment_idが存在するがenvironmentがnullの場合、「環境情報を取得できません」と表示される', async () => {
    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: null,
      environment_id: 'env-deleted-123',
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('環境情報を取得できません')).toBeInTheDocument();
    });

    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
  });

  it('clone_location=dockerかつhostEnvironmentDisabled=trueの場合、Docker (自動選択) と表示される', async () => {
    setupMockFetch({
      id: 'project-1',
      name: 'Test Project',
      clone_location: 'docker',
      environment_id: null,
      environment: null,
    });

    render(<ProjectEnvironmentSettings projectId="project-1" hostEnvironmentDisabled={true} />);

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });

    // DOCKER バッジが表示される
    expect(screen.getByText('DOCKER')).toBeInTheDocument();
  });

  describe('environment link', () => {
    it('environment_idが設定されている場合、環境名がリンクとして表示される', async () => {
      setupMockFetch({
        id: 'project-1',
        name: 'Test Project',
        clone_location: null,
        environment_id: 'env-1',
        environment: { id: 'env-1', name: 'Docker Default', type: 'DOCKER' },
      });

      render(<ProjectEnvironmentSettings projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Docker Default')).toBeInTheDocument();
      });

      const link = screen.getByTestId('next-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/settings/environments?highlight=env-1');
    });

    it('environment_idが未設定（自動選択）の場合、リンクは表示されない', async () => {
      setupMockFetch({
        id: 'project-1',
        name: 'Test Project',
        clone_location: 'docker',
        environment_id: null,
        environment: null,
      });

      render(<ProjectEnvironmentSettings projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('next-link')).not.toBeInTheDocument();
    });

    it('リンクのhrefに正しいenvironment_idが含まれる', async () => {
      setupMockFetch({
        id: 'project-1',
        name: 'Test Project',
        clone_location: null,
        environment_id: 'env-abc-123',
        environment: { id: 'env-abc-123', name: 'My Custom Env', type: 'DOCKER' },
      });

      render(<ProjectEnvironmentSettings projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('My Custom Env')).toBeInTheDocument();
      });

      const link = screen.getByTestId('next-link');
      expect(link.getAttribute('href')).toBe('/settings/environments?highlight=env-abc-123');
    });
  });
});
