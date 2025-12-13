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
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
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

    expect(screen.getByText('プロジェクトA')).toBeInTheDocument();
    expect(screen.getByText('プロジェクトB')).toBeInTheDocument();
  });

  it('セッション数が表示される', () => {
    render(<Sidebar />);

    expect(screen.getByText('3セッション')).toBeInTheDocument();
    expect(screen.getByText('1セッション')).toBeInTheDocument();
  });

  it('プロジェクトをクリックすると選択状態が変わる', () => {
    render(<Sidebar />);

    const projectA = screen.getByText('プロジェクトA');
    fireEvent.click(projectA);

    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('project-1');
  });

  it('プロジェクトをクリックすると詳細ページに遷移する', () => {
    const mockPush = vi.fn();
    vi.mocked(require('next/navigation').useRouter).mockReturnValue({
      push: mockPush,
    });

    render(<Sidebar />);

    const projectA = screen.getByText('プロジェクトA');
    fireEvent.click(projectA);

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1');
  });

  it('選択中のプロジェクトがハイライトされる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      projects: mockProjects,
      selectedProjectId: 'project-1',
      setSelectedProjectId: mockSetSelectedProjectId,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Sidebar />);

    const projectA = screen.getByText('プロジェクトA').closest('button');
    expect(projectA).toHaveClass('bg-blue-100');
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

    const projectA = screen.getByText('プロジェクトA');
    fireEvent.click(projectA);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(false);
  });
});
