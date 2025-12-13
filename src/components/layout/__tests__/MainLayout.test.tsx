import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MainLayout } from '../MainLayout';
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

// ヘッダーとサイドバーをモック
vi.mock('../Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('../Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('MainLayout', () => {
  const mockFetchProjects = vi.fn();
  const mockSetIsMobile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      fetchProjects: mockFetchProjects,
      setIsMobile: mockSetIsMobile,
    });

    // window.matchMediaをモック
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('MainLayoutが正しくレンダリングされる', () => {
    render(
      <MainLayout>
        <div>テストコンテンツ</div>
      </MainLayout>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument();
  });

  it('マウント時にプロジェクト一覧を取得する', async () => {
    mockFetchProjects.mockResolvedValue(undefined);

    render(
      <MainLayout>
        <div>テストコンテンツ</div>
      </MainLayout>
    );

    await waitFor(() => {
      expect(mockFetchProjects).toHaveBeenCalled();
    });
  });

  it('プロジェクト取得失敗時もレンダリングは継続される', async () => {
    mockFetchProjects.mockRejectedValue(new Error('Network error'));

    render(
      <MainLayout>
        <div>テストコンテンツ</div>
      </MainLayout>
    );

    await waitFor(() => {
      expect(mockFetchProjects).toHaveBeenCalled();
    });

    // エラーが発生してもコンテンツは表示される
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument();
  });

  it('画面サイズに応じてisMobileが更新される', async () => {
    // モバイルサイズ（768px未満）
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: true, // マッチする = モバイル
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <MainLayout>
        <div>テストコンテンツ</div>
      </MainLayout>
    );

    await waitFor(() => {
      expect(mockSetIsMobile).toHaveBeenCalledWith(true);
    });
  });

  it('デスクトップサイズではisMobileがfalseになる', async () => {
    // デスクトップサイズ（768px以上）
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false, // マッチしない = デスクトップ
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <MainLayout>
        <div>テストコンテンツ</div>
      </MainLayout>
    );

    await waitFor(() => {
      expect(mockSetIsMobile).toHaveBeenCalledWith(false);
    });
  });

  it('子要素が正しくレンダリングされる', () => {
    render(
      <MainLayout>
        <div data-testid="child-1">子要素1</div>
        <div data-testid="child-2">子要素2</div>
      </MainLayout>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  it('メインコンテンツエリアが適切なクラスを持つ', () => {
    const { container } = render(
      <MainLayout>
        <div>テストコンテンツ</div>
      </MainLayout>
    );

    const mainContent = container.querySelector('main');
    expect(mainContent).toBeInTheDocument();
    expect(mainContent).toHaveClass('flex-1');
  });
});
