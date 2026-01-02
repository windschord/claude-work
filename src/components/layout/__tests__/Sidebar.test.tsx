import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useAppStore } from '@/store';
import { useUIStore } from '@/store/ui';
import type { Project, Session } from '@/store';

// Zustandストアをモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// UIストアをモック（デフォルト展開動作）
const mockToggleProject = vi.fn();
const collapsedProjectsSet = new Set<string>();

vi.mock('@/store/ui', () => ({
  useUIStore: vi.fn(() => ({
    isProjectExpanded: (projectId: string) => !collapsedProjectsSet.has(projectId),
    toggleProject: mockToggleProject.mockImplementation((projectId: string) => {
      if (collapsedProjectsSet.has(projectId)) {
        collapsedProjectsSet.delete(projectId);
      } else {
        collapsedProjectsSet.add(projectId);
      }
    }),
  })),
}));

// Next.js routerをモック
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Sidebar', () => {
  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'プロジェクトA',
      path: '/path/to/project-a',
      default_model: 'claude-opus-4',
      run_scripts: [],
      session_count: 3,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'project-2',
      name: 'プロジェクトB',
      path: '/path/to/project-b',
      default_model: 'claude-sonnet-4',
      run_scripts: [],
      session_count: 1,
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  const mockSessions: Session[] = [
    {
      id: 'session-1',
      name: 'セッション1',
      status: 'running',
      project_id: 'project-1',
      model: 'claude-opus-4',
      worktree_path: '/path/to/worktree1',
      branch_name: 'feature/test1',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'session-2',
      name: 'セッション2',
      status: 'completed',
      project_id: 'project-1',
      model: 'claude-opus-4',
      worktree_path: '/path/to/worktree2',
      branch_name: 'feature/test2',
      created_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'session-3',
      name: 'セッション3',
      status: 'stopped',
      project_id: 'project-2',
      model: 'claude-sonnet-4',
      worktree_path: '/path/to/worktree3',
      branch_name: 'feature/test3',
      created_at: '2024-01-03T00:00:00Z',
    },
  ];

  const mockSetSelectedProjectId = vi.fn();
  const mockSetIsSidebarOpen = vi.fn();
  const mockSetCurrentSessionId = vi.fn();
  const mockFetchSessions = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // collapsedProjectsSetをクリア（デフォルトは全展開）
    collapsedProjectsSet.clear();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      sessions: mockSessions,
      selectedProjectId: null,
      currentSessionId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      setCurrentSessionId: mockSetCurrentSessionId,
      fetchSessions: mockFetchSessions,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });
  });

  it('サイドバーが正しくレンダリングされる', () => {
    render(<Sidebar />);

    // プロジェクト一覧のタイトルが表示される
    expect(screen.getByText('プロジェクト')).toBeInTheDocument();
  });

  it('プロジェクト一覧が表示される', () => {
    render(<Sidebar />);

    const projectAElements = screen.getAllByText('プロジェクトA');
    const projectBElements = screen.getAllByText('プロジェクトB');

    expect(projectAElements.length).toBeGreaterThan(0);
    expect(projectBElements.length).toBeGreaterThan(0);
  });

  it('プロジェクトのトグルボタンが展開/折りたたみを切り替える', () => {
    render(<Sidebar />);

    // デフォルトで展開されているのでセッションが表示される
    expect(screen.getByText('セッション1')).toBeInTheDocument();

    // トグルボタンをクリックしてプロジェクトを折りたたむ
    const toggleButtons = screen.getAllByTestId('project-toggle');
    fireEvent.click(toggleButtons[0]);

    // toggleProjectが呼ばれたことを確認
    expect(mockToggleProject).toHaveBeenCalledWith('project-1');
  });

  it('セッションをクリックすると詳細ページに遷移する', () => {
    mockPush.mockClear();

    render(<Sidebar />);

    // デフォルトで展開されているのでセッションが表示される
    // セッションをクリック
    fireEvent.click(screen.getByText('セッション1'));

    expect(mockPush).toHaveBeenCalledWith('/sessions/session-1');
    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('project-1');
  });

  it('選択中のセッションがハイライトされる', () => {
    // currentSessionIdを設定した新しいモックを作成
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      projects: mockProjects,
      sessions: mockSessions,
      selectedProjectId: 'project-1',
      currentSessionId: 'session-1',
      setSelectedProjectId: mockSetSelectedProjectId,
      setCurrentSessionId: mockSetCurrentSessionId,
      fetchSessions: mockFetchSessions,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    }));

    render(<Sidebar />);

    // デフォルトで展開されているので、ハイライトを確認
    // bg-blue-50クラスを持つボタンを探す
    const sessionButtons = screen.getAllByRole('button');
    const highlightedButton = sessionButtons.find(btn => btn.textContent?.includes('セッション1'));
    expect(highlightedButton).toHaveClass('bg-blue-50');
  });

  it('プロジェクトが0件の場合、メッセージが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: [],
      sessions: [],
      selectedProjectId: null,
      currentSessionId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      setCurrentSessionId: mockSetCurrentSessionId,
      fetchSessions: mockFetchSessions,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    expect(screen.getByText('プロジェクトがありません')).toBeInTheDocument();
  });

  it('モバイルでサイドバーが閉じている時は非表示になる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      sessions: mockSessions,
      selectedProjectId: null,
      currentSessionId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      setCurrentSessionId: mockSetCurrentSessionId,
      fetchSessions: mockFetchSessions,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    const { container } = render(<Sidebar />);

    // サイドバーが-translate-x-fullクラスを持つ（画面外）
    const sidebar = container.querySelector('aside');
    expect(sidebar).toHaveClass('-translate-x-full');
  });

  it('モバイルでサイドバーが開いている時は表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      sessions: mockSessions,
      selectedProjectId: null,
      currentSessionId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      setCurrentSessionId: mockSetCurrentSessionId,
      fetchSessions: mockFetchSessions,
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    const { container } = render(<Sidebar />);

    // サイドバーがtranslate-x-0クラスを持つ（表示）
    const sidebar = container.querySelector('aside');
    expect(sidebar).toHaveClass('translate-x-0');
  });

  it('モバイルでセッションをクリックするとサイドバーが閉じる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      sessions: mockSessions,
      selectedProjectId: null,
      currentSessionId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      setCurrentSessionId: mockSetCurrentSessionId,
      fetchSessions: mockFetchSessions,
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    // デフォルトで展開されているのでセッションが表示される
    // セッションをクリック
    fireEvent.click(screen.getByText('セッション1'));

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('プロジェクトトグルボタンがクリック可能な状態である', () => {
    render(<Sidebar />);

    const toggleButtons = screen.getAllByTestId('project-toggle');

    expect(toggleButtons.length).toBeGreaterThan(0);
    toggleButtons.forEach(button => {
      expect(button).not.toBeDisabled();
      expect(button).toBeVisible();
    });
  });

  it('プロジェクトボタンのz-indexが適切に設定されている', () => {
    const { container } = render(<Sidebar />);

    const sidebar = container.querySelector('aside');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('z-40');
  });

  it('複数のプロジェクトがある場合、すべてのトグルボタンがクリック可能である', () => {
    render(<Sidebar />);

    const toggleButtons = screen.getAllByTestId('project-toggle');

    expect(toggleButtons).toHaveLength(2);
    toggleButtons.forEach(button => {
      expect(button).not.toBeDisabled();
      expect(button).toBeVisible();
    });
  });

  it('セッションクリック時、正しいイベントハンドラーが実行される', () => {
    mockPush.mockClear();
    mockSetSelectedProjectId.mockClear();
    mockSetCurrentSessionId.mockClear();

    render(<Sidebar />);

    // デフォルトで展開されているのでセッション3が表示される
    // セッション3をクリック
    fireEvent.click(screen.getByText('セッション3'));

    expect(mockSetCurrentSessionId).toHaveBeenCalledWith('session-3');
    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('project-2');
    expect(mockPush).toHaveBeenCalledWith('/sessions/session-3');
  });

  describe('Tree表示', () => {
    it('デフォルトでプロジェクトが展開されセッションが表示される', () => {
      render(<Sidebar />);

      // デフォルトで展開されているのでセッションが表示される
      expect(screen.getByText('セッション1')).toBeInTheDocument();
      expect(screen.getByText('セッション2')).toBeInTheDocument();
      expect(screen.getByText('セッション3')).toBeInTheDocument();
    });

    it('展開状態が保持される', () => {
      const { rerender } = render(<Sidebar />);

      // デフォルトで展開されている
      expect(screen.getByText('セッション1')).toBeInTheDocument();

      // 再レンダリング
      rerender(<Sidebar />);

      // 展開状態が維持されていることを確認
      expect(screen.getByText('セッション1')).toBeInTheDocument();
    });

    it('セッションクリック時にcurrentSessionIdが更新される', () => {
      render(<Sidebar />);

      // デフォルトで展開されているのでセッションが表示される
      // セッションをクリック
      fireEvent.click(screen.getByText('セッション1'));

      expect(mockSetCurrentSessionId).toHaveBeenCalledWith('session-1');
    });

    it('現在のセッションがハイライトされる', () => {
      (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        projects: mockProjects,
        sessions: mockSessions,
        selectedProjectId: null,
        currentSessionId: 'session-1',
        setSelectedProjectId: mockSetSelectedProjectId,
        setCurrentSessionId: mockSetCurrentSessionId,
        fetchSessions: mockFetchSessions,
        isSidebarOpen: false,
        setIsSidebarOpen: mockSetIsSidebarOpen,
      });

      render(<Sidebar />);

      // デフォルトで展開されているので、ハイライトを確認
      const sessionButtons = screen.getAllByRole('button');
      const session1Button = sessionButtons.find(btn => btn.textContent?.includes('セッション1'));
      expect(session1Button).toHaveClass('bg-blue-50');
    });

    it('追加ボタンが表示される', () => {
      render(<Sidebar />);

      const addButtons = screen.getAllByTestId('add-session-button');
      expect(addButtons).toHaveLength(2); // 2つのプロジェクトに対して
    });

    it('プロジェクトごとにセッションがグループ化される', () => {
      render(<Sidebar />);

      // デフォルトで両プロジェクトが展開されているので、全セッションが表示される
      expect(screen.getByText('セッション1')).toBeInTheDocument();
      expect(screen.getByText('セッション2')).toBeInTheDocument();
      expect(screen.getByText('セッション3')).toBeInTheDocument();
    });
  });
});
