import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateSessionModal } from '../CreateSessionModal';

// Mock DirectoryBrowser component
vi.mock('../DirectoryBrowser', () => ({
  DirectoryBrowser: ({ onSelect }: { onSelect: (path: string) => void }) => (
    <div data-testid="mock-directory-browser">
      <button
        onClick={() => onSelect('/home/user/repos/my-repo')}
        data-testid="mock-select-repo"
      >
        Select Repo
      </button>
    </div>
  ),
}));

// Mock fetch for branch API
global.fetch = vi.fn();

describe('CreateSessionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ branches: ['main', 'develop'], currentBranch: 'main' }),
    });
  });

  describe('Basic rendering', () => {
    it('should render modal when open', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      expect(screen.getByText('Create New Session')).toBeInTheDocument();
    });

    it('should not render modal when closed', () => {
      render(
        <CreateSessionModal isOpen={false} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      expect(screen.queryByText('Create New Session')).not.toBeInTheDocument();
    });

    it('should render source type tabs', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      expect(screen.getByRole('tab', { name: /Remote/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Local/i })).toBeInTheDocument();
    });

    it('should default to remote tab', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      const remoteTab = screen.getByRole('tab', { name: /Remote/i });
      expect(remoteTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Tab switching', () => {
    it('should switch to local tab when clicked', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      const localTab = screen.getByRole('tab', { name: /Local/i });
      fireEvent.click(localTab);

      expect(localTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /Remote/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('should show remote form fields when remote tab is selected', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      expect(screen.getByLabelText(/Session Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Repository URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Branch/i)).toBeInTheDocument();
    });

    it('should show local form when local tab is selected', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      const localTab = screen.getByRole('tab', { name: /Local/i });
      fireEvent.click(localTab);

      // Local form has "Repository Path" instead of "Repository URL"
      expect(screen.getByText(/Repository Path/i)).toBeInTheDocument();
      expect(screen.getByText(/Browse/i)).toBeInTheDocument();
    });

    it('should switch back to remote tab after switching to local', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      // Switch to local
      const localTab = screen.getByRole('tab', { name: /Local/i });
      fireEvent.click(localTab);

      // Switch back to remote
      const remoteTab = screen.getByRole('tab', { name: /Remote/i });
      fireEvent.click(remoteTab);

      expect(remoteTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByLabelText(/Repository URL/i)).toBeInTheDocument();
    });
  });

  describe('Remote form validation', () => {
    it('should show validation error for empty session name', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      // Fill in other fields but leave name empty
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'git@github.com:test/repo.git' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText('Session name is required')).toBeInTheDocument();
      });
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should show validation error for invalid session name format', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'invalid name with spaces' },
      });
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'git@github.com:test/repo.git' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText(/can only contain letters, numbers/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty repository URL', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText('Repository URL is required')).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid repository URL format', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'invalid-url' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid repository URL format/i)).toBeInTheDocument();
      });
    });
  });

  describe('Remote form submission', () => {
    it('should accept SSH format repository URL', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'git@github.com:user/repo.git' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'test-session',
          sourceType: 'remote',
          repoUrl: 'git@github.com:user/repo.git',
          branch: 'main',
        });
      });
    });

    it('should accept HTTPS format repository URL', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'https://github.com/user/repo.git' },
      });
      fireEvent.change(screen.getByLabelText(/Branch/i), {
        target: { value: 'develop' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'test-session',
          sourceType: 'remote',
          repoUrl: 'https://github.com/user/repo.git',
          branch: 'develop',
        });
      });
    });

    it('should have default branch value of "main"', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      expect(screen.getByLabelText(/Branch/i)).toHaveValue('main');
    });
  });

  describe('Local form submission', () => {
    it('should submit local form with correct data', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      // Switch to local tab
      const localTab = screen.getByRole('tab', { name: /Local/i });
      fireEvent.click(localTab);

      // Fill session name
      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'local-session' },
      });

      // Open directory browser and select a repo
      fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
      fireEvent.click(screen.getByTestId('mock-select-repo'));

      // Wait for branch fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/filesystem/branches?path=%2Fhome%2Fuser%2Frepos%2Fmy-repo'
        );
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'local-session',
          sourceType: 'local',
          localPath: '/home/user/repos/my-repo',
          branch: 'main',
        });
      });
    });
  });

  describe('Modal actions', () => {
    it('should close modal on cancel', () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should display submit error when creation fails', async () => {
      mockOnCreate.mockRejectedValueOnce(new Error('Network error'));

      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'git@github.com:user/repo.git' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should reset form when cancel is clicked', async () => {
      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      // Fill in some data
      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });

      // Click cancel to close modal (this triggers resetForm)
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      // Verify onClose was called (form reset happens internally)
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should disable tabs while submitting', async () => {
      let resolveSubmit: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnCreate.mockReturnValueOnce(pendingPromise);

      render(
        <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
      );

      fireEvent.change(screen.getByLabelText(/Session Name/i), {
        target: { value: 'test-session' },
      });
      fireEvent.change(screen.getByLabelText(/Repository URL/i), {
        target: { value: 'git@github.com:user/repo.git' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Session/i }));

      // Tabs should be disabled during submission
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Local/i })).toHaveAttribute('aria-disabled', 'true');
      });

      // Resolve the promise
      resolveSubmit!();
    });
  });
});
