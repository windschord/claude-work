import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthGuard from '../AuthGuard';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// Next.jsのナビゲーションモック
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    throw new Error(`NEXT_REDIRECT: ${path}`); // Next.jsのredirectは例外をスローする
  },
  usePathname: () => '/test',
}));

describe('AuthGuard', () => {
  const mockCheckAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
  });

  it('認証済みの場合は子コンポーネントを表示する', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      checkAuth: mockCheckAuth,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('未認証の場合は/loginにリダイレクトする', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      checkAuth: mockCheckAuth,
    });

    // redirectは例外をスローするので、エラーをキャッチする
    expect(() => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );
    }).toThrow('NEXT_REDIRECT: /login');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('マウント時にcheckAuth()が呼ばれる', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      checkAuth: mockCheckAuth,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalledTimes(1);
    });
  });

  it('認証状態が変化した場合に適切に処理される', async () => {
    let isAuthenticated = false;
    const mockCheckAuthWithStateChange = vi.fn().mockImplementation(() => {
      isAuthenticated = true;
    });

    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAuthenticated,
      checkAuth: mockCheckAuthWithStateChange,
    }));

    const { rerender } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // 認証状態が変化した後にリレンダリング
    isAuthenticated = true;
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      checkAuth: mockCheckAuthWithStateChange,
    });

    rerender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('checkAuthがエラーになっても適切に処理される', async () => {
    const mockCheckAuthWithError = vi.fn().mockRejectedValue(new Error('Auth check failed'));

    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      checkAuth: mockCheckAuthWithError,
    });

    expect(() => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );
    }).toThrow('NEXT_REDIRECT: /login');
  });
});
