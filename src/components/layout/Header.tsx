'use client';

import { useRouter } from 'next/navigation';
import { Menu, Settings } from 'lucide-react';
import { useAppStore } from '@/store';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { NotificationSettings } from '@/components/common/NotificationSettings';

/**
 * ヘッダーコンポーネント
 *
 * アプリケーションのトップバーを表示します。
 * - ロゴ（クリックでダッシュボードに遷移）
 * - ハンバーガーメニュー（モバイル時のサイドバートグル）
 * - テーマ切り替えボタン
 * - 通知設定
 * - 設定ページへのリンク
 */
export function Header() {
  const router = useRouter();
  const { isSidebarOpen, setIsSidebarOpen } = useAppStore();

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleNavigateToSettings = () => {
    router.push('/settings');
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

      {/* 右側: 設定 + 通知設定 + テーマ切り替え */}
      <div className="flex items-center gap-2">
        {/* 設定ページへのリンク */}
        <button
          onClick={handleNavigateToSettings}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="設定"
        >
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <NotificationSettings />
        <ThemeToggle />
      </div>
    </header>
  );
}
