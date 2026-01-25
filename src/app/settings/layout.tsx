'use client';

import { ReactNode } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';

interface LayoutProps {
  children: ReactNode;
}

/**
 * 設定ページレイアウトコンポーネント
 *
 * 設定配下のページ（環境管理など）で共通のレイアウトを提供します。
 * MainLayoutを使用することで、既存のプロジェクト関連ページと同じレイアウトを適用します。
 * - ヘッダー（ClaudeWorkロゴ、テーマ切り替え、設定メニュー）
 * - サイドバー（プロジェクト一覧）
 * - メインコンテンツエリア
 *
 * @param children - レイアウト内に表示する子要素
 * @returns 設定ページレイアウトのJSX要素
 */
export default function SettingsLayout({ children }: LayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}
