import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useAppStore } from '@/store';
import type { Project } from '@/store';

// Zustandストアをモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
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

  const mockSetSelectedProjectId = vi.fn();
  const mockSetIsSidebarOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
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

  it('セッション数が表示される', () => {
    const { container } = render(<Sidebar />);

    const sessionCounts = container.querySelectorAll('.text-xs.text-gray-500');
    const sessionTexts = Array.from(sessionCounts).map(el => el.textContent);

    expect(sessionTexts).toContain('3セッション');
    expect(sessionTexts).toContain('1セッション');
  });

  it('プロジェクトをクリックすると選択状態が変わる', () => {
    render(<Sidebar />);

    const buttons = screen.getAllByRole('button');
    const projectAButton = buttons.find(button => button.textContent?.includes('プロジェクトA'));

    expect(projectAButton).toBeDefined();
    fireEvent.click(projectAButton!);

    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('project-1');
  });

  it('プロジェクトをクリックすると詳細ページに遷移する', () => {
    mockPush.mockClear();

    render(<Sidebar />);

    const buttons = screen.getAllByRole('button');
    const projectAButton = buttons.find(button => button.textContent?.includes('プロジェクトA'));

    expect(projectAButton).toBeDefined();
    fireEvent.click(projectAButton!);

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1');
  });

  it('選択中のプロジェクトがハイライトされる', () => {
    // selectedProjectIdを設定した新しいモックを作成
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      projects: mockProjects,
      selectedProjectId: 'project-1',
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    }));

    const { container } = render(<Sidebar />);

    // bg-blue-100クラスを持つボタンを探す
    const highlightedButton = container.querySelector('button.bg-blue-100');
    expect(highlightedButton).toBeInTheDocument();
    expect(highlightedButton?.textContent).toContain('プロジェクトA');
  });

  it('プロジェクトが0件の場合、メッセージが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: [],
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    expect(screen.getByText('プロジェクトがありません')).toBeInTheDocument();
  });

  it('モバイルでサイドバーが閉じている時は非表示になる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
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
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    const { container } = render(<Sidebar />);

    // サイドバーがtranslate-x-0クラスを持つ（表示）
    const sidebar = container.querySelector('aside');
    expect(sidebar).toHaveClass('translate-x-0');
  });

  it('モバイルでプロジェクトをクリックするとサイドバーが閉じる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    const buttons = screen.getAllByRole('button');
    const projectAButton = buttons.find(button => button.textContent?.includes('プロジェクトA'));

    expect(projectAButton).toBeDefined();
    fireEvent.click(projectAButton!);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('プロジェクト配列がundefinedの場合でもエラーにならない', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: undefined,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    // エラーにならずにレンダリングされることを確認
    expect(() => render(<Sidebar />)).not.toThrow();
  });

  it('プロジェクト配列がnullの場合でもエラーにならない', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: null,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    // エラーにならずにレンダリングされることを確認
    expect(() => render(<Sidebar />)).not.toThrow();
  });

  it('プロジェクト配列が未初期化（undefined）の場合、「プロジェクトがありません」が表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: undefined,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    expect(screen.getByText('プロジェクトがありません')).toBeInTheDocument();
  });

  it('プロジェクト配列がnullの場合、「プロジェクトがありません」が表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: null,
      selectedProjectId: null,
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    expect(screen.getByText('プロジェクトがありません')).toBeInTheDocument();
  });

  it('プロジェクトボタンがクリック可能な状態である', () => {
    render(<Sidebar />);

    const buttons = screen.getAllByRole('button');
    const projectAButton = buttons.find(button => button.textContent?.includes('プロジェクトA'));

    expect(projectAButton).toBeDefined();
    expect(projectAButton).not.toBeDisabled();
    expect(projectAButton).toBeVisible();
  });

  it('プロジェクトボタンのz-indexが適切に設定されている', () => {
    const { container } = render(<Sidebar />);

    const sidebar = container.querySelector('aside');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('z-40');
  });

  it('複数のプロジェクトがある場合、すべてのボタンがクリック可能である', () => {
    render(<Sidebar />);

    const buttons = screen.getAllByRole('button');
    const projectButtons = buttons.filter(button =>
      button.textContent?.includes('プロジェクトA') || button.textContent?.includes('プロジェクトB')
    );

    expect(projectButtons).toHaveLength(2);
    projectButtons.forEach(button => {
      expect(button).not.toBeDisabled();
      expect(button).toBeVisible();
    });
  });

  it('プロジェクトボタンクリック時、正しいイベントハンドラーが実行される', () => {
    mockPush.mockClear();
    mockSetSelectedProjectId.mockClear();

    render(<Sidebar />);

    const buttons = screen.getAllByRole('button');
    const projectBButton = buttons.find(button => button.textContent?.includes('プロジェクトB'));

    expect(projectBButton).toBeDefined();
    fireEvent.click(projectBButton!);

    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('project-2');
    expect(mockSetSelectedProjectId).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/projects/project-2');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
