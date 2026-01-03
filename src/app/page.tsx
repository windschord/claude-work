'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { ProjectList } from '@/components/projects/ProjectList';

/**
 * ホームページ
 *
 * アプリケーションのメインページで、プロジェクト一覧を表示します。
 * メインレイアウトでラップされています。
 * プロジェクトの取得はMainLayoutで一元管理されます。
 *
 * @returns ホームページのJSX要素
 */
export default function Home() {
  return (
    <MainLayout>
      <ProjectList />
    </MainLayout>
  );
}
