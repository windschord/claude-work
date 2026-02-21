'use client';

import { useState, useEffect } from 'react';
import { EnvironmentBadge } from '@/components/common/EnvironmentBadge';

interface ProjectEnvironmentSettingsProps {
  projectId: string;
}

interface ProjectEnvironmentInfo {
  clone_location: string | null;
  environment_id: string | null;
  environment: {
    id: string;
    name: string;
    type: string;
  } | null;
}

/**
 * プロジェクト環境設定コンポーネント
 *
 * プロジェクトの実行環境を読み取り専用で表示します。
 * 実行環境はプロジェクト作成時に決定され、変更できません。
 */
export function ProjectEnvironmentSettings({ projectId }: ProjectEnvironmentSettingsProps) {
  const [projectEnv, setProjectEnv] = useState<ProjectEnvironmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          setError(`Failed to fetch project (status: ${res.status})`);
          return;
        }
        const data = await res.json();
        setProjectEnv({
          clone_location: data.project.clone_location || null,
          environment_id: data.project.environment_id || null,
          environment: data.project.environment || null,
        });
      } catch (err) {
        console.error('Failed to fetch project', err);
        setError('Failed to fetch project');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const getEnvironmentDisplay = () => {
    if (!projectEnv) return { label: '-', type: '-' };

    if (projectEnv.environment_id && projectEnv.environment) {
      return {
        label: projectEnv.environment.name,
        type: projectEnv.environment.type,
      };
    }

    const cloneLocation = projectEnv.clone_location || 'host';
    if (cloneLocation === 'docker') {
      return { label: 'Docker (自動選択)', type: 'DOCKER' };
    }
    return { label: 'Host (自動選択)', type: 'HOST' };
  };

  const envDisplay = getEnvironmentDisplay();

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
      ) : (
        <div>
          <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
            <EnvironmentBadge type={envDisplay.type} name={envDisplay.label} />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            クローン場所（{projectEnv?.clone_location || 'host'}）の設定に基づいて自動的に決定されます。プロジェクト作成後に変更することはできません。
          </p>
        </div>
      )}
    </div>
  );
}
