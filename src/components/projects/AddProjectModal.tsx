'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, Tab, Listbox } from '@headlessui/react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { useAppStore } from '@/store';
import { useEnvironments } from '@/hooks/useEnvironments';
import { RemoteRepoForm } from './RemoteRepoForm';
import toast from 'react-hot-toast';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * プロジェクト追加モーダルコンポーネント
 *
 * ローカルGitリポジトリパスまたはリモートリポジトリURLを入力して
 * プロジェクトを追加するモーダルダイアログです。
 * タブUIでローカル/リモートを切り替えられます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @returns プロジェクト追加モーダルのJSX要素
 */
export function AddProjectModal({ isOpen, onClose }: AddProjectModalProps) {
  const { addProject, cloneProject, fetchProjects } = useAppStore();
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');

  const { environments, isLoading: isEnvironmentsLoading } = useEnvironments();
  const availableEnvironments = environments.filter((env) => !env.disabled);

  // 初期選択: is_default=true の環境
  useEffect(() => {
    if (!selectedEnvironmentId && availableEnvironments.length > 0) {
      const defaultEnv = availableEnvironments.find((env) => env.is_default);
      const initialId = defaultEnv?.id || availableEnvironments[0].id;
      setSelectedEnvironmentId(initialId);
    }
  }, [availableEnvironments, selectedEnvironmentId]);

  const selectedEnvironment = availableEnvironments.find((env) => env.id === selectedEnvironmentId);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!path.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      await addProject(path.trim(), selectedEnvironmentId);
      await fetchProjects();
      toast.success('プロジェクトを追加しました');
      setPath('');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'プロジェクトの追加に失敗しました';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoteSubmit = async (url: string, targetDir?: string, cloneLocation?: 'host' | 'docker', githubPatId?: string, environmentId: string) => {
    setError('');
    setIsLoading(true);

    try {
      await cloneProject(url, targetDir, cloneLocation, githubPatId, environmentId);
      await fetchProjects();
      toast.success('リポジトリをcloneしました');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'リポジトリのcloneに失敗しました';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPath('');
    setError('');
    setSelectedEnvironmentId('');
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  プロジェクトを追加
                </Dialog.Title>

                <Tab.Group defaultIndex={1}>
                  <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-4">
                    <Tab
                      className={({ selected }) =>
                        `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
                        ${
                          selected
                            ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-gray-200'
                        }`
                      }
                    >
                      ローカル
                    </Tab>
                    <Tab
                      className={({ selected }) =>
                        `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
                        ${
                          selected
                            ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-gray-200'
                        }`
                      }
                    >
                      リモート
                    </Tab>
                  </Tab.List>
                  <Tab.Panels>
                    {/* ローカルタブ */}
                    <Tab.Panel>
                      <form onSubmit={handleLocalSubmit}>
                        <div className="mb-4">
                          <label
                            htmlFor="project-path"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                          >
                            Gitリポジトリのパス
                          </label>
                          <input
                            id="project-path"
                            type="text"
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            placeholder="/path/to/git/repo"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                            disabled={isLoading}
                          />
                        </div>

                        {/* 実行環境選択 */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            実行環境
                          </label>
                          {isEnvironmentsLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">環境を読み込み中...</p>
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

                        {error && (
                          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                          </div>
                        )}

                        <div className="flex gap-3 justify-end">
                          <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            disabled={isLoading}
                          >
                            キャンセル
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!path.trim() || isLoading || availableEnvironments.length === 0 || !selectedEnvironmentId}
                          >
                            {isLoading ? '追加中...' : '追加'}
                          </button>
                        </div>
                      </form>
                    </Tab.Panel>

                    {/* リモートタブ */}
                    <Tab.Panel>
                      <RemoteRepoForm
                        onSubmit={handleRemoteSubmit}
                        onCancel={handleClose}
                        isLoading={isLoading}
                        error={error}
                      />
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
