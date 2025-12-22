'use client';

import { useEffect, useState, Fragment, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export interface CommitData {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  filesChanged: number;
}

export interface CommitHistoryProps {
  sessionId: string;
}

export function CommitHistory({ sessionId }: CommitHistoryProps) {
  const [commits, setCommits] = useState<CommitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resettingCommitHash, setResettingCommitHash] = useState<string | null>(null);

  const fetchCommits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/commits`);
      if (!response.ok) {
        throw new Error('コミット履歴の取得に失敗しました');
      }

      const data = await response.json();
      setCommits(data.commits || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コミット履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchCommits();
  }, [fetchCommits]);

  const handleResetClick = (commit: CommitData) => {
    setResettingCommitHash(commit.hash);
    setIsResetDialogOpen(true);
  };

  const handleResetConfirm = async () => {
    if (!resettingCommitHash) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: resettingCommitHash }),
      });

      if (!response.ok) {
        throw new Error('リセットに失敗しました');
      }

      // リセット成功後、コミット履歴を再取得
      await fetchCommits();
      setIsResetDialogOpen(false);
      setResettingCommitHash(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'リセットに失敗しました');
    }
  };

  const handleResetCancel = () => {
    setIsResetDialogOpen(false);
    setResettingCommitHash(null);
  };

  if (loading) {
    return <div className="p-4 text-gray-500">読み込み中...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (commits.length === 0) {
    return <div className="p-4 text-gray-500">コミット履歴がありません</div>;
  }

  return (
    <div className="overflow-x-auto">
      {!isResetDialogOpen && (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ハッシュ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                メッセージ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                作成者
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                日時
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                変更ファイル数
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {commits.map((commit) => (
              <tr
                key={commit.hash}
                className="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                  {commit.shortHash}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {commit.message}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {commit.author}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {commit.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {commit.filesChanged} ファイル
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetClick(commit);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    リセット
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* リセット確認ダイアログ */}
      <Transition appear show={isResetDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={handleResetCancel}>
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
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                  >
                    コミットにリセット
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      コミット <span className="font-mono">{commits.find(c => c.hash === resettingCommitHash)?.shortHash}</span> にリセットしますか？
                      それ以降の変更は失われます。
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2 justify-end">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={handleResetCancel}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={handleResetConfirm}
                    >
                      リセット
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
