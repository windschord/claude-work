'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAppStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      await checkAuth();
      setIsChecking(false);
    };

    checkAuthentication();
  }, [checkAuth]);

  useEffect(() => {
    // 認証チェック完了後、未認証の場合はリダイレクト
    if (!isChecking && !isAuthenticated) {
      router.push('/login');
    }
  }, [isChecking, isAuthenticated, router]);

  // 認証チェック中は何も表示しない（またはローディング表示）
  if (isChecking) {
    return null;
  }

  // 未認証の場合も何も表示しない（リダイレクト中）
  if (!isAuthenticated) {
    return null;
  }

  // 認証済みの場合は子コンポーネントを表示
  return <>{children}</>;
}

export default AuthGuard;
