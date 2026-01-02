import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
  const mockSetIsSidebarOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
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
      isSidebarOpen: true,
      setIsSidebarOpen: mockSetIsSidebarOpen,
    });

    render(<Header />);

    const hamburgerButtons = screen.getAllByLabelText('メニュー');
    fireEvent.click(hamburgerButtons[0]);

    expect(mockSetIsSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('ロゴをクリックするとダッシュボードに遷移する', () => {
    mockPush.mockClear();

    render(<Header />);

    const logos = screen.getAllByText('ClaudeWork');
    fireEvent.click(logos[0]);

    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
