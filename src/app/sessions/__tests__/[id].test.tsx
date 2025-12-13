import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionDetailPage from '../[id]/page';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// Next.jsのナビゲーションモック
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useParams: () => ({
    id: 'session-1',
  }),
}));

// コンポーネントのモック
vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SessionDetailPage', () => {
  const mockFetchSessionDetail = vi.fn();
  const mockSendMessage = vi.fn();
  const mockApprovePermission = vi.fn();
  const mockStopSession = vi.fn();
  const mockCheckAuth = vi.fn();

  const mockSession = {
    id: 'session-1',
    project_id: 'project-1',
    name: 'Test Session',
    status: 'running' as const,
    model: 'claude-3-5-sonnet-20241022',
    worktree_path: '/path/to/worktree',
    branch_name: 'feature/test',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockMessages = [
    {
      id: 'msg-1',
      session_id: 'session-1',
      role: 'user',
      content: 'Hello',
      sub_agents: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'msg-2',
      session_id: 'session-1',
      role: 'assistant',
      content: 'Hi there!',
      sub_agents: null,
      created_at: '2024-01-01T00:01:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockBack.mockClear();
    mockFetchSessionDetail.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
    mockApprovePermission.mockResolvedValue(undefined);
    mockStopSession.mockResolvedValue(undefined);
    mockCheckAuth.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      currentSession: mockSession,
      messages: mockMessages,
      fetchSessionDetail: mockFetchSessionDetail,
      sendMessage: mockSendMessage,
      approvePermission: mockApprovePermission,
      stopSession: mockStopSession,
      checkAuth: mockCheckAuth,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('セッション詳細が表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });
  });

  it('メッセージ履歴が表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  it('ユーザーメッセージとアシスタントメッセージが区別される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const userMessage = screen.getByText('Hello').closest('[data-role]');
      const assistantMessage = screen.getByText('Hi there!').closest('[data-role]');

      expect(userMessage?.getAttribute('data-role')).toBe('user');
      expect(assistantMessage?.getAttribute('data-role')).toBe('assistant');
    });
  });

  it('ユーザー入力フォームが表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/メッセージを入力/i);
      expect(input).toBeInTheDocument();
    });
  });

  it('メッセージを送信できる', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/メッセージを入力/i);
      const sendButton = screen.getByRole('button', { name: /送信/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('session-1', 'Test message');
    });
  });

  it('セッション停止ボタンが表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: /停止/i });
      expect(stopButton).toBeInTheDocument();
    });
  });

  it('セッション停止ボタンをクリックするとstopSessionが呼ばれる', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: /停止/i });
      fireEvent.click(stopButton);

      expect(mockStopSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('runningまたはwaiting_input状態のときポーリングが実行される', async () => {
    vi.useFakeTimers();
    render(<SessionDetailPage />);

    // Initial fetch
    expect(mockFetchSessionDetail).toHaveBeenCalledTimes(1);

    // After 3 seconds
    vi.advanceTimersByTime(3000);
    await waitFor(() => {
      expect(mockFetchSessionDetail).toHaveBeenCalledTimes(2);
    });

    // After another 3 seconds
    vi.advanceTimersByTime(3000);
    await waitFor(() => {
      expect(mockFetchSessionDetail).toHaveBeenCalledTimes(3);
    });

    vi.useRealTimers();
  });

  it('completed状態のときポーリングが停止する', async () => {
    vi.useFakeTimers();

    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      currentSession: { ...mockSession, status: 'completed' },
      messages: mockMessages,
      fetchSessionDetail: mockFetchSessionDetail,
      sendMessage: mockSendMessage,
      approvePermission: mockApprovePermission,
      stopSession: mockStopSession,
      checkAuth: mockCheckAuth,
    });

    render(<SessionDetailPage />);

    // Initial fetch
    expect(mockFetchSessionDetail).toHaveBeenCalledTimes(1);

    // After 3 seconds, should not fetch again
    vi.advanceTimersByTime(3000);
    await waitFor(() => {
      expect(mockFetchSessionDetail).toHaveBeenCalledTimes(1);
    });

    vi.useRealTimers();
  });
});
