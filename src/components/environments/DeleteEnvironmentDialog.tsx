'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Environment } from '@/hooks/useEnvironments';

interface DeleteEnvironmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  environment: Environment | null;
  onConfirm: () => Promise<void>;
}

/**
 * 環境削除確認ダイアログコンポーネント
 *
 * 環境を削除する前に確認を求めるダイアログです。
 * デフォルト環境は削除できないことをユーザーに通知します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.onClose - ダイアログを閉じるときのコールバック関数
 * @param props.environment - 削除対象の環境情報
 * @param props.onConfirm - 削除確認時のコールバック関数
 * @returns 環境削除確認ダイアログのJSX要素
 */
export function DeleteEnvironmentDialog({
  isOpen,
  onClose,
  environment,
  onConfirm,
}: DeleteEnvironmentDialogProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!environment) {
    return null;
  }

  const handleDelete = async () => {
    setError('');
    setIsLoading(true);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('環境の削除に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  環境を削除
                </Dialog.Title>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    環境「{environment.name}」を削除しますか？
                  </p>
                  {environment.type === 'DOCKER' && environment.auth_dir_path && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      関連する認証ディレクトリも削除されます。
                    </p>
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
