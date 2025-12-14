'use client';

import { useState, FormEvent, KeyboardEvent } from 'react';

interface InputFormProps {
  onSubmit: (content: string) => void;
  disabled?: boolean;
}

/**
 * メッセージ入力フォームコンポーネント
 *
 * ユーザーがメッセージを入力して送信するためのフォームです。
 * Enterキーで送信、Shift+Enterで改行する機能を持ちます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.onSubmit - メッセージ送信時のコールバック関数
 * @param props.disabled - 入力を無効化するかどうか（オプション、デフォルト: false）
 * @returns メッセージ入力フォームのJSX要素
 */
export default function InputForm({ onSubmit, disabled = false }: InputFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (content.trim() && !disabled) {
      onSubmit(content.trim());
      setContent('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力してください（Shift+Enterで改行）"
          disabled={disabled}
          rows={3}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          送信
        </button>
      </div>
    </form>
  );
}
