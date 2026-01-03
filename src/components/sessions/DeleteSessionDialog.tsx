'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

interface DeleteSessionDialogProps {
  isOpen: boolean;
  sessionName: string;
  worktreePath?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  error?: string | null;
}

/**
 * セッション削除確認ダイアログコンポーネント
 *
 * セッションを削除する前に確認を求めるダイアログです。
 * 削除操作は取り消せないため、ユーザーに明確な確認を促します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.sessionName - 削除対象のセッション名
 * @param props.onConfirm - 削除を確定するときのコールバック関数
 * @param props.onCancel - キャンセルするときのコールバック関数
 * @param props.isDeleting - 削除処理中かどうか
 * @returns セッション削除確認ダイアログのJSX要素
 */
export function DeleteSessionDialog({
  isOpen,
  sessionName,
  worktreePath,
  onConfirm,
  onCancel,
  isDeleting,
  error,
}: DeleteSessionDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-md w-full rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            セッションを削除
          </DialogTitle>
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              以下のセッションを削除しますか？
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 space-y-1">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {sessionName}
              </p>
              {worktreePath && (
                <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                  {worktreePath}
                </p>
              )}
            </div>
            <p className="text-red-600 dark:text-red-400 text-sm mt-2">
              この操作は取り消せません。worktreeも削除されます。
            </p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
