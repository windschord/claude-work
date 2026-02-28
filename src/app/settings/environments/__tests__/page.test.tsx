import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import EnvironmentsSettingsPage from '../page';

// next/navigationをモック
const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// useEnvironmentsをモック
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: () => ({
    environments: [],
    isLoading: false,
    error: null,
    fetchEnvironments: vi.fn(),
    createEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    hostEnvironmentDisabled: false,
  }),
}));

// BackButtonをモック
vi.mock('@/components/settings/BackButton', () => ({
  BackButton: () => <button data-testid="back-button">Back</button>,
}));

// EnvironmentListをモック
let capturedProps: Record<string, unknown> = {};
vi.mock('@/components/environments/EnvironmentList', () => ({
  EnvironmentList: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="environment-list" />;
  },
}));

describe('EnvironmentsSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProps = {};
  });

  it('highlightクエリパラメータがある場合、EnvironmentListにhighlightedEnvironmentIdが渡される', () => {
    mockGet.mockReturnValue('env-123');

    render(<EnvironmentsSettingsPage />);

    expect(mockGet).toHaveBeenCalledWith('highlight');
    expect(capturedProps.highlightedEnvironmentId).toBe('env-123');
  });

  it('highlightクエリパラメータがない場合、highlightedEnvironmentIdがnullで渡される', () => {
    mockGet.mockReturnValue(null);

    render(<EnvironmentsSettingsPage />);

    expect(mockGet).toHaveBeenCalledWith('highlight');
    expect(capturedProps.highlightedEnvironmentId).toBeNull();
  });
});
