import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionDetailPage from '../[id]/page';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// 通知ストアのモック
vi.mock('@/store/notification', () => ({
  useNotificationStore: vi.fn(() => ({
    permission: 'granted',
    requestPermission: vi.fn(),
  })),
}));

// スクリプトログストアのモック
vi.mock('@/store/script-logs', () => ({
  useScriptLogStore: {
    getState: vi.fn(() => ({
      addLog: vi.fn(),
      endRun: vi.fn(),
    })),
  },
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

// useWebSocketフックのモック
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    status: 'connected',
  })),
}));

// コンポーネントのモック
vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ターミナルコンポーネントのモック（dynamic importのため）
vi.mock('@/components/sessions/TerminalPanel', () => ({
  TerminalPanel: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="terminal-panel">Terminal for {sessionId}</div>
  ),
}));

vi.mock('@/components/sessions/ClaudeTerminalPanel', () => ({
  ClaudeTerminalPanel: ({ sessionId }: { sessionId: string; isVisible: boolean }) => (
    <div data-testid="claude-terminal-panel">Claude Terminal for {sessionId}</div>
  ),
}));

// Gitコンポーネントのモック
vi.mock('@/components/git/FileList', () => ({
  FileList: () => <div data-testid="file-list">File List</div>,
}));

vi.mock('@/components/git/DiffViewer', () => ({
  DiffViewer: () => <div data-testid="diff-viewer">Diff Viewer</div>,
}));

vi.mock('@/components/git/RebaseButton', () => ({
  RebaseButton: () => <button data-testid="rebase-button">Rebase</button>,
}));

vi.mock('@/components/git/MergeModal', () => ({
  MergeModal: () => null,
}));

vi.mock('@/components/git/ConflictDialog', () => ({
  ConflictDialog: () => null,
}));

vi.mock('@/components/git/DeleteWorktreeDialog', () => ({
  DeleteWorktreeDialog: () => null,
}));

vi.mock('@/components/git/CommitHistory', () => ({
  CommitHistory: () => <div data-testid="commit-history">Commit History</div>,
}));

vi.mock('@/components/scripts/ScriptsPanel', () => ({
  ScriptsPanel: () => <div data-testid="scripts-panel">Scripts Panel</div>,
}));

vi.mock('@/components/sessions/ProcessStatus', () => ({
  ProcessStatus: () => <div data-testid="process-status">Process Status</div>,
}));

vi.mock('@/components/sessions/DeleteSessionButton', () => ({
  DeleteSessionButton: () => <button data-testid="delete-session-button">Delete</button>,
}));

vi.mock('@/components/sessions/PRSection', () => ({
  PRSection: () => <div data-testid="pr-section">PR Section</div>,
}));

// react-hot-toastのモック
vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SessionDetailPage', () => {
  const mockFetchSessionDetail = vi.fn();
  const mockFetchDiff = vi.fn();
  const mockStopSession = vi.fn();
  const mockDeleteSession = vi.fn();
  const mockHandleWebSocketMessage = vi.fn();

  const mockSession = {
    id: 'session-1',
    project_id: 'project-1',
    name: 'Test Session',
    status: 'running' as const,
    model: 'auto',
    worktree_path: '/path/to/worktree',
    branch_name: 'feature/test',
    pr_url: null,
    pr_number: null,
    pr_status: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockBack.mockClear();
    mockFetchSessionDetail.mockResolvedValue(undefined);
    mockFetchDiff.mockResolvedValue(undefined);
    mockStopSession.mockResolvedValue(undefined);
    mockDeleteSession.mockResolvedValue(undefined);

    // fetchをモック
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ running: true }),
    });

    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentSession: mockSession,
      conflictFiles: null,
      fetchSessionDetail: mockFetchSessionDetail,
      fetchDiff: mockFetchDiff,
      stopSession: mockStopSession,
      deleteSession: mockDeleteSession,
      handleWebSocketMessage: mockHandleWebSocketMessage,
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

  it('セッションステータスとモデルが表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/running/)).toBeInTheDocument();
      expect(screen.getByText(/auto/)).toBeInTheDocument();
    });
  });

  it('タブが表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Claude' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Shell' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Diff' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Commits' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Scripts' })).toBeInTheDocument();
    });
  });

  it('停止ボタンが表示される', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: '停止' });
      expect(stopButton).toBeInTheDocument();
    });
  });

  it('停止ボタンをクリックするとstopSessionが呼ばれる', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: '停止' });
      fireEvent.click(stopButton);
    });

    await waitFor(() => {
      expect(mockStopSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('戻るボタンをクリックするとrouter.backが呼ばれる', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: '戻る' });
      fireEvent.click(backButton);
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it('DiffタブをクリックするとfetchDiffが呼ばれる', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      const diffTab = screen.getByRole('button', { name: 'Diff' });
      fireEvent.click(diffTab);
    });

    await waitFor(() => {
      expect(mockFetchDiff).toHaveBeenCalledWith('session-1');
    });
  });

  it('セッションがない場合、読み込み中が表示される', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentSession: null,
      conflictFiles: null,
      fetchSessionDetail: mockFetchSessionDetail,
      fetchDiff: mockFetchDiff,
      stopSession: mockStopSession,
      deleteSession: mockDeleteSession,
      handleWebSocketMessage: mockHandleWebSocketMessage,
    });

    render(<SessionDetailPage />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('初期化時にfetchSessionDetailが呼ばれる', async () => {
    render(<SessionDetailPage />);

    await waitFor(() => {
      expect(mockFetchSessionDetail).toHaveBeenCalledWith('session-1');
    });
  });

  it('stopped状態のセッションには再開ボタンが表示される', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentSession: { ...mockSession, status: 'stopped' },
      conflictFiles: null,
      fetchSessionDetail: mockFetchSessionDetail,
      fetchDiff: mockFetchDiff,
      stopSession: mockStopSession,
      deleteSession: mockDeleteSession,
      handleWebSocketMessage: mockHandleWebSocketMessage,
    });

    render(<SessionDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '再開' })).toBeInTheDocument();
    });
  });
});
