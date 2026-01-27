'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface RemoteRepoFormProps {
  onSubmit: (url: string, targetDir?: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}

/**
 * リモートリポジトリURL入力フォームコンポーネント
 *
 * リモートGitリポジトリのURLを入力してcloneするためのフォームです。
 * オプションでclone先ディレクトリを指定できます。
 */
export function RemoteRepoForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: RemoteRepoFormProps) {
  const [url, setUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      return;
    }

    await onSubmit(url.trim(), targetDir.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label
          htmlFor="repo-url"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          リポジトリURL
        </label>
        <input
          id="repo-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="git@github.com:user/repo.git"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          disabled={isLoading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          SSH (git@...) または HTTPS (https://...) URLを入力
        </p>
      </div>

      {/* 詳細設定の折りたたみ */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDown className="w-4 h-4 mr-1" />
          )}
          詳細設定
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <label
              htmlFor="target-dir"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Clone先ディレクトリ（任意）
            </label>
            <input
              id="target-dir"
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="空の場合は data/repos/ 配下にclone"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              disabled={isLoading}
            />
          </div>
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
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          disabled={isLoading}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          disabled={!url.trim() || isLoading}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? 'Clone中...' : 'Clone'}
        </button>
      </div>
    </form>
  );
}
