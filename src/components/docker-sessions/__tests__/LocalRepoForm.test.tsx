import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalRepoForm } from '../LocalRepoForm';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LocalRepoForm', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should render form with required fields', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      expect(screen.getByLabelText(/Session Name/i)).toBeInTheDocument();
      expect(screen.getByTestId('repo-path-display')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Browse/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Branch/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Session/i })).toBeInTheDocument();
    });

    it('should have empty session name initially', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      expect(screen.getByLabelText(/Session Name/i)).toHaveValue('');
    });

    it('should have no repository path initially', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      expect(screen.getByTestId('repo-path-display')).toHaveTextContent('No repository selected');
    });

    it('should have disabled branch selector initially', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      expect(screen.getByLabelText(/Branch/i)).toBeDisabled();
    });
  });

  describe('Browse button and DirectoryBrowser', () => {
    it('should open DirectoryBrowser when Browse button is clicked', async () => {
      // Mock fetch for DirectoryBrowser initial load
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          currentPath: '/home/user',
          parentPath: null,
          entries: [],
        }),
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByTestId('directory-browser-modal')).toBeInTheDocument();
      });
    });

    it('should close DirectoryBrowser when Cancel is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          currentPath: '/home/user',
          parentPath: null,
          entries: [],
        }),
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByTestId('directory-browser-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('directory-browser-modal')).not.toBeInTheDocument();
      });
    });

    it('should update repository path when a repository is selected', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main', 'develop'],
        currentBranch: 'main',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Open browser
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      // Select repository and click Select button
      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Wait for modal to close and path to update
      await waitFor(() => {
        expect(screen.queryByTestId('directory-browser-modal')).not.toBeInTheDocument();
      });

      // Verify path is displayed
      expect(screen.getByTestId('repo-path-display')).toHaveTextContent('/home/user/my-repo');
    });
  });

  describe('Branch selection after repository selection', () => {
    it('should fetch branches when repository is selected', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main', 'develop', 'feature/test'],
        currentBranch: 'main',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Open browser and select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Wait for branches to be fetched
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/filesystem/branches?path=%2Fhome%2Fuser%2Fmy-repo'
        );
      });
    });

    it('should populate branch dropdown with fetched branches', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main', 'develop', 'feature/test'],
        currentBranch: 'develop',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Open browser and select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Wait for branch dropdown to be enabled
      await waitFor(() => {
        expect(screen.getByLabelText(/Branch/i)).not.toBeDisabled();
      });

      // Check that branches are available as options
      const branchSelect = screen.getByLabelText(/Branch/i) as HTMLSelectElement;
      const options = Array.from(branchSelect.options).map(opt => opt.value);
      expect(options).toContain('main');
      expect(options).toContain('develop');
      expect(options).toContain('feature/test');

      // Current branch should be selected
      expect(branchSelect).toHaveValue('develop');
    });

    it('should show loading state while fetching branches', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      let resolveBranches: (value: unknown) => void;
      const branchesPromise = new Promise((resolve) => {
        resolveBranches = resolve;
      });

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return branchesPromise;
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Open browser and select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByTestId('branch-loading')).toBeInTheDocument();
      });

      // Resolve branches
      resolveBranches!({
        ok: true,
        json: async () => ({ branches: ['main'], currentBranch: 'main' }),
      });

      // Loading should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('branch-loading')).not.toBeInTheDocument();
      });
    });

    it('should show error when branch fetching fails', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Failed to get branches' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Open browser and select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('branch-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to get branches')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should call onSubmit with correct data when form is valid', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main', 'develop'],
        currentBranch: 'main',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Fill in session name
      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'my-session' },
      });

      // Select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Wait for branches to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Branch/i)).not.toBeDisabled();
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'my-session',
          localPath: '/home/user/my-repo',
          branch: 'main',
        });
      });
    });

    it('should allow changing branch before submission', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main', 'develop'],
        currentBranch: 'main',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Fill in session name
      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'my-session' },
      });

      // Select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      // Wait for branches to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Branch/i)).not.toBeDisabled();
      });

      // Change branch
      fireEvent.change(screen.getByLabelText(/Branch/i), {
        target: { value: 'develop' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'my-session',
          localPath: '/home/user/my-repo',
          branch: 'develop',
        });
      });
    });
  });

  describe('Validation', () => {
    it('should show error for empty session name', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main'],
        currentBranch: 'main',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Select repository but don't fill in session name
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      await waitFor(() => {
        expect(screen.getByLabelText(/Branch/i)).not.toBeDisabled();
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText('Session name is required')).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error for invalid session name format', async () => {
      const mockHomeResponse = {
        currentPath: '/home/user',
        parentPath: null,
        entries: [
          { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
        ],
      };

      const mockBranchesResponse = {
        branches: ['main'],
        currentBranch: 'main',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/branches')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockBranchesResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeResponse,
        });
      });

      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Fill in invalid session name
      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'invalid name with spaces' },
      });

      // Select repository
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      await waitFor(() => {
        expect(screen.getByLabelText(/Branch/i)).not.toBeDisabled();
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText(/can only contain letters, numbers/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error for unselected repository', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={false} />);

      // Fill in session name but don't select repository
      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'my-session' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      expect(screen.getByText('Repository path is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Submitting state', () => {
    it('should disable form inputs when isSubmitting is true', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={true} />);

      expect(screen.getByLabelText(/Session Name/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /Browse/i })).toBeDisabled();
      expect(screen.getByLabelText(/Branch/i)).toBeDisabled();
    });

    it('should show loading indicator on submit button when isSubmitting is true', () => {
      render(<LocalRepoForm onSubmit={mockOnSubmit} isSubmitting={true} />);

      expect(screen.getByRole('button', { name: /Creating/i })).toBeInTheDocument();
      expect(screen.getByTestId('submit-loading')).toBeInTheDocument();
    });
  });
});
