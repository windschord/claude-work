'use client';

import { useState, useEffect } from 'react';
import { EnvironmentBadge } from '@/components/common/EnvironmentBadge';
import { useProjectEnvironment } from '@/hooks/useProjectEnvironment';

interface ProjectEnvironmentSettingsProps {
  projectId: string;
}

/**
 * プロジェクト環境設定コンポーネント
 *
 * プロジェクトの実行環境を表示します。
 * 環境はプロジェクトに1対1で紐付いており、プロジェクト作成時に自動作成されます。
 * 詳細設定はプロジェクト設定ページの環境セクションで行います。
 */
export function ProjectEnvironmentSettings({ projectId }: ProjectEnvironmentSettingsProps) {
  const { environment, isLoading, error } = useProjectEnvironment(projectId);
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  // セッション数を取得
  useEffect(() => {
    const controller = new AbortController();
    setSessionCount(null);

    const fetchSessionCount = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/sessions`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!controller.signal.aborted) {
          setSessionCount(data.sessions?.filter((s: { status: string }) => s.status !== 'deleted').length ?? 0);
        }
      } catch {
        // セッション数取得失敗は無視（AbortErrorも含む）
      }
    };
    fetchSessionCount();
    return () => controller.abort();
  }, [projectId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          実行環境
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          このプロジェクトで新規セッションを作成する際に使用される実行環境です。
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">読み込み中...</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : environment ? (
        <div>
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
            <EnvironmentBadge type={environment.type} name={environment.name} />
          </div>
          {sessionCount !== null && sessionCount > 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              アクティブセッション: {sessionCount}件
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              環境の詳細設定はプロジェクト設定の環境セクションで変更できます。
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">環境情報がありません</p>
      )}
    </div>
  );
}
