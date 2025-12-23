'use client';

import { PlayCircle, StopCircle, Loader2, RotateCw } from 'lucide-react';

interface ProcessStatusProps {
  running: boolean;
  loading: boolean;
  onRestart: () => void;
}

/**
 * プロセス状態表示コンポーネント
 *
 * Claude Codeプロセスの実行状態を視覚的に表示するコンポーネントです。
 * プロセスが実行中の場合は緑のバッジ、停止中の場合は赤のバッジと再起動ボタンを表示します。
 * ローディング中はスピナーを表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.running - プロセスが実行中かどうか
 * @param props.loading - ローディング中かどうか
 * @param props.onRestart - 再起動ボタンがクリックされたときのコールバック関数
 * @returns プロセス状態表示のJSX要素
 */
export function ProcessStatus({ running, loading, onRestart }: ProcessStatusProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" data-testid="process-status-spinner" />
        <span className="text-sm text-gray-600 dark:text-gray-400">読み込み中...</span>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1 rounded-full px-3 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          data-testid="process-status-badge"
        >
          <PlayCircle className="w-4 h-4" data-testid="process-status-icon-running" />
          <span>実行中</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="flex items-center gap-1 rounded-full px-3 py-1 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        data-testid="process-status-badge"
      >
        <StopCircle className="w-4 h-4" data-testid="process-status-icon-stopped" />
        <span>停止</span>
      </span>
      <button
        onClick={onRestart}
        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
        aria-label="プロセスを再起動"
      >
        <RotateCw className="w-4 h-4" />
        <span>再起動</span>
      </button>
    </div>
  );
}
