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


// CreateSessionFormをモック（storeの参照を避けるため）
vi.mock('@/components/sessions/CreateSessionForm', () => ({
  CreateSessionForm: ({ projectId: _projectId }: { projectId: string }) => (
    <div data-testid="create-session-form">
      <input placeholder="セッション名を入力してください" />
      <textarea placeholder="プロンプトを入力してください" />
      <button type="submit">セッション作成</button>
    </div>
  ),
}));

describe('ProjectDetailPage', () => {
  const mockFetchSessions = vi.fn();
  const mockCreateSession = vi.fn();

  const mockSessions = [
    {
      id: 'session-1',
      project_id: 'project-1',
      name: 'Session 1',
      status: 'running' as const,
      worktree_path: '/path/to/worktree1',
      branch_name: 'feature/test1',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'session-2',
      project_id: 'project-1',
      name: 'Session 2',
      status: 'completed' as const,
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
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sessions: mockSessions,
      selectedSessionId: null,
      projects: [
        {
          id: 'project-1',
          name: 'Test Project',
          path: '/test/path',
          run_scripts: [],
          session_count: 2,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      fetchSessions: mockFetchSessions,
      createSession: mockCreateSession,
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
      sessions: [
        {
          id: 'session-1',
          project_id: 'project-1',
          name: 'Running Session',
          status: 'running' as const,
          worktree_path: '/path/to/worktree',
          branch_name: 'feature/test',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      selectedSessionId: null,
      projects: [
        {
          id: 'project-1',
          name: 'Test Project',
          path: '/test/path',
          run_scripts: [],
          session_count: 1,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      fetchSessions: mockFetchSessions,
      createSession: mockCreateSession,
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

  // NOTE: セッション作成のバリデーションテストはCreateSessionForm.test.tsxで実施
  // このテストファイルではページレベルの動作のみをテスト

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
      sessions: [],
      selectedSessionId: null,
      projects: [
        {
          id: 'project-1',
          name: 'Test Project',
          path: '/test/path',
          run_scripts: [],
          session_count: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      fetchSessions: mockFetchSessions,
      createSession: mockCreateSession,
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
