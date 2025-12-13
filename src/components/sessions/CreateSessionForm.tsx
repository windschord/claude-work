'use client';

import { useState } from 'react';
import { useAppStore } from '@/store';

interface CreateSessionFormProps {
  projectId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function CreateSessionForm({ projectId, onSuccess, onError }: CreateSessionFormProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createSession = useAppStore((state) => state.createSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!name.trim()) {
      setError('セッション名を入力してください');
      return;
    }

    if (!prompt.trim()) {
      setError('プロンプトを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      await createSession(projectId, {
        name: name.trim(),
        prompt: prompt.trim(),
      });

      // 成功時: フォームをクリア
      setName('');
      setPrompt('');

      if (onSuccess) {
        onSuccess();
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
    <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">新しいセッションを作成</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 mb-1">
          セッション名
        </label>
        <input
          id="session-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="セッション名を入力"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="session-prompt" className="block text-sm font-medium text-gray-700 mb-1">
          プロンプト
        </label>
        <textarea
          id="session-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="プロンプトを入力"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? '作成中...' : 'セッション作成'}
      </button>
    </form>
  );
}
