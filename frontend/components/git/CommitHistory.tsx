'use client';

import { useEffect, useState } from 'react';
import { useGitOpsStore } from '@/store/gitOps';
import { Commit } from '@/lib/api';

interface CommitHistoryProps {
  sessionId: string;
}

export function CommitHistory({ sessionId }: CommitHistoryProps) {
  const {
    commits,
    selectedCommit,
    commitDiff,
    isLoading,
    error,
    fetchCommits,
    fetchCommitDiff,
    selectCommit,
  } = useGitOpsStore();

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [commitToReset, setCommitToReset] = useState<string | null>(null);

  useEffect(() => {
    fetchCommits(sessionId);
  }, [sessionId, fetchCommits]);

  const handleCommitClick = async (commit: Commit) => {
    if (selectedCommit === commit.hash) {
      selectCommit(null);
    } else {
      await fetchCommitDiff(sessionId, commit.hash);
    }
  };

  const handleResetClick = (commitHash: string) => {
    setCommitToReset(commitHash);
    setShowResetDialog(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortHash = (hash: string) => hash.substring(0, 7);

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">コミット履歴</h3>
        {isLoading && (
          <div className="text-sm text-gray-500">読み込み中...</div>
        )}
      </div>

      {commits.length === 0 && !isLoading ? (
        <p className="text-sm text-gray-500">コミット履歴がありません</p>
      ) : (
        <div className="space-y-2">
          {commits.map((commit) => (
            <div
              key={commit.hash}
              className={`rounded-lg border p-4 transition-colors ${
                selectedCommit === commit.hash
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className="cursor-pointer"
                onClick={() => handleCommitClick(commit)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-gray-100 px-2 py-1 text-sm font-mono">
                        {shortHash(commit.hash)}
                      </code>
                      <p className="text-sm font-medium">{commit.message}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        {commit.author_name} &lt;{commit.author_email}&gt;
                      </span>
                      <span>{formatDate(commit.date)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetClick(commit.hash);
                    }}
                    className="ml-4 rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    リセット
                  </button>
                </div>
              </div>

              {selectedCommit === commit.hash && commitDiff && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="mb-2 text-sm font-semibold">変更内容</h4>
                  <pre className="overflow-x-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">
                    {commitDiff}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showResetDialog && commitToReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowResetDialog(false)}
        >
          <div
            className="rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              コミットへのリセット
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              このコミット({shortHash(commitToReset)})にリセットします。
            </p>
            <p className="mt-2 text-sm font-semibold text-red-600">
              この操作は取り消せません。よろしいですか？
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowResetDialog(false)}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  const { resetToCommit } = useGitOpsStore.getState();
                  const success = await resetToCommit(sessionId, commitToReset);
                  if (success) {
                    await fetchCommits(sessionId);
                  }
                  setShowResetDialog(false);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
