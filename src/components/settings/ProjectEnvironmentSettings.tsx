'use client';

import { useState, useEffect, Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { EnvironmentBadge } from '@/components/common/EnvironmentBadge';
import { useEnvironments } from '@/hooks/useEnvironments';

interface ProjectEnvironmentSettingsProps {
  projectId: string;
  hostEnvironmentDisabled?: boolean;
}

function getBadgeColorClass(type: string): string {
  if (type === 'DOCKER') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (type === 'HOST') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
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
 * プロジェクトの実行環境を表示し、セッションが0件の場合は変更も可能です。
 * セッションが存在する場合は変更できません。
 */
export function ProjectEnvironmentSettings({ projectId, hostEnvironmentDisabled = false }: ProjectEnvironmentSettingsProps) {
  const [projectEnv, setProjectEnv] = useState<ProjectEnvironmentInfo | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newEnvironmentId, setNewEnvironmentId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { environments, isLoading: isEnvListLoading } = useEnvironments();
  const availableEnvironments = environments.filter((env) => !env.disabled);

  // プロジェクトAPI・環境APIの両方が取得完了するまでローディング表示
  const isLoading = isProjectLoading || isEnvListLoading;

  useEffect(() => {
    const controller = new AbortController();
    setIsProjectLoading(true);
    setError(null);
    setProjectEnv(null);

    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { signal: controller.signal });
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
        setNewEnvironmentId(data.project.environment_id || '');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('Failed to fetch project', err);
        setError('Failed to fetch project');
      } finally {
        if (!controller.signal.aborted) {
          setIsProjectLoading(false);
        }
      }
    };
    fetchProject();
    return () => controller.abort();
  }, [projectId]);

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

  const getEnvironmentDisplay = () => {
    if (!projectEnv) return { label: '-', type: '-' };

    if (projectEnv.environment_id && !projectEnv.environment) {
      return { label: '環境情報を取得できません', type: 'UNKNOWN' };
    }

    if (projectEnv.environment_id && projectEnv.environment) {
      return {
        label: projectEnv.environment.name,
        type: projectEnv.environment.type,
      };
    }

    const cloneLocation = projectEnv.clone_location || 'host';
    if (cloneLocation === 'docker' || hostEnvironmentDisabled) {
      return { label: 'Docker (自動選択)', type: 'DOCKER' };
    }
    return { label: 'Host (自動選択)', type: 'HOST' };
  };

  const handleSave = async () => {
    if (!newEnvironmentId) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment_id: newEnvironmentId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '環境の変更に失敗しました');
      }

      const data = await res.json();
      setProjectEnv({
        clone_location: data.project.clone_location || null,
        environment_id: data.project.environment_id || null,
        environment: data.project.environment || null,
      });
      setNewEnvironmentId(data.project.environment_id || '');
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '環境の変更に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewEnvironmentId(projectEnv?.environment_id || '');
    setSaveError(null);
  };

  const envDisplay = getEnvironmentDisplay();
  const selectedNewEnv = availableEnvironments.find((env) => env.id === newEnvironmentId);

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
      ) : isEditing ? (
        <div className="space-y-3">
          <Listbox value={newEnvironmentId} onChange={setNewEnvironmentId} disabled={isSaving}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="block truncate text-gray-900 dark:text-gray-100">
                    {selectedNewEnv?.name || '環境を選択'}
                  </span>
                  {selectedNewEnv && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${getBadgeColorClass(selectedNewEnv.type)}`}>
                      {selectedNewEnv.type}
                    </span>
                  )}
                </div>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {availableEnvironments.map((env) => (
                    <Listbox.Option
                      key={env.id}
                      value={env.id}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-gray-100'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {env.name}
                            </span>
                            <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${getBadgeColorClass(env.type)}`}>
                              {env.type}
                            </span>
                          </div>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>

          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !newEnvironmentId}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
            <EnvironmentBadge type={envDisplay.type} name={envDisplay.label} />
            {sessionCount === 0 ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                変更
              </button>
            ) : null}
          </div>
          {sessionCount !== null && sessionCount > 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              セッションが存在するため変更できません（{sessionCount}件）
            </p>
          ) : sessionCount === 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              セッションが存在しない場合は環境を変更できます。
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              セッション数を確認中...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
