'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { GitBranch, Loader2, X } from 'lucide-react';

interface CreatePRDialogProps {
  isOpen: boolean;
  sessionId: string;
  branchName: string;
  onClose: () => void;
  onSuccess: (pr: { url: string; number: number }) => void;
}

/**
 * PR作成ダイアログコンポーネント
 *
 * PRのタイトルと説明を入力し、gh CLIを通じてPRを作成します。
 */
export function CreatePRDialog({
  isOpen,
  sessionId,
  branchName,
  onClose,
  onSuccess,
}: CreatePRDialogProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('タイトルは必須です');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'PRの作成に失敗しました');
      }

      onSuccess({
        url: data.pr_url,
        number: data.pr_number,
      });

      // フォームをリセット
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PRの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
              Pull Request を作成
            </Dialog.Title>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">
              <GitBranch className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {branchName}
              </span>
              <span className="text-gray-500 dark:text-gray-400">→</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">
                main
              </span>
            </div>

            <div>
              <label
                htmlFor="pr-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                タイトル
              </label>
              <input
                id="pr-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="PRのタイトルを入力"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border rounded-md
                  dark:bg-gray-700 dark:border-gray-600 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="pr-body"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                説明
              </label>
              <textarea
                id="pr-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="PRの説明を入力（任意）"
                rows={4}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border rounded-md resize-none
                  dark:bg-gray-700 dark:border-gray-600 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  rounded-md transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                  text-white bg-green-600 hover:bg-green-700
                  dark:bg-green-700 dark:hover:bg-green-600
                  rounded-md transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? '作成中...' : '作成'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
