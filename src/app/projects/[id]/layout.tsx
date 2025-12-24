'use client';

import { ReactNode } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';

interface LayoutProps {
  children: ReactNode;
}

/**
 * プロジェクトレイアウトコンポーネント
 *
 * プロジェクト配下のページ（セッション管理、設定など）で共通のレイアウトを提供します。
 * MainLayoutを使用することで、プロジェクト一覧の取得と表示を一元管理します。
 * - ヘッダー（ClaudeWorkロゴ、テーマ切り替え、ログアウト）
 * - サイドバー（プロジェクト一覧）
 * - メインコンテンツエリア
 *
 * @param children - レイアウト内に表示する子要素
 * @returns プロジェクトレイアウトのJSX要素
 */
export default function ProjectLayout({ children }: LayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}
