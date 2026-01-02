'use client';

import { useEffect, useState, useRef } from 'react';
import { usePromptHistoryStore } from '@/store/promptHistory';

interface PromptHistoryDropdownProps {
  projectId: string;
  onSelect: (promptText: string) => void;
}

export default function PromptHistoryDropdown({ projectId, onSelect }: PromptHistoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { history, isLoading, fetchHistory, deleteFromHistory } = usePromptHistoryStore();

  useEffect(() => {
    if (projectId) {
      fetchHistory(projectId);
    }
  }, [projectId, fetchHistory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (promptText: string) => {
    onSelect(promptText);
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, historyId: number) => {
    e.stopPropagation();
    try {
      await deleteFromHistory(projectId, historyId);
    } catch (error) {
      console.error('Failed to delete prompt history:', error);
    }
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        title="プロンプト履歴"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-md shadow-lg z-10 border border-gray-200">
          <div className="py-1 max-h-96 overflow-y-auto">
            <div className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
              プロンプト履歴
            </div>
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                読み込み中...
              </div>
            ) : history.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                履歴がありません
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 group"
                  onClick={() => handleSelect(item.prompt_text)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {item.prompt_text.substring(0, 60)}
                        {item.prompt_text.length > 60 ? '...' : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.created_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="ml-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="削除"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
