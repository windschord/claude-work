'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { PromptHistoryDropdown } from './PromptHistoryDropdown';
import { useEnvironments } from '@/hooks/useEnvironments';

interface CreateSessionFormProps {
  projectId: string;
  /** セッション作成成功時のコールバック。作成されたセッションIDが渡される */
  onSuccess?: (sessionId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * セッション作成フォームコンポーネント
 *
 * 新しいセッションを作成するためのフォームです。
 * セッション名（任意）とプロンプトを入力し、バリデーションとエラーハンドリングを行います。
 * セッション名が未入力の場合は自動生成されます。
 * モデル選択はClaude Code側で行うため、このフォームでは省略しています。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.projectId - セッションを作成するプロジェクトのID
 * @param props.onSuccess - セッション作成成功時のコールバック関数。作成されたセッションIDが引数として渡される（オプション）
 * @param props.onError - セッション作成失敗時のコールバック関数（オプション）
 * @returns セッション作成フォームのJSX要素
 */
export function CreateSessionForm({ projectId, onSuccess, onError }: CreateSessionFormProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [dockerMode, setDockerMode] = useState(false);
  const [dockerEnabled, setDockerEnabled] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createSession = useAppStore((state) => state.createSession);
  const { environments, isLoading: isEnvironmentsLoading } = useEnvironments();

  // Docker機能の有効/無効を取得
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setDockerEnabled(data.features?.dockerEnabled ?? false);
        }
      } catch {
        // エラー時はDocker機能を無効として扱う
        setDockerEnabled(false);
      }
    };
    fetchFeatures();
  }, []);

  // デフォルト環境を初期選択
  useEffect(() => {
    if (!isEnvironmentsLoading && environments.length > 0 && !environmentId) {
      const defaultEnv = environments.find((env) => env.is_default);
      if (defaultEnv) {
        setEnvironmentId(defaultEnv.id);
      }
    }
  }, [environments, isEnvironmentsLoading, environmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション（プロンプトのみ必須）
    if (!prompt.trim()) {
      setError('プロンプトを入力してください');
      return;
    }

    // セッション名が空白のみの場合はエラーとする（ユーザーに明示的なフィードバックを表示）
    if (name && !name.trim()) {
      setError('セッション名は空白のみでは入力できません。空欄にするか、有効な名前を入力してください');
      return;
    }

    // セッション名が未入力の場合はサーバー側で一意な名前を自動生成
    const sessionName = name.trim() || undefined;

    setIsLoading(true);

    try {
      const sessionId = await createSession(projectId, {
        name: sessionName,
        prompt: prompt.trim(),
        dockerMode,
        environment_id: environmentId || undefined,
      });

      // 成功時: フォームをクリア
      setName('');
      setPrompt('');
      setDockerMode(false);
      // environment_idはリセットしない（デフォルト環境を維持）

      if (onSuccess) {
        onSuccess(sessionId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'セッションの作成に失敗しました';
      setError(errorMessage);

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新しいセッションを作成</h3>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          セッション名
        </label>
        <input
          id="session-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="セッション名（未入力の場合は自動生成）"
          className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          disabled={isLoading}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="session-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            プロンプト
          </label>
          <PromptHistoryDropdown onSelect={(content) => setPrompt(content)} />
        </div>
        <textarea
          id="session-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="プロンプトを入力"
          rows={4}
          className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="environment-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          実行環境
        </label>
        <select
          id="environment-select"
          value={environmentId}
          onChange={(e) => setEnvironmentId(e.target.value)}
          disabled={isLoading || isEnvironmentsLoading}
          className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <option value="">環境を選択しない</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name} ({env.type})
              {env.is_default ? ' [デフォルト]' : ''}
            </option>
          ))}
        </select>
        {isEnvironmentsLoading && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            環境一覧を読み込み中...
          </p>
        )}
      </div>

      {/* environment_id未選択時のみレガシーdockerModeチェックボックスを表示 */}
      {dockerEnabled && !environmentId && (
        <div className="flex items-center">
          <input
            id="docker-mode"
            type="checkbox"
            checked={dockerMode}
            onChange={(e) => setDockerMode(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
          />
          <label htmlFor="docker-mode" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Dockerモードで実行
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              (隔離されたコンテナ環境でClaude Codeを実行)
            </span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 min-h-[44px] rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {isLoading ? '作成中...' : 'セッション作成'}
      </button>
    </form>
  );
}
