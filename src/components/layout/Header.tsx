'use client';

import { useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { useAppStore } from '@/store';

/**
 * ヘッダーコンポーネント
 *
 * アプリケーションのトップバーを表示します。
 * - ロゴ（クリックでダッシュボードに遷移）
 * - ハンバーガーメニュー（モバイル時のサイドバートグル）
 * - ログアウトボタン
 */
export function Header() {
  const router = useRouter();
  const { logout, isSidebarOpen, setIsSidebarOpen } = useAppStore();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      {/* 左側: ハンバーガーメニュー + ロゴ */}
      <div className="flex items-center gap-4">
        {/* ハンバーガーメニュー（モバイル時のみ表示） */}
        <button
          onClick={handleToggleSidebar}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="メニュー"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>

        {/* ロゴ */}
        <button
          onClick={handleLogoClick}
          className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          ClaudeWork
        </button>
      </div>

      {/* 右側: ログアウトボタン */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span className="hidden sm:inline">ログアウト</span>
      </button>
    </header>
  );
}
