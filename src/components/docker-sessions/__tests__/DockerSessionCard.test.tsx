import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DockerSessionCard } from '../DockerSessionCard';
import type { DockerSession } from '@/types/docker-session';

describe('DockerSessionCard', () => {
  const mockSession: DockerSession = {
    id: 'session-123',
    name: 'test-session',
    containerId: 'container-abc',
    volumeName: 'claudework-test-session',
    repoUrl: 'https://github.com/test/repo.git',
    branch: 'main',
    status: 'running',
    createdAt: '2025-01-06T00:00:00Z',
    updatedAt: '2025-01-06T00:00:00Z',
  };

  const mockHandlers = {
    onStart: vi.fn().mockResolvedValue(undefined),
    onStop: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onConnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render session information', () => {
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    expect(screen.getByText('test-session')).toBeInTheDocument();
    expect(screen.getByText(/Repo:/)).toBeInTheDocument();
    expect(screen.getByText(/Branch:/)).toBeInTheDocument();
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
  });

  it('should display Running status badge for running session', () => {
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should display Stopped status badge for stopped session', () => {
    const stoppedSession = { ...mockSession, status: 'stopped' as const };
    render(<DockerSessionCard session={stoppedSession} {...mockHandlers} />);

    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('should display Creating status badge for creating session', () => {
    const creatingSession = { ...mockSession, status: 'creating' as const };
    render(<DockerSessionCard session={creatingSession} {...mockHandlers} />);

    expect(screen.getByText('Creating')).toBeInTheDocument();
  });

  it('should display Error status badge for error session', () => {
    const errorSession = { ...mockSession, status: 'error' as const };
    render(<DockerSessionCard session={errorSession} {...mockHandlers} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should show connect button for running session with container', () => {
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    expect(screen.getByTestId('connect-button')).toBeInTheDocument();
  });

  it('should not show connect button for stopped session', () => {
    const stoppedSession = { ...mockSession, status: 'stopped' as const };
    render(<DockerSessionCard session={stoppedSession} {...mockHandlers} />);

    expect(screen.queryByTestId('connect-button')).not.toBeInTheDocument();
  });

  it('should show start button for stopped session', () => {
    const stoppedSession = { ...mockSession, status: 'stopped' as const };
    render(<DockerSessionCard session={stoppedSession} {...mockHandlers} />);

    expect(screen.getByTestId('start-button')).toBeInTheDocument();
  });

  it('should show stop button for running session', () => {
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    expect(screen.getByTestId('stop-button')).toBeInTheDocument();
  });

  it('should call onConnect when connect button is clicked', () => {
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    fireEvent.click(screen.getByTestId('connect-button'));

    expect(mockHandlers.onConnect).toHaveBeenCalledWith('session-123');
  });

  it('should call onStart when start button is clicked', async () => {
    const stoppedSession = { ...mockSession, status: 'stopped' as const };
    render(<DockerSessionCard session={stoppedSession} {...mockHandlers} />);

    fireEvent.click(screen.getByTestId('start-button'));

    await waitFor(() => {
      expect(mockHandlers.onStart).toHaveBeenCalledWith('session-123');
    });
  });

  it('should call onStop when stop button is clicked', async () => {
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    fireEvent.click(screen.getByTestId('stop-button'));

    await waitFor(() => {
      expect(mockHandlers.onStop).toHaveBeenCalledWith('session-123');
    });
  });

  it('should call onDelete when delete button is clicked and confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    fireEvent.click(screen.getByTestId('delete-button'));

    await waitFor(() => {
      expect(mockHandlers.onDelete).toHaveBeenCalledWith('session-123');
    });
  });

  it('should not call onDelete when delete is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    fireEvent.click(screen.getByTestId('delete-button'));

    expect(mockHandlers.onDelete).not.toHaveBeenCalled();
  });

  it('should display error message when action fails', async () => {
    mockHandlers.onStop.mockRejectedValueOnce(new Error('Network error'));
    render(<DockerSessionCard session={mockSession} {...mockHandlers} />);

    fireEvent.click(screen.getByTestId('stop-button'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
