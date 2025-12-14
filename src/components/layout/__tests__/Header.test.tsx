import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Header } from '../Header';
import { useAppStore } from '@/store';

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

describe('Header', () => {
  const mockLogout = vi.fn();
  const mockSetIsSidebarOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      logout: mockLogout,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('ヘッダーが正しくレンダリングされる', () => {
    render(<Header />);

    // ロゴが表示される
    expect(screen.getByText('ClaudeWork')).toBeInTheDocument();

    // ログアウトボタンが表示される
    expect(screen.getByRole('button', { name: /ログアウト/i })).toBeInTheDocument();
  });

  it('モバイルでハンバーガーメニューが表示される', () => {
    render(<Header />);

    // ハンバーガーメニューボタンが表示される（アイコン）
    const hamburgerButtons = screen.getAllByLabelText('メニュー');
    expect(hamburgerButtons.length).toBeGreaterThan(0);
    expect(hamburgerButtons[0]).toBeInTheDocument();
  });

  it('ハンバーガーメニューをクリックするとサイドバーがトグルされる', () => {
    render(<Header />);

    const hamburgerButtons = screen.getAllByLabelText('メニュー');
    fireEvent.click(hamburgerButtons[0]);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('サイドバーが開いている時にハンバーガーメニューをクリックすると閉じる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      logout: mockLogout,
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Header />);

    const hamburgerButtons = screen.getAllByLabelText('メニュー');
    fireEvent.click(hamburgerButtons[0]);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('ログアウトボタンをクリックするとログアウト処理が呼ばれる', async () => {
    mockLogout.mockResolvedValue(undefined);

    render(<Header />);

    const logoutButtons = screen.getAllByRole('button', { name: /ログアウト/i });
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('ログアウト成功後にログインページにリダイレクトされる', async () => {
    mockPush.mockClear();
    mockLogout.mockResolvedValue(undefined);

    render(<Header />);

    const logoutButtons = screen.getAllByRole('button', { name: /ログアウト/i });
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('ロゴをクリックするとダッシュボードに遷移する', () => {
    mockPush.mockClear();

    render(<Header />);

    const logos = screen.getAllByText('ClaudeWork');
    fireEvent.click(logos[0]);

    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
