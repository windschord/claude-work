import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DirectoryBrowser } from '../DirectoryBrowser';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DirectoryBrowser', () => {
  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  const mockHomeDirectoryResponse = {
    currentPath: '/home/user',
    parentPath: null,
    entries: [
      { name: 'projects', path: '/home/user/projects', type: 'directory', isGitRepository: false, isHidden: false },
      { name: 'Documents', path: '/home/user/Documents', type: 'directory', isGitRepository: false, isHidden: false },
      { name: 'my-repo', path: '/home/user/my-repo', type: 'directory', isGitRepository: true, isHidden: false },
      { name: '.config', path: '/home/user/.config', type: 'directory', isGitRepository: false, isHidden: true },
      { name: 'readme.txt', path: '/home/user/readme.txt', type: 'file', isGitRepository: false, isHidden: false },
    ],
  };

  const mockSubDirectoryResponse = {
    currentPath: '/home/user/projects',
    parentPath: '/home/user',
    entries: [
      { name: 'project-a', path: '/home/user/projects/project-a', type: 'directory', isGitRepository: true, isHidden: false },
      { name: 'project-b', path: '/home/user/projects/project-b', type: 'directory', isGitRepository: false, isHidden: false },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Initial state and home directory display', () => {
    it('should show loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      expect(screen.getByTestId('directory-browser-loading')).toBeInTheDocument();
    });

    it('should load and display home directory on mount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('my-repo')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledWith('/api/filesystem/browse');
    });

    it('should display folder icon for regular directories', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      const projectsEntry = screen.getByTestId('entry-/home/user/projects');
      expect(projectsEntry.querySelector('[data-testid="folder-icon"]')).toBeInTheDocument();
    });

    it('should display git repository icon for git repositories', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      const gitRepoEntry = screen.getByTestId('entry-/home/user/my-repo');
      expect(gitRepoEntry.querySelector('[data-testid="git-folder-icon"]')).toBeInTheDocument();
    });

    it('should display file icon for files', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('readme.txt')).toBeInTheDocument();
      });

      const fileEntry = screen.getByTestId('entry-/home/user/readme.txt');
      expect(fileEntry.querySelector('[data-testid="file-icon"]')).toBeInTheDocument();
    });

    it('should not display hidden files by default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      expect(screen.queryByText('.config')).not.toBeInTheDocument();
    });
  });

  describe('Directory navigation', () => {
    it('should navigate to subdirectory on click', async () => {
      mockFetch.mockImplementation((url: string) => {
        // URL contains path= query parameter for subdirectory
        if (url.includes('path=') && url.includes('projects')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSubDirectoryResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeDirectoryResponse,
        });
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      // Click on the list item element directly using data-testid
      fireEvent.click(screen.getByTestId('entry-/home/user/projects'));

      await waitFor(() => {
        expect(screen.getByText('project-a')).toBeInTheDocument();
      });

      // Verify that fetch was called with the projects path at some point
      const fetchCalls = mockFetch.mock.calls.map((call) => call[0]);
      expect(fetchCalls).toContain('/api/filesystem/browse?path=%2Fhome%2Fuser%2Fprojects');
    });

    it('should show back button when not at home directory', async () => {
      mockFetch.mockImplementation((url: string) => {
        // URL contains path= query parameter for subdirectory
        if (url.includes('path=') && url.includes('projects')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSubDirectoryResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeDirectoryResponse,
        });
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      // Wait for home directory to load first
      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      // Navigate to subdirectory by clicking on the entry
      fireEvent.click(screen.getByTestId('entry-/home/user/projects'));

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('should navigate to parent directory on back button click', async () => {
      mockFetch.mockImplementation((url: string) => {
        // URL contains path= query parameter for subdirectory (projects)
        if (url.includes('path=') && url.includes('projects')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSubDirectoryResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeDirectoryResponse,
        });
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      // Wait for home directory to load first
      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      // Navigate to subdirectory by clicking on the entry
      fireEvent.click(screen.getByTestId('entry-/home/user/projects'));

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      // Wait for the home directory to be displayed again
      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      // Verify that fetch was called with the parent path at some point
      const fetchCalls = mockFetch.mock.calls.map((call) => call[0]);
      expect(fetchCalls).toContain('/api/filesystem/browse?path=%2Fhome%2Fuser');
    });
  });

  describe('Git repository selection', () => {
    it('should select git repository on double click', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.doubleClick(screen.getByText('my-repo'));

      expect(mockOnSelect).toHaveBeenCalledWith('/home/user/my-repo');
    });

    it('should highlight selected entry on single click', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('my-repo'));

      const gitRepoEntry = screen.getByTestId('entry-/home/user/my-repo');
      expect(gitRepoEntry).toHaveClass('selected');
    });

    it('should enable select button when git repository is selected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-button');
      expect(selectButton).toBeDisabled();

      fireEvent.click(screen.getByText('my-repo'));

      expect(selectButton).not.toBeDisabled();
    });

    it('should call onSelect with path when select button is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('my-repo'));
      fireEvent.click(screen.getByTestId('select-button'));

      expect(mockOnSelect).toHaveBeenCalledWith('/home/user/my-repo');
    });
  });

  describe('Breadcrumb navigation', () => {
    it('should display breadcrumb for current path', async () => {
      mockFetch.mockImplementation((url: string) => {
        // URL contains encoded path for projects directory
        if (url.includes('path=') && url.includes('projects')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSubDirectoryResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeDirectoryResponse,
        });
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      // Wait for home directory to load
      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      // Navigate to subdirectory by clicking the entry
      fireEvent.click(screen.getByTestId('entry-/home/user/projects'));

      // Wait for subdirectory to load
      await waitFor(() => {
        expect(screen.getByText('project-a')).toBeInTheDocument();
      });

      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
      expect(screen.getByText('~')).toBeInTheDocument();
      // Note: 'projects' will be in both breadcrumb and entry list for project-b
      expect(screen.getByTestId('breadcrumb-projects')).toBeInTheDocument();
    });

    it('should navigate to directory when breadcrumb segment is clicked', async () => {
      mockFetch.mockImplementation((url: string) => {
        // URL contains encoded path for projects directory
        if (url.includes('path=') && url.includes('projects')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSubDirectoryResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockHomeDirectoryResponse,
        });
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      // Wait for home directory to load
      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      // Navigate to subdirectory by clicking the entry
      fireEvent.click(screen.getByTestId('entry-/home/user/projects'));

      // Wait for subdirectory to load
      await waitFor(() => {
        expect(screen.getByText('project-a')).toBeInTheDocument();
      });

      // Click on home breadcrumb
      fireEvent.click(screen.getByTestId('breadcrumb-home'));

      // Wait for home directory to be displayed again
      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and error states', () => {
    it('should display loading state while fetching', async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementation(() => fetchPromise);

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      expect(screen.getByTestId('directory-browser-loading')).toBeInTheDocument();

      resolvePromise!({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('directory-browser-loading')).not.toBeInTheDocument();
      });
    });

    it('should display error message when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Access denied' }),
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByTestId('directory-browser-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Access denied')).toBeInTheDocument();
    });

    it('should display error message when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByTestId('directory-browser-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should allow retry after error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHomeDirectoryResponse,
        });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByTestId('directory-browser-error')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHomeDirectoryResponse,
      });

      render(<DirectoryBrowser onSelect={mockOnSelect} onCancel={mockOnCancel} />);

      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
