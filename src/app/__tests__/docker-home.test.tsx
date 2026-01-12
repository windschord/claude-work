/**
 * Docker session統合ホームページのテスト
 * タスク5.4: メインページの更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the hooks
const mockFetchSessions = vi.fn();
const mockCreateSession = vi.fn().mockResolvedValue({ id: 'new-session', name: 'new-session', status: 'creating' });
const mockStartSession = vi.fn();
const mockStopSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('@/hooks/useDockerSessions', () => ({
  useDockerSessions: vi.fn(() => ({
    sessions: [
      { id: 'session-1', name: 'Test Session 1', status: 'running' },
      { id: 'session-2', name: 'Test Session 2', status: 'stopped' },
    ],
    loading: false,
    error: null,
    fetchSessions: mockFetchSessions,
    createSession: mockCreateSession,
    startSession: mockStartSession,
    stopSession: mockStopSession,
    deleteSession: mockDeleteSession,
  })),
}));

// Mock the components
vi.mock('@/components/docker-sessions', () => ({
  DockerSessionList: vi.fn(
    ({ onRefresh, onStart, onStop, onDelete, onConnect }) => (
      <div data-testid="docker-session-list">
        <button
          data-testid="connect-session-btn"
          onClick={() => onConnect('session-123')}
        >
          Connect
        </button>
        <button data-testid="refresh-btn" onClick={onRefresh}>
          Refresh
        </button>
        <button data-testid="start-btn" onClick={() => onStart('session-1')}>
          Start
        </button>
        <button data-testid="stop-btn" onClick={() => onStop('session-1')}>
          Stop
        </button>
        <button data-testid="delete-btn" onClick={() => onDelete('session-1')}>
          Delete
        </button>
      </div>
    )
  ),
  CreateSessionModal: vi.fn(({ isOpen, onClose, onCreate }) =>
    isOpen ? (
      <div data-testid="create-session-modal">
        <button data-testid="close-modal-btn" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="create-success-btn"
          onClick={async () => {
            await onCreate({ name: 'new-session', repoUrl: 'https://example.com/repo', branch: 'main' });
            onClose();
          }}
        >
          Create
        </button>
      </div>
    ) : null
  ),
  DockerTerminalPanel: vi.fn(({ sessionId }) => (
    <div data-testid="docker-terminal-panel">Terminal: {sessionId}</div>
  )),
}));

// Import after mocks
import DockerHome from '../docker/page';

describe('DockerHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render session list and header', async () => {
    render(<DockerHome />);

    await waitFor(() => {
      expect(screen.getByTestId('docker-session-list')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Docker Sessions', level: 2 })).toBeInTheDocument();
    });
  });

  it('should show "No session selected" message initially', async () => {
    render(<DockerHome />);

    await waitFor(() => {
      expect(screen.getByText('No session selected')).toBeInTheDocument();
    });
  });

  it('should show terminal when session is connected', async () => {
    render(<DockerHome />);

    // Click on connect button
    const connectBtn = screen.getByTestId('connect-session-btn');
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(screen.getByTestId('docker-terminal-panel')).toBeInTheDocument();
      expect(screen.getByText('Terminal: session-123')).toBeInTheDocument();
    });
  });

  it('should open create session modal when clicking Plus button', async () => {
    render(<DockerHome />);

    // Click create button (Plus icon in header)
    const createBtn = screen.getByTitle('Create new session');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByTestId('create-session-modal')).toBeInTheDocument();
    });
  });

  it('should close modal when close button is clicked', async () => {
    render(<DockerHome />);

    // Open modal
    const createBtn = screen.getByTitle('Create new session');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByTestId('create-session-modal')).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getByTestId('close-modal-btn');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(
        screen.queryByTestId('create-session-modal')
      ).not.toBeInTheDocument();
    });
  });

  it('should select new session after creation', async () => {
    render(<DockerHome />);

    // Open modal
    const createBtn = screen.getByTitle('Create new session');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByTestId('create-session-modal')).toBeInTheDocument();
    });

    // Create session
    const createSuccessBtn = screen.getByTestId('create-success-btn');
    fireEvent.click(createSuccessBtn);

    await waitFor(() => {
      // Modal should close
      expect(
        screen.queryByTestId('create-session-modal')
      ).not.toBeInTheDocument();
      // Terminal should show with new session
      expect(screen.getByText('Terminal: new-session')).toBeInTheDocument();
    });
  });

  it('should call startSession when start button is clicked', async () => {
    render(<DockerHome />);

    const startBtn = screen.getByTestId('start-btn');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('should call stopSession when stop button is clicked', async () => {
    render(<DockerHome />);

    const stopBtn = screen.getByTestId('stop-btn');
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(mockStopSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('should call deleteSession when delete button is clicked', async () => {
    render(<DockerHome />);

    const deleteBtn = screen.getByTestId('delete-btn');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('should call fetchSessions when refresh button is clicked', async () => {
    render(<DockerHome />);

    const refreshBtn = screen.getByTestId('refresh-btn');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockFetchSessions).toHaveBeenCalled();
    });
  });
});
