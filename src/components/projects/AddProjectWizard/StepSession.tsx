'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Play, SkipForward } from 'lucide-react';
import type { WizardData } from './types';

interface StepSessionProps {
  createdProjectId: string | null;
  sessionName: string;
  onChange: (data: Partial<WizardData>) => void;
  onComplete: () => void;
  error: string | null;
  onRetry: () => void;
}

export function StepSession({
  createdProjectId,
  sessionName,
  onChange,
  onComplete,
  error,
  onRetry,
}: StepSessionProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const handleCreateSession = async () => {
    if (!createdProjectId) return;

    setIsCreating(true);
    setSessionError(null);

    try {
      const response = await fetch(`/api/projects/${createdProjectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'セッションの作成に失敗しました');
      }

      onComplete();
      router.push(`/sessions/${data.session.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'セッションの作成に失敗しました';
      setSessionError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // エラー状態
  if (error) {
    return (
      <div className="text-center py-6">
        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          プロジェクト追加に失敗しました
        </h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            もう一度試す
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center py-4 mb-4">
        <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          プロジェクトを追加しました
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          セッションを作成して作業を開始できます
        </p>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          実行環境の設定はプロジェクト設定から変更できます
        </p>
      </div>

      <div className="mb-4">
        <label
          htmlFor="session-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          セッション名（任意）
        </label>
        <input
          id="session-name"
          type="text"
          value={sessionName}
          onChange={(e) => onChange({ sessionName: e.target.value })}
          placeholder="自動生成されます"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          disabled={isCreating}
        />
      </div>

      {sessionError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{sessionError}</p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          disabled={isCreating}
        >
          <SkipForward className="w-4 h-4" />
          スキップ
        </button>
        <button
          type="button"
          onClick={handleCreateSession}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!createdProjectId || isCreating}
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isCreating ? '作成中...' : 'セッションを作成して開始'}
        </button>
      </div>
    </div>
  );
}
