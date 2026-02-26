import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectEnvironmentSettings } from '../ProjectEnvironmentSettings';

// useEnvironments hookのモック
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: vi.fn(() => ({
    environments: [],
    isLoading: false,
    error: null,
    fetchEnvironments: vi.fn(),
    createEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    refreshEnvironment: vi.fn(),
    hostEnvironmentDisabled: false,
  })),
}));

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ProjectEnvironmentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clone_location=nullかつhostEnvironmentDisabled=trueの場合、Docker (自動選択) と表示される', async () => {
    const { useEnvironments } = await import('@/hooks/useEnvironments');
    vi.mocked(useEnvironments).mockReturnValue({
      environments: [],
      isLoading: false,
      error: null,
      fetchEnvironments: vi.fn(),
      createEnvironment: vi.fn(),
      updateEnvironment: vi.fn(),
      deleteEnvironment: vi.fn(),
      refreshEnvironment: vi.fn(),
      hostEnvironmentDisabled: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        project: {
          id: 'project-1',
          name: 'Test Project',
          clone_location: null,
          environment_id: null,
          environment: null,
        },
      }),
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

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
    const { useEnvironments } = await import('@/hooks/useEnvironments');
    vi.mocked(useEnvironments).mockReturnValue({
      environments: [],
      isLoading: false,
      error: null,
      fetchEnvironments: vi.fn(),
      createEnvironment: vi.fn(),
      updateEnvironment: vi.fn(),
      deleteEnvironment: vi.fn(),
      refreshEnvironment: vi.fn(),
      hostEnvironmentDisabled: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        project: {
          id: 'project-1',
          name: 'Test Project',
          clone_location: 'host',
          environment_id: null,
          environment: null,
        },
      }),
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });
  });

  it('clone_location=nullかつhostEnvironmentDisabled=falseの場合、Host (自動選択) と表示される', async () => {
    const { useEnvironments } = await import('@/hooks/useEnvironments');
    vi.mocked(useEnvironments).mockReturnValue({
      environments: [],
      isLoading: false,
      error: null,
      fetchEnvironments: vi.fn(),
      createEnvironment: vi.fn(),
      updateEnvironment: vi.fn(),
      deleteEnvironment: vi.fn(),
      refreshEnvironment: vi.fn(),
      hostEnvironmentDisabled: false,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        project: {
          id: 'project-1',
          name: 'Test Project',
          clone_location: null,
          environment_id: null,
          environment: null,
        },
      }),
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Host (自動選択)')).toBeInTheDocument();
    });
  });

  it('clone_location=dockerの場合、hostEnvironmentDisabledに関係なくDocker (自動選択) と表示される', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        project: {
          id: 'project-1',
          name: 'Test Project',
          clone_location: 'docker',
          environment_id: null,
          environment: null,
        },
      }),
    });

    render(<ProjectEnvironmentSettings projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });
  });
});
