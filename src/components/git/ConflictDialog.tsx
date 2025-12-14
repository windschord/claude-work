'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

interface ConflictDialogProps {
  isOpen: boolean;
  conflictFiles: string[];
  onClose: () => void;
}

export function ConflictDialog({ isOpen, conflictFiles, onClose }: ConflictDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-lg w-full rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            コンフリクトが発生しました
          </DialogTitle>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            以下のファイルでコンフリクトが発生しました。手動で解決してください。
          </p>
          <ul className="mb-6 max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded p-4 space-y-2" role="list">
            {conflictFiles.map((file, index) => (
              <li
                key={index}
                className="text-sm font-mono text-red-600 dark:text-red-400"
              >
                {file}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              閉じる
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
