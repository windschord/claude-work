import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HomePage from '../page';
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
}));

describe('HomePage (Projects)', () => {
  const mockFetchProjects = vi.fn();
  const mockSetSelectedProjectId = vi.fn();
  const mockCheckAuth = vi.fn();

  const mockProjects = [
    {
      id: '1',
      name: 'Project 1',
      path: '/path/to/project1',
      default_model: 'claude-3-opus',
      run_scripts: [],
      session_count: 3,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Project 2',
      path: '/path/to/project2',
      default_model: 'claude-3-sonnet',
      run_scripts: [],
      session_count: 5,
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      projects: mockProjects,
      selectedProjectId: null,
      fetchProjects: mockFetchProjects,
      setSelectedProjectId: mockSetSelectedProjectId,
      checkAuth: mockCheckAuth,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('プロジェクト一覧が表示される', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });
  });

  it('プロジェクトのパスが表示される', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('/path/to/project1')).toBeInTheDocument();
      expect(screen.getByText('/path/to/project2')).toBeInTheDocument();
    });
  });

  it('プロジェクトのセッション数が表示される', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('「プロジェクト追加」ボタンが表示される', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: /プロジェクト追加|追加/ })).toBeInTheDocument();
  });

  it('「追加」ボタンクリックでモーダルが開く', async () => {
    render(<HomePage />);

    const addButton = screen.getByRole('button', { name: /プロジェクト追加|追加/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('プロジェクトを追加')).toBeInTheDocument();
    });
  });

  it('プロジェクト選択で選択状態が更新される', async () => {
    render(<HomePage />);

    await waitFor(() => {
      const openButton = screen.getAllByRole('button', { name: /開く/ })[0];
      fireEvent.click(openButton);

      expect(mockSetSelectedProjectId).toHaveBeenCalledWith('1');
    });
  });

  it('プロジェクトがない場合、空の状態メッセージが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      projects: [],
      selectedProjectId: null,
      fetchProjects: mockFetchProjects,
      setSelectedProjectId: mockSetSelectedProjectId,
      checkAuth: mockCheckAuth,
    });

    render(<HomePage />);

    expect(screen.getByText(/プロジェクトがありません/)).toBeInTheDocument();
  });
});
