'use client';

import { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store';

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * メインレイアウトコンポーネント
 *
 * アプリケーションの基本レイアウトを提供します。
 * - ヘッダー
 * - サイドバー（プロジェクト一覧）
 * - メインコンテンツエリア
 * - レスポンシブ対応
 */
export function MainLayout({ children }: MainLayoutProps) {
  const { fetchProjects, setIsMobile } = useAppStore();

  useEffect(() => {
    // プロジェクト一覧を取得
    const loadProjects = async () => {
      try {
        await fetchProjects();
      } catch (error) {
        console.error('プロジェクト一覧の取得エラー:', error);
      }
    };

    loadProjects();
  }, [fetchProjects]);

  useEffect(() => {
    // 画面サイズの検出
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // 初期値を設定
    handleMediaChange(mediaQuery);

    // リスナーを追加
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [setIsMobile]);

  return (
    <div className="h-screen flex flex-col">
      {/* ヘッダー */}
      <Header />

      {/* コンテンツエリア */}
      <div className="flex-1 flex overflow-hidden">
        {/* サイドバー */}
        <Sidebar />

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
