'use client';

import { useEnvironments } from '@/hooks/useEnvironments';
import { EnvironmentList } from '@/components/environments/EnvironmentList';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
