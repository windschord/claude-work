'use client';

import { useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { useAppStore } from '@/store';
import { ThemeToggle } from '@/components/common/ThemeToggle';

/**
 * ヘッダーコンポーネント
 *
 * アプリケーションのトップバーを表示します。
 * - ロゴ（クリックでダッシュボードに遷移）
 * - ハンバーガーメニュー（モバイル時のサイドバートグル）
 * - テーマ切り替えボタン
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
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6">
      {/* 左側: ハンバーガーメニュー + ロゴ */}
      <div className="flex items-center gap-4">
        {/* ハンバーガーメニュー（モバイル時のみ表示） */}
        <button
          onClick={handleToggleSidebar}
          className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="メニュー"
        >
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>

        {/* ロゴ */}
        <button
          onClick={handleLogoClick}
          className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          ClaudeWork
        </button>
      </div>

      {/* 右側: テーマ切り替え + ログアウトボタン */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">ログアウト</span>
        </button>
      </div>
    </header>
  );
}
