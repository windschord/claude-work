'use client';

import { use } from 'react';
import { RunScriptList } from '@/components/settings/RunScriptList';

/**
 * プロジェクト設定ページコンポーネント
 *
 * プロジェクトの設定を行うページです。
 * ランスクリプトの管理などを提供します。
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">プロジェクト設定</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <RunScriptList projectId={projectId} />
      </div>
    </div>
  );
}
