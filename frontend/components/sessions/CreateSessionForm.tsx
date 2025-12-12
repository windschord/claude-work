'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { usePromptHistoryStore } from '@/store/promptHistory';
import PromptHistoryDropdown from './PromptHistoryDropdown';
import { CLAUDE_MODELS } from '@/lib/constants';
import type { Project } from '@/lib/api';

interface CreateSessionFormProps {
  projectId: string;
  project: Project;
  onSubmit: (name: string, initialPrompt?: string, count?: number, model?: string) => Promise<void>;
  isLoading: boolean;
}

interface FormData {
  name: string;
  initialPrompt: string;
  count: number;
  model: string;
}

export default function CreateSessionForm({ projectId, project, onSubmit, isLoading }: CreateSessionFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<FormData>({
    defaultValues: {
      name: '',
      initialPrompt: '',
      count: 1,
      model: project.default_model,
    },
  });
  const { saveToHistory } = usePromptHistoryStore();

  const count = watch('count');
  const sessionName = watch('name');

  const handleFormSubmit = async (data: FormData) => {
    try {
      await onSubmit(data.name, data.initialPrompt || undefined, data.count, data.model);

      // プロンプトが入力されていれば履歴に保存
      if (data.initialPrompt && data.initialPrompt.trim()) {
        try {
          await saveToHistory(projectId, data.initialPrompt.trim());
        } catch (error) {
          console.error('Failed to save prompt history:', error);
        }
      }

      reset();
      setIsExpanded(false);
    } catch (error) {
      // エラーはストアで処理される
    }
  };

  const handleHistorySelect = (promptText: string) => {
    setValue('initialPrompt', promptText);
  };

  // プレビュー用のセッション名リストを生成
  const getPreviewNames = (): string[] => {
    if (!sessionName || count <= 1) {
      return [sessionName || ''];
    }
    return Array.from({ length: Math.min(count, 10) }, (_, i) => `${sessionName}-${i + 1}`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">新しいセッション</h2>
        {!isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            作成
          </button>
        )}
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              セッション名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              {...register('name', {
                required: 'セッション名は必須です',
                minLength: { value: 1, message: 'セッション名を入力してください' }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="例: feature-implementation"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-1">
              セッション数
            </label>
            <select
              id="count"
              {...register('count', {
                valueAsNumber: true,
                min: { value: 1, message: 'セッション数は1以上である必要があります' },
                max: { value: 10, message: 'セッション数は10以下である必要があります' }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isLoading}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
            {errors.count && (
              <p className="mt-1 text-sm text-red-600">{errors.count.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
              モデル
            </label>
            <select
              id="model"
              {...register('model')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isLoading}
            >
              {CLAUDE_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {count > 1 && sessionName && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                作成されるセッション名（プレビュー）
              </label>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200">
                {getPreviewNames().join(', ')}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700">
                初期プロンプト（任意）
              </label>
              <PromptHistoryDropdown projectId={projectId} onSelect={handleHistorySelect} />
            </div>
            <textarea
              id="initialPrompt"
              {...register('initialPrompt')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Claude Codeに最初に送信するプロンプトを入力してください"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '作成中...' : '作成'}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setIsExpanded(false);
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
