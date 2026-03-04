'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useAppStore, Project } from '@/store';

interface DeleteProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

/**
 * プロジェクト削除確認ダイアログコンポーネント
 *
 * プロジェクトを削除する前に確認を求めるダイアログです。
 * Docker cloneかつGit checkout Volumeが存在する場合、Volumeの保持/削除を選択できます。
 * worktreeは削除されないことをユーザーに通知します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.onClose - ダイアログを閉じるときのコールバック関数
 * @param props.project - 削除対象のプロジェクト情報
 * @returns プロジェクト削除確認ダイアログのJSX要素
 */
export function DeleteProjectDialog({
  isOpen,
  onClose,
  project,
}: DeleteProjectDialogProps) {
  const { deleteProject, fetchProjects } = useAppStore();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keepGitVolume, setKeepGitVolume] = useState(false);

  if (!project) {
    return null;
  }

  const hasDockerVolume = project.clone_location === 'docker' && !!project.docker_volume_id;

  const handleDelete = async () => {
    setError('');
    setIsLoading(true);

    try {
      await deleteProject(
        project.id,
        hasDockerVolume ? { keepGitVolume } : undefined
      );
      setKeepGitVolume(false);
      onClose();
      // 一覧更新失敗は削除失敗として扱わない
      try {
        await fetchProjects();
      } catch {
        // 一覧更新エラーは無視（削除自体は成功している）
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('プロジェクトの削除に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setKeepGitVolume(false);
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  プロジェクトを削除
                </Dialog.Title>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    プロジェクト「{project.name}」を削除しますか？
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    worktreeは削除されません。
                  </p>
                </div>

                {hasDockerVolume && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Docker Volume
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      チェックを入れたVolumeは削除せずに保持します。
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keepGitVolume}
                          onChange={(e) => setKeepGitVolume(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Gitリポジトリを保持 <span className="text-xs text-gray-400">({project.docker_volume_id})</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

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
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? '削除中...' : '削除'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
