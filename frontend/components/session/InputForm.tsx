'use client';

import { useState, KeyboardEvent } from 'react';

interface InputFormProps {
  onSubmit: (content: string) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

export default function InputForm({ onSubmit, isLoading, disabled = false }: InputFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = async () => {
    if (!content.trim() || isLoading || disabled) return;

    try {
      await onSubmit(content.trim());
      setContent('');
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Enter: 送信, Shift+Enter: 改行)"
          disabled={isLoading || disabled}
          className="flex-1 resize-none border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          rows={3}
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isLoading || disabled}
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '送信中...' : '送信'}
        </button>
      </div>
    </div>
  );
}
