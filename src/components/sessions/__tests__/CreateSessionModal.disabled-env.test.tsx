import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionModal } from '../CreateSessionModal';

// disabled=trueの環境を含むモックデータ
const mockEnvironmentsWithDisabled = [
  {
    id: 'env-1',
    name: 'Disabled Host',
    type: 'HOST' as const,
    description: 'Disabled host environment',
    config: '{}',
    is_default: false,
    disabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'env-2',
    name: 'Docker Default',
    type: 'DOCKER' as const,
    description: 'Docker環境',
    config: '{}',
    is_default: true,
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
    environments: mockEnvironmentsWithDisabled,
    isLoading: false,
    error: null,
    fetchEnvironments: vi.fn(),
    createEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    refreshEnvironment: vi.fn(),
    hostEnvironmentDisabled: true,
  })),
}));

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CreateSessionModal - disabled環境のフィルタリング', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/branches')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            branches: [
              { name: 'main', isDefault: true, isRemote: false },
            ],
          }),
        });
      }
      if (typeof url === 'string' && url.match(/\/api\/projects\/[^/]+$/) && !url.includes('/sessions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            project: {
              id: 'project-1',
              name: 'Test Project',
              environment_id: null,
              clone_location: null,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ session: { id: 'new-session-id' } }),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('disabled=trueの環境がRadioGroupに表示されない', async () => {
    render(
      <CreateSessionModal
        isOpen={true}
        onClose={mockOnClose}
        projectId="project-1"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      // Docker DefaultとSSH Remoteは表示される
      expect(screen.getByText('Docker Default')).toBeInTheDocument();
      expect(screen.getByText('SSH Remote')).toBeInTheDocument();
    });

    // Disabled Hostは表示されない
    expect(screen.queryByText('Disabled Host')).not.toBeInTheDocument();
  });

  it('RadioGroupのラジオボタン数にdisabled環境が含まれない', async () => {
    render(
      <CreateSessionModal
        isOpen={true}
        onClose={mockOnClose}
        projectId="project-1"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Docker Default')).toBeInTheDocument();
    });

    // 環境選択のRadioGroup内のオプション数が利用可能な環境数（2）と一致すること
    const radioGroup = screen.getByRole('radiogroup');
    const radioOptions = radioGroup.querySelectorAll('[role="radio"]');
    expect(radioOptions).toHaveLength(2);
  });

  it('フォールバック時にdisabled環境が選択されない', async () => {
    // 全環境にis_default=falseを設定し、disabled=trueの環境が先頭に来るケース
    const { useEnvironments } = await import('@/hooks/useEnvironments');
    vi.mocked(useEnvironments).mockReturnValue({
      environments: [
        {
          id: 'env-disabled',
          name: 'Disabled First',
          type: 'HOST' as const,
          description: '',
          config: '{}',
          is_default: false,
          disabled: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'env-available',
          name: 'Available Second',
          type: 'DOCKER' as const,
          description: '',
          config: '{}',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
      fetchEnvironments: vi.fn(),
      createEnvironment: vi.fn(),
      updateEnvironment: vi.fn(),
      deleteEnvironment: vi.fn(),
      refreshEnvironment: vi.fn(),
      hostEnvironmentDisabled: true,
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
      // Available Secondのみ表示される
      expect(screen.getByText('Available Second')).toBeInTheDocument();
      // Disabled Firstは表示されない
      expect(screen.queryByText('Disabled First')).not.toBeInTheDocument();
    });
  });
});
