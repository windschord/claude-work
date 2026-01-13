import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CreateSessionModal } from '../CreateSessionModal';
import { useRepositoryStore } from '@/store/repository-store';
import type { RepositoryWithSessionCount } from '@/store/repository-store';

// Mock the repository store
vi.mock('@/store/repository-store', () => ({
  useRepositoryStore: vi.fn(),
}));

const mockRepositories: RepositoryWithSessionCount[] = [
  {
    id: 'repo-1',
    name: 'my-project',
    type: 'local',
    path: '/home/user/repos/my-project',
    url: null,
    defaultBranch: 'main',
    createdAt: new Date(),
    updatedAt: new Date(),
    sessionCount: 2,
  },
  {
    id: 'repo-2',
    name: 'api-service',
    type: 'remote',
    path: null,
    url: 'git@github.com:user/api-service.git',
    defaultBranch: 'main',
    createdAt: new Date(),
    updatedAt: new Date(),
    sessionCount: 0,
  },
];

describe('CreateSessionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn().mockResolvedValue(undefined);
  const mockFetchRepositories = vi.fn();
  const mockSelectRepository = vi.fn();
  const mockFetchBranches = vi.fn();
  const mockClearError = vi.fn();

  const defaultStoreState = {
    repositories: mockRepositories,
    selectedRepository: null as RepositoryWithSessionCount | null,
    branches: [] as string[],
    defaultBranch: '',
    loading: false,
    error: null as string | null,
    fetchRepositories: mockFetchRepositories,
    selectRepository: mockSelectRepository,
    fetchBranches: mockFetchBranches,
    clearError: mockClearError,
    addRepository: vi.fn(),
    deleteRepository: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultStoreState);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render modal when open', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('Create New Session')).toBeInTheDocument();
    });

    it('should not render modal when closed', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={false} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.queryByText('Create New Session')).not.toBeInTheDocument();
    });

    it('should render repository dropdown', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByLabelText(/Repository/i)).toBeInTheDocument();
      expect(screen.getByText('Select repository...')).toBeInTheDocument();
    });

    it('should render parent branch dropdown', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByLabelText(/Parent Branch/i)).toBeInTheDocument();
    });

    it('should render session name input', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByLabelText(/Session Name/i)).toBeInTheDocument();
    });

    it('should render branch name preview', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('Branch Name (auto-generated)')).toBeInTheDocument();
      expect(screen.getByTestId('branch-name-preview')).toHaveTextContent('session/...');
    });

    it('should fetch repositories when modal opens', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(mockFetchRepositories).toHaveBeenCalled();
    });
  });

  describe('Repository selection', () => {
    it('should display repositories in dropdown', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('my-project (local)')).toBeInTheDocument();
      expect(screen.getByText('api-service (remote)')).toBeInTheDocument();
    });

    it('should call selectRepository when repository is selected', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Repository/i), {
          target: { value: 'repo-1' },
        });
      });

      expect(mockSelectRepository).toHaveBeenCalledWith(mockRepositories[0]);
    });

    it('should clear selection when empty option is selected', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Repository/i), {
          target: { value: '' },
        });
      });

      expect(mockSelectRepository).toHaveBeenCalledWith(null);
    });
  });

  describe('Branch selection', () => {
    it('should show placeholder when no repository is selected', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('Select repository first...')).toBeInTheDocument();
    });

    it('should show branches when repository is selected', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main', 'develop', 'feature/test'],
        defaultBranch: 'main',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('develop')).toBeInTheDocument();
      expect(screen.getByText('feature/test')).toBeInTheDocument();
    });

    it('should show loading message when branches are being loaded', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: [],
        defaultBranch: '',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('Loading branches...')).toBeInTheDocument();
    });

    it('should disable branch dropdown when no repository is selected', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByLabelText(/Parent Branch/i)).toBeDisabled();
    });
  });

  describe('Branch name generation', () => {
    it('should generate branch name from session name', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'my-feature' },
        });
      });

      expect(screen.getByTestId('branch-name-preview')).toHaveTextContent('session/my-feature');
    });

    it('should convert uppercase to lowercase', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'MyFeature' },
        });
      });

      expect(screen.getByTestId('branch-name-preview')).toHaveTextContent('session/myfeature');
    });

    it('should replace spaces with hyphens', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'my feature' },
        });
      });

      expect(screen.getByTestId('branch-name-preview')).toHaveTextContent('session/my-feature');
    });

    it('should handle special characters', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'feat@#$%123' },
        });
      });

      expect(screen.getByTestId('branch-name-preview')).toHaveTextContent('session/feat-123');
    });

    it('should show placeholder when session name is empty', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByTestId('branch-name-preview')).toHaveTextContent('session/...');
    });
  });

  describe('Form validation', () => {
    it('should show validation error for empty session name', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main'],
        defaultBranch: 'main',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      // Select the branch explicitly
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Parent Branch/i), {
          target: { value: 'main' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Session name is required')).toBeInTheDocument();
      });
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should show validation error for invalid session name format', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main'],
        defaultBranch: 'main',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'invalid name with spaces' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/can only contain letters, numbers/i)).toBeInTheDocument();
      });
    });

    it('should show validation error when no repository is selected', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Repository is required')).toBeInTheDocument();
      });
    });

    it('should show validation error when no branch is selected', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main', 'develop'],
        defaultBranch: '',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Parent branch is required')).toBeInTheDocument();
      });
    });
  });

  describe('Form submission', () => {
    it('should submit form with correct data', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main', 'develop'],
        defaultBranch: 'main',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      // Explicitly select branch
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Parent Branch/i), {
          target: { value: 'main' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'test-session',
          repositoryId: 'repo-1',
          parentBranch: 'main',
        });
      });
    });

    it('should submit form with custom branch selection', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main', 'develop'],
        defaultBranch: 'main',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Parent Branch/i), {
          target: { value: 'develop' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'test-session',
          repositoryId: 'repo-1',
          parentBranch: 'develop',
        });
      });
    });

    it('should close modal after successful submission', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main'],
        defaultBranch: 'main',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Parent Branch/i), {
          target: { value: 'main' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal actions', () => {
    it('should close modal on cancel', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should display submit error when creation fails', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main'],
        defaultBranch: 'main',
      });

      mockOnCreate.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Parent Branch/i), {
          target: { value: 'main' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should reset form when cancel is clicked', async () => {
      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      // Fill in some data
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      // Click cancel to close modal
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      });

      // Verify cleanup functions were called
      expect(mockSelectRepository).toHaveBeenCalledWith(null);
      expect(mockClearError).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show loading state during submission', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        selectedRepository: mockRepositories[0],
        branches: ['main'],
        defaultBranch: 'main',
      });

      let resolveSubmit: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnCreate.mockReturnValueOnce(pendingPromise);

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Session Name/i), {
          target: { value: 'test-session' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Parent Branch/i), {
          target: { value: 'main' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      // Resolve the promise
      await act(async () => {
        resolveSubmit!();
      });
    });

    it('should display repository error from store', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        error: 'Failed to fetch repositories',
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      expect(screen.getByText('Failed to fetch repositories')).toBeInTheDocument();
    });

    it('should show loading spinner when fetching repositories', async () => {
      (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultStoreState,
        loading: true,
      });

      await act(async () => {
        render(
          <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
        );
      });

      // The repository dropdown should be disabled during loading
      expect(screen.getByLabelText(/Repository/i)).toBeDisabled();
    });
  });
});
