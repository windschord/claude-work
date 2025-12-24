'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { AuthGuard } from '@/components/AuthGuard';
import { ProjectList } from '@/components/projects/ProjectList';

/**
 * ホームページ
 *
 * アプリケーションのメインページで、プロジェクト一覧を表示します。
 * 認証ガードとメインレイアウトで保護されています。
 * プロジェクトの取得はMainLayoutで一元管理されます。
 *
 * @returns ホームページのJSX要素
 */
export default function Home() {
  return (
    <AuthGuard>
      <MainLayout>
        <ProjectList />
      </MainLayout>
    </AuthGuard>
  );
}
