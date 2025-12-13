import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '../Header';
import { useAppStore } from '@/store';

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

describe('Header', () => {
  const mockLogout = vi.fn();
  const mockSetIsSidebarOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      logout: mockLogout,
      isSidebarOpen: false,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });
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
    const hamburgerButton = screen.getByLabelText('メニュー');
    expect(hamburgerButton).toBeInTheDocument();
  });

  it('ハンバーガーメニューをクリックするとサイドバーがトグルされる', () => {
    render(<Header />);

    const hamburgerButton = screen.getByLabelText('メニュー');
    fireEvent.click(hamburgerButton);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('サイドバーが開いている時にハンバーガーメニューをクリックすると閉じる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      logout: mockLogout,
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Header />);

    const hamburgerButton = screen.getByLabelText('メニュー');
    fireEvent.click(hamburgerButton);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('ログアウトボタンをクリックするとログアウト処理が呼ばれる', async () => {
    mockLogout.mockResolvedValue(undefined);

    render(<Header />);

    const logoutButton = screen.getByRole('button', { name: /ログアウト/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('ログアウト成功後にログインページにリダイレクトされる', async () => {
    const mockPush = vi.fn();
    vi.mocked(require('next/navigation').useRouter).mockReturnValue({
      push: mockPush,
    });
    mockLogout.mockResolvedValue(undefined);

    render(<Header />);

    const logoutButton = screen.getByRole('button', { name: /ログアウト/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('ロゴをクリックするとダッシュボードに遷移する', () => {
    const mockPush = vi.fn();
    vi.mocked(require('next/navigation').useRouter).mockReturnValue({
      push: mockPush,
    });

    render(<Header />);

    const logo = screen.getByText('ClaudeWork');
    fireEvent.click(logo);

    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
