'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { useAppStore } from '@/store';
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

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!path.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      await addProject(path.trim());
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

  const handleRemoteSubmit = async (url: string, targetDir?: string) => {
    setError('');
    setIsLoading(true);

    try {
      await cloneProject(url, targetDir);
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

                <Tab.Group>
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
                            disabled={!path.trim() || isLoading}
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
