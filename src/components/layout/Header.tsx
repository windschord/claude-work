'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Server } from 'lucide-react';
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
 * - 実行環境メニュー（実行環境設定へのリンク）
 */
export function Header() {
  const router = useRouter();
  const { isSidebarOpen, setIsSidebarOpen } = useAppStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleNavigateToEnvironments = () => {
    router.push('/settings/environments');
    setIsSettingsOpen(false);
  };

  // クリック外でメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

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

      {/* 右側: 実行環境メニュー + 通知設定 + テーマ切り替え */}
      <div className="flex items-center gap-2">
        {/* 実行環境メニュー */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={handleSettingsClick}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="実行環境"
            aria-expanded={isSettingsOpen}
            aria-haspopup="true"
          >
            <Server className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* ドロップダウンメニュー */}
          {isSettingsOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <button
                onClick={handleNavigateToEnvironments}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Server className="w-4 h-4" />
                <span>実行環境</span>
              </button>
            </div>
          )}
        </div>

        <NotificationSettings />
        <ThemeToggle />
      </div>
    </header>
  );
}
