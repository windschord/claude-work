'use client';

import { useEnvironments } from '@/hooks/useEnvironments';
import { EnvironmentList } from '@/components/environments/EnvironmentList';
import { BackButton } from '@/components/settings/BackButton';

/**
 * 実行環境設定ページ
 *
 * 実行環境の一覧表示、追加、編集、削除の機能を提供するページです。
 * useEnvironmentsフックで環境データを管理し、EnvironmentListコンポーネントで表示します。
 *
 * @returns 実行環境設定ページのJSX要素
 */
export default function EnvironmentsSettingsPage() {
  const {
    environments,
    isLoading,
    error,
    fetchEnvironments,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
  } = useEnvironments();

  return (
    <div>
      {/* 戻るボタン */}
      <div className="p-6 pb-0">
        <BackButton />
      </div>

      <EnvironmentList
        environments={environments}
        isLoading={isLoading}
        error={error}
        onCreateEnvironment={createEnvironment}
        onUpdateEnvironment={updateEnvironment}
        onDeleteEnvironment={deleteEnvironment}
        onRefresh={fetchEnvironments}
      />
    </div>
  );
}
