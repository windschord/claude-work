import { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * プロジェクトレイアウトコンポーネント
 *
 * プロジェクト配下のページ（セッション管理、設定など）で共通のレイアウトを提供します。
 * - ヘッダー（ClaudeWorkロゴ、テーマ切り替え、ログアウト）
 * - サイドバー（プロジェクト一覧）
 * - メインコンテンツエリア
 *
 * @param children - レイアウト内に表示する子要素
 * @param params - 動的ルートパラメータ（プロジェクトID）
 * @returns プロジェクトレイアウトのJSX要素
 */
export default async function ProjectLayout({ children, params }: LayoutProps) {
  // Next.js 15では、paramsは非同期（Promise）として扱う
  const { id: _id } = await params;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
