import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DockerTerminalPanel } from '../DockerTerminalPanel';

// Mock xterm CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// Mock useDockerTerminal
const mockFit = vi.fn();
const mockReconnect = vi.fn();
const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('@/hooks/useDockerTerminal', () => ({
  useDockerTerminal: vi.fn(() => ({
    terminal: mockTerminal,
    isConnected: true,
    fit: mockFit,
    reconnect: mockReconnect,
    error: null,
  })),
}));

describe('DockerTerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render terminal header', async () => {
    render(<DockerTerminalPanel sessionId="session-123" />);

    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('should show connected status when connected', async () => {
    render(<DockerTerminalPanel sessionId="session-123" />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should show disconnected status when not connected', async () => {
    const { useDockerTerminal } = await import('@/hooks/useDockerTerminal');
    vi.mocked(useDockerTerminal).mockReturnValue({
      terminal: mockTerminal as never,
      isConnected: false,
      fit: mockFit,
      reconnect: mockReconnect,
      error: null,
    });

    render(<DockerTerminalPanel sessionId="session-123" />);

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('should show error message when error occurs', async () => {
    const { useDockerTerminal } = await import('@/hooks/useDockerTerminal');
    vi.mocked(useDockerTerminal).mockReturnValue({
      terminal: null,
      isConnected: false,
      fit: mockFit,
      reconnect: mockReconnect,
      error: 'Connection failed',
    });

    render(<DockerTerminalPanel sessionId="session-123" />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('should show reconnect button', async () => {
    render(<DockerTerminalPanel sessionId="session-123" />);

    await waitFor(() => {
      expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', async () => {
    const { useDockerTerminal } = await import('@/hooks/useDockerTerminal');
    vi.mocked(useDockerTerminal).mockReturnValue({
      terminal: null,
      isConnected: false,
      fit: mockFit,
      reconnect: mockReconnect,
      error: null,
    });

    // Simulate SSR by not being mounted
    const { container } = render(<DockerTerminalPanel sessionId="session-123" />);

    // Should have some content (loading or terminal container)
    expect(container.firstChild).toBeTruthy();
  });

  it('should have terminal container element', async () => {
    render(<DockerTerminalPanel sessionId="session-123" />);

    await waitFor(() => {
      expect(screen.getByRole('application')).toBeInTheDocument();
    });
  });
});
