'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { useAppStore } from '@/store';

/**
 * 認証ガードコンポーネント
 *
 * 子コンポーネントを認証で保護します。
 * 未認証の場合は `/login` にリダイレクトします。
 * マウント時にセッション状態を確認します。
 *
 * @param props.children - 保護する子コンポーネント
 *
 * @example
 * ```tsx
 * <AuthGuard>
 *   <ProtectedPage />
 * </AuthGuard>
 * ```
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth } = useAppStore();

  useEffect(() => {
    // マウント時にセッション確認
    checkAuth();
  }, [checkAuth]);

  // 未認証の場合はリダイレクト
  if (!isAuthenticated) {
    redirect('/login');
  }

  // 認証済みの場合は子コンポーネントを表示
  return <>{children}</>;
}
