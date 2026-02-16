'use client';

import { useEffect } from 'react';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ isOpen, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onDiscard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDiscard, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        {/* タイトル */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          未保存の変更があります
        </h2>

        {/* メッセージ */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          変更が保存されていません。破棄しますか？
        </p>

        {/* アクションボタン */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            破棄して戻る
          </button>
        </div>
      </div>
    </div>
  );
}
