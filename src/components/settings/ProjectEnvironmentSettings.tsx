'use client';

import { useState, useEffect } from 'react'
;
import { useEnvironments } from '@/hooks/useEnvironments';

interface ProjectEnvironmentSettingsProps {
  projectId: string;
}

/**
 * プロジェクト環境設定コンポーネント
 *
 * プロジェクト単位の実行環境を設定します。
 * セッション作成時はここで設定した環境が自動的に使用されます。
 */
export function ProjectEnvironmentSettings({ projectId }: ProjectEnvironmentSettingsProps) {
  const [environmentId, setEnvironmentId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { environments, isLoading: isEnvironmentsLoading } = useEnvironments();

  // プロジェクト情報を取得して現在の環境IDを設定
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setEnvironmentId(data.environment_id || '');
        }
      } catch (error) {
        console.error('Failed to fetch project', error);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environment_id: environmentId || null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update project environment');
      }

      setSaveMessage({ type: 'success', text: '実行環境を更新しました' });
    } catch (error) {
      console.error('Failed to update project environment', error);
      setSaveMessage({ type: 'error', text: '実行環境の更新に失敗しました' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          デフォルト実行環境
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          このプロジェクトで新規セッションを作成する際に使用される実行環境を設定します。
        </p>
      </div>

      <div>
        <label htmlFor="environment-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          実行環境
        </label>
        <select
          id="environment-select"
          value={environmentId}
          onChange={(e) => setEnvironmentId(e.target.value)}
          disabled={isSaving || isEnvironmentsLoading}
          className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <option value="">環境を設定しない（自動選択）</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name} ({env.type})
              {env.is_default ? ' [デフォルト]' : ''}
            </option>
          ))}
        </select>
        {isEnvironmentsLoading && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            環境一覧を読み込み中...
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        {saveMessage && (
          <p
            className={`text-sm ${
              saveMessage.type === 'success'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {saveMessage.text}
          </p>
        )}
      </div>
    </div>
  );
}
