'use client';

import { useEffect, Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Clock, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';

interface PromptHistoryDropdownProps {
  onSelect: (content: string) => void;
}

/**
 * プロンプト履歴ドロップダウンコンポーネント
 *
 * ユーザーが過去に使用したプロンプトの履歴を表示し、選択できるドロップダウンメニューです。
 * Headless UI Menuコンポーネントを使用して実装しています。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.onSelect - プロンプトが選択されたときのコールバック関数
 * @returns プロンプト履歴ドロップダウンのJSX要素
 */
export function PromptHistoryDropdown({ onSelect }: PromptHistoryDropdownProps) {
  const { prompts, isLoading, error, fetchPrompts, deletePrompt } = useAppStore();

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleDelete = async (e: React.MouseEvent, promptId: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await deletePrompt(promptId);
    } catch {
      // エラーはストアで管理されるため、ここでは追加のハンドリングは不要
      // 必要に応じて toast.error() などでユーザーに通知
    }
  };

  // used_countで降順ソート、最大10件まで表示
  const sortedPrompts = [...prompts]
    .sort((a, b) => b.used_count - a.used_count)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
          <Clock className="w-4 h-4 mr-2" />
          履歴
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute left-0 z-10 mt-2 w-80 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-96 overflow-y-auto">
          <div className="py-1">
            {sortedPrompts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                履歴がありません
              </div>
            ) : (
              sortedPrompts.map((prompt) => (
                <Menu.Item key={prompt.id}>
                  {({ active }) => (
                    <div
                      className={`${
                        active ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } px-4 py-2 text-sm flex items-start justify-between group cursor-pointer`}
                      onClick={() => onSelect(prompt.content)}
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-gray-900 dark:text-gray-100 truncate">
                          {prompt.content}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          使用回数: {prompt.used_count}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, prompt.id)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="削除"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Menu.Item>
              ))
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
