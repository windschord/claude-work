import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProjectDetailPage from '../[id]/page';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// Next.jsのナビゲーションモック
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({
    id: 'project-1',
  }),
}));

// コンポーネントのモック
vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ProjectDetailPage', () => {
  const mockFetchSessions = vi.fn();
  const mockCreateSession = vi.fn();
  const mockCheckAuth = vi.fn();

  const mockSessions = [
    {
      id: 'session-1',
      project_id: 'project-1',
      name: 'Session 1',
      status: 'running' as const,
      model: 'claude-3-opus',
      worktree_path: '/path/to/worktree1',
      branch_name: 'feature/test1',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'session-2',
      project_id: 'project-1',
      name: 'Session 2',
      status: 'completed' as const,
      model: 'claude-3-sonnet',
      worktree_path: '/path/to/worktree2',
      branch_name: 'feature/test2',
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockFetchSessions.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue(undefined);
    mockCheckAuth.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      sessions: mockSessions,
      selectedSessionId: null,
      fetchSessions: mockFetchSessions,
      createSession: mockCreateSession,
      checkAuth: mockCheckAuth,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('セッション一覧が表示される', async () => {
    render(<ProjectDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
      expect(screen.getByText('Session 2')).toBeInTheDocument();
    });
  });

  it('各セッションにステータスアイコンが表示される', async () => {
    render(<ProjectDetailPage />);

    await waitFor(() => {
      const statusIcons = screen.getAllByTestId(/status-icon-/);
      expect(statusIcons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('runningステータスのアイコンが正しく表示される', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      sessions: [
        {
          id: 'session-1',
          project_id: 'project-1',
          name: 'Running Session',
          status: 'running' as const,
          model: 'claude-3-opus',
          worktree_path: '/path/to/worktree',
          branch_name: 'feature/test',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      selectedSessionId: null,
      fetchSessions: mockFetchSessions,
      createSession: mockCreateSession,
      checkAuth: mockCheckAuth,
    });

    render(<ProjectDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-icon-running')).toBeInTheDocument();
    });
  });

  it('セッション作成フォームが表示される', () => {
    render(<ProjectDetailPage />);

    expect(screen.getByPlaceholderText(/セッション名/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/プロンプト/)).toBeInTheDocument();
  });

  it('名前とプロンプト入力でセッション作成が成功する', async () => {
    mockCreateSession.mockResolvedValueOnce(undefined);

    render(<ProjectDetailPage />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
        name: 'New Session',
        prompt: 'Test prompt',
      });
    });
  });

  it('名前未入力でバリデーションエラーが表示される', async () => {
    render(<ProjectDetailPage />);

    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('セッション名を入力してください')).toBeInTheDocument();
    });
  });

  it('プロンプト未入力でバリデーションエラーが表示される', async () => {
    render(<ProjectDetailPage />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('プロンプトを入力してください')).toBeInTheDocument();
    });
  });

  it('セッション選択で詳細画面に遷移する', async () => {
    render(<ProjectDetailPage />);

    await waitFor(() => {
      const sessionCard = screen.getByText('Session 1').closest('div');
      if (sessionCard) {
        fireEvent.click(sessionCard);
        expect(mockPush).toHaveBeenCalledWith('/sessions/session-1');
      }
    });
  });

  it('セッションがない場合、空の状態メッセージが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      sessions: [],
      selectedSessionId: null,
      fetchSessions: mockFetchSessions,
      createSession: mockCreateSession,
      checkAuth: mockCheckAuth,
    });

    render(<ProjectDetailPage />);

    expect(screen.getByText(/セッションがありません/)).toBeInTheDocument();
  });

  it('初期化時にfetchSessionsが呼ばれる', async () => {
    render(<ProjectDetailPage />);

    await waitFor(() => {
      expect(mockFetchSessions).toHaveBeenCalledWith('project-1');
    });
  });
});
