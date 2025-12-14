'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';

interface MergeModalProps {
  isOpen: boolean;
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * マージモーダルコンポーネント
 *
 * セッションのブランチをmainブランチにスカッシュしてマージするためのモーダルです。
 * コミットメッセージを入力してマージを実行します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.sessionId - 対象のセッションID
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @param props.onSuccess - マージ成功時のコールバック関数
 * @returns マージモーダルのJSX要素
 */
export function MergeModal({ isOpen, sessionId, onClose, onSuccess }: MergeModalProps) {
  const { isGitOperationLoading, merge } = useAppStore();
  const [commitMessage, setCommitMessage] = useState('');

  const handleMerge = async () => {
    try {
      await merge(sessionId, commitMessage);
      setCommitMessage('');
      onSuccess();
    } catch (error) {
      console.error('Merge failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'マージに失敗しました'
      );
    }
  };

  const handleClose = () => {
    setCommitMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-lg w-full rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            mainブランチにマージ
          </DialogTitle>
          <div className="mb-6">
            <textarea
              rows={5}
              placeholder="コミットメッセージを入力"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isGitOperationLoading}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isGitOperationLoading}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleMerge}
              disabled={isGitOperationLoading || !commitMessage.trim()}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              マージ
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
