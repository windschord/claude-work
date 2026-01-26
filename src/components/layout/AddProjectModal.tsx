'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export interface AddProjectModalProps {
  /** モーダルの開閉状態 */
  isOpen: boolean;
  /** モーダルを閉じるときのコールバック */
  onClose: () => void;
  /** プロジェクト追加成功時のコールバック */
  onSuccess: () => void;
}

/**
 * AddProjectModalコンポーネント
 *
 * リポジトリを追加するためのモーダルダイアログ。
 * パスと名前を入力し、POST /api/projects を呼び出します。
 *
 * @param props - コンポーネントのプロパティ
 * @returns リポジトリ追加モーダルのJSX要素
 */
export function AddProjectModal({
  isOpen,
  onClose,
  onSuccess,
}: AddProjectModalProps) {
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // モーダルが閉じられた時に状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setPath('');
      setName('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!path.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const body: { path: string; name?: string } = { path: path.trim() };
      if (name.trim()) {
        body.name = name.trim();
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'プロジェクトの追加に失敗しました');
      }

      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'プロジェクトの追加に失敗しました';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const isSubmitDisabled = !path.trim() || isSubmitting;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                  リポジトリを追加
                </Dialog.Title>

                <div className="space-y-4">
                  {/* パス入力 */}
                  <div>
                    <label
                      htmlFor="project-path"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      リポジトリパス
                    </label>
                    <input
                      id="project-path"
                      type="text"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="/path/to/repository"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* 名前入力 */}
                  <div>
                    <label
                      htmlFor="project-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      表示名（オプション）
                    </label>
                    <input
                      id="project-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="パスから自動推定されます"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitDisabled}
                  >
                    {isSubmitting ? '追加中...' : '追加'}
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
