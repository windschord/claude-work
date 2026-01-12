import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateSessionModal } from '../CreateSessionModal';

describe('CreateSessionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open', () => {
    render(
      <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
    );

    expect(screen.getByText('Create New Session')).toBeInTheDocument();
    expect(screen.getByLabelText(/Session Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repository URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch/i)).toBeInTheDocument();
  });

  it('should not render modal when closed', () => {
    render(
      <CreateSessionModal isOpen={false} onClose={mockOnClose} onCreate={mockOnCreate} />
    );

    expect(screen.queryByText('Create New Session')).not.toBeInTheDocument();
  });

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
        repoUrl: 'https://github.com/user/repo.git',
        branch: 'develop',
      });
    });
  });

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

  it('should have default branch value of "main"', () => {
    render(
      <CreateSessionModal isOpen={true} onClose={mockOnClose} onCreate={mockOnCreate} />
    );

    expect(screen.getByLabelText(/Branch/i)).toHaveValue('main');
  });
});
