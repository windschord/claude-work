'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

interface DeleteWorktreeDialogProps {
  isOpen: boolean;
  onDelete: () => void;
  onKeep: () => void;
}

/**
 * Worktree削除確認ダイアログコンポーネント
 *
 * マージ成功後にworktreeを削除するかどうかを確認するダイアログです。
 * ユーザーはworktreeを削除または保持を選択できます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.onDelete - worktreeを削除するときのコールバック関数
 * @param props.onKeep - worktreeを保持するときのコールバック関数
 * @returns Worktree削除確認ダイアログのJSX要素
 */
export function DeleteWorktreeDialog({ isOpen, onDelete, onKeep }: DeleteWorktreeDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onKeep} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-md w-full rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            worktreeを削除しますか?
          </DialogTitle>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            マージが成功しました。worktreeを削除しますか?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onKeep}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              保持
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              削除
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
