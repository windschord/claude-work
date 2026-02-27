import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentList } from '../EnvironmentList';
import { Environment } from '@/hooks/useEnvironments';

// fetchのモック（EnvironmentCard内のApplyChangesButton用）
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EnvironmentList - disabled環境のフィルタリング', () => {
  const defaultProps = {
    isLoading: false,
    error: null,
    onCreateEnvironment: vi.fn(),
    onUpdateEnvironment: vi.fn(),
    onDeleteEnvironment: vi.fn(),
    onRefresh: vi.fn(),
  };

  const createEnvironment = (overrides: Partial<Environment> = {}): Environment => ({
    id: 'env-1',
    name: 'Test Environment',
    type: 'HOST',
    description: 'Test description',
    config: '{}',
    is_default: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    status: {
      available: true,
      authenticated: true,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [], count: 0 }),
    });
  });

  it('disabled=trueの環境がリストに表示されない', () => {
    const environments = [
      createEnvironment({ id: 'env-1', name: 'Visible Docker', type: 'DOCKER' }),
      createEnvironment({ id: 'env-2', name: 'Hidden Host', type: 'HOST', disabled: true }),
      createEnvironment({ id: 'env-3', name: 'Visible SSH', type: 'SSH' }),
    ];

    render(
      <EnvironmentList
        {...defaultProps}
        environments={environments}
      />
    );

    expect(screen.getByText('Visible Docker')).toBeInTheDocument();
    expect(screen.getByText('Visible SSH')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Host')).not.toBeInTheDocument();
  });

  it('全ての環境がdisabled=trueの場合、空の状態メッセージが表示される', () => {
    const environments = [
      createEnvironment({ id: 'env-1', name: 'Hidden Host', type: 'HOST', disabled: true }),
    ];

    render(
      <EnvironmentList
        {...defaultProps}
        environments={environments}
      />
    );

    expect(screen.getByText('環境がありません')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Host')).not.toBeInTheDocument();
  });

  it('disabled=falseまたはundefinedの環境は通常通り表示される', () => {
    const environments = [
      createEnvironment({ id: 'env-1', name: 'Normal Env', type: 'DOCKER', disabled: false }),
      createEnvironment({ id: 'env-2', name: 'Also Normal', type: 'DOCKER' }),  // disabled未設定
    ];

    render(
      <EnvironmentList
        {...defaultProps}
        environments={environments}
      />
    );

    expect(screen.getByText('Normal Env')).toBeInTheDocument();
    expect(screen.getByText('Also Normal')).toBeInTheDocument();
  });
});
