'use client';

import { useState, useEffect, Fragment } from 'react';
import { ChevronDown, ChevronUp, Loader2, HelpCircle, ExternalLink, ChevronsUpDown, Check } from 'lucide-react';
import { Listbox, Transition } from '@headlessui/react';
import { useGitHubPATs } from '@/hooks/useGitHubPATs';
import { useEnvironments } from '@/hooks/useEnvironments';

interface RemoteRepoFormProps {
  onSubmit: (url: string, environmentId: string, targetDir?: string, cloneLocation?: 'host' | 'docker', githubPatId?: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}

/**
 * リモートリポジトリURL入力フォームコンポーネント
 *
 * リモートGitリポジトリのURLを入力してcloneするためのフォームです。
 * オプションでclone先ディレクトリを指定できます。
 */
export function RemoteRepoForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: RemoteRepoFormProps) {
  const [url, setUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [cloneLocation, setCloneLocation] = useState<'host' | 'docker'>('docker');
  const [githubPatId, setGithubPatId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');

  const { pats, isLoading: isPATsLoading } = useGitHubPATs();
  const activePATs = pats.filter((pat) => pat.isActive);

  const { environments, isLoading: isEnvironmentsLoading, hostEnvironmentDisabled } = useEnvironments();
  const availableEnvironments = environments.filter((env) => !env.disabled);

  const availableEnvironmentIds = availableEnvironments.map((e) => e.id).join(',');
  const defaultEnvironmentId = availableEnvironments.find((e) => e.is_default)?.id ?? availableEnvironments[0]?.id ?? '';

  // 初期選択: is_default=true の環境、または選択中の環境がリストから削除された場合にリセット
  useEffect(() => {
    if (!selectedEnvironmentId && defaultEnvironmentId) {
      setSelectedEnvironmentId(defaultEnvironmentId);
    } else if (selectedEnvironmentId && availableEnvironmentIds && !availableEnvironmentIds.split(',').includes(selectedEnvironmentId)) {
      setSelectedEnvironmentId(defaultEnvironmentId);
    }
  }, [selectedEnvironmentId, defaultEnvironmentId, availableEnvironmentIds]);

  // HOST環境が無効化された場合、cloneLocationをdockerに強制リセット
  useEffect(() => {
    if (hostEnvironmentDisabled && cloneLocation !== 'docker') {
      setCloneLocation('docker');
    }
  }, [hostEnvironmentDisabled, cloneLocation]);

  const selectedEnvironment = availableEnvironments.find((env) => env.id === selectedEnvironmentId);

  const isHttpsUrl = url.trim().startsWith('https://');
  const isDocker = cloneLocation === 'docker';
  const showPATSelector = isDocker && isHttpsUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      return;
    }

    if (!selectedEnvironmentId || !selectedEnvironment) {
      return;
    }

    const patId = showPATSelector && githubPatId ? githubPatId : undefined;
    await onSubmit(url.trim(), selectedEnvironmentId, targetDir.trim() || undefined, cloneLocation, patId);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label
          htmlFor="repo-url"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          リポジトリURL
        </label>
        <input
          id="repo-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          disabled={isLoading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          SSH (git@...) または HTTPS (https://...) URLを入力
        </p>
      </div>

      {/* 保存場所選択: HOST環境が有効な場合のみ表示 */}
      {!hostEnvironmentDisabled && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              保存場所
            </label>
            <div className="relative">
              <HelpCircle
                className="w-4 h-4 text-gray-400 cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              />
              {showTooltip && (
                <div className="absolute left-0 top-6 z-10 w-64 p-2 text-xs bg-gray-800 text-white rounded shadow-lg">
                  <p className="mb-1"><strong>Docker環境（推奨）:</strong></p>
                  <p className="mb-2">SSH Agent認証が自動で利用可能です。</p>
                  <p className="mb-1"><strong>ホスト環境:</strong></p>
                  <p>ローカルのGit設定を使用します。</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="cloneLocation"
                value="docker"
                checked={cloneLocation === 'docker'}
                onChange={(e) => setCloneLocation(e.target.value as 'docker')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                disabled={isLoading}
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Docker環境
                <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(推奨)</span>
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="cloneLocation"
                value="host"
                checked={cloneLocation === 'host'}
                onChange={(e) => setCloneLocation(e.target.value as 'host')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                disabled={isLoading}
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                ホスト環境
              </span>
            </label>
          </div>
        </div>
      )}

      {/* PAT選択（Docker + HTTPS時のみ表示） */}
      {showPATSelector && (
        <div className="mb-4">
          <label
            htmlFor="github-pat"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            GitHub Personal Access Token
          </label>
          {isPATsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              PAT一覧を読み込み中...
            </div>
          ) : (
            <>
              <select
                id="github-pat"
                value={githubPatId}
                onChange={(e) => setGithubPatId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isLoading}
              >
                <option value="">PATを使用しない（SSH Agent認証を使用）</option>
                {activePATs.map((pat) => (
                  <option key={pat.id} value={pat.id}>
                    {pat.name}{pat.description ? ` - ${pat.description}` : ''}
                  </option>
                ))}
              </select>
              <div className="mt-1 flex items-center gap-1">
                <a
                  href="/settings/github-pat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  新しいPATを追加
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            HTTPSでprivateリポジトリをcloneする場合にPATが必要です
          </p>
        </div>
      )}

      {/* 実行環境選択 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          実行環境
        </label>
        {isEnvironmentsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            環境を読み込み中...
          </div>
        ) : availableEnvironments.length === 0 ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            利用可能な環境がありません。先に環境を登録してください。
          </p>
        ) : (
          <Listbox value={selectedEnvironmentId} onChange={setSelectedEnvironmentId} disabled={isLoading}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="block truncate text-gray-900 dark:text-gray-100">
                    {selectedEnvironment?.name || '環境を選択'}
                  </span>
                  {selectedEnvironment && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${
                      selectedEnvironment.type === 'DOCKER'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : selectedEnvironment.type === 'HOST'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {selectedEnvironment.type}
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
                            <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${
                              env.type === 'DOCKER'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : env.type === 'HOST'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            }`}>
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
        )}
      </div>

      {/* 詳細設定の折りたたみ */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDown className="w-4 h-4 mr-1" />
          )}
          詳細設定
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <label
              htmlFor="target-dir"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Clone先ディレクトリ（任意）
            </label>
            <input
              id="target-dir"
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="空の場合は data/repos/ 配下にclone"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          disabled={isLoading}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          disabled={!url.trim() || isLoading || availableEnvironments.length === 0 || !selectedEnvironmentId}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? 'Clone中...' : 'Clone'}
        </button>
      </div>
    </form>
  );
}
