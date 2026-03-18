'use client';

import { use } from 'react';
import { RunScriptList } from '@/components/settings/RunScriptList';
import { ProjectEnvironmentSettings } from '@/components/settings/ProjectEnvironmentSettings';

/**
 * プロジェクト設定ページコンポーネント
 *
 * プロジェクトの設定を行うページです。
 * ランスクリプトの管理などを提供します。
 * レイアウト（ヘッダー、サイドバー）は親のlayout.tsxが提供します。
 *
 * @param params - ページパラメータ
 * @param params.id - プロジェクトID
 * @returns プロジェクト設定ページのJSX要素
 */
export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">プロジェクト設定</h1>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <ProjectEnvironmentSettings projectId={projectId} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <RunScriptList projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
