'use client';

import { FolderPlus } from 'lucide-react';

interface AddProjectButtonProps {
  /** クリック時のハンドラ */
  onClick: () => void;
}

/**
 * AddProjectButtonコンポーネント
 *
 * サイドバーにリポジトリを追加するためのボタン。
 * FolderPlusアイコンを表示し、クリックで追加モーダルを開きます。
 *
 * @param props - コンポーネントのプロパティ
 * @returns リポジトリ追加ボタンのJSX要素
 */
export function AddProjectButton({ onClick }: AddProjectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="リポジトリを追加"
      className="
        p-1.5 rounded-md
        hover:bg-gray-200 dark:hover:bg-gray-700
        text-gray-600 dark:text-gray-400
        transition-colors duration-150
      "
    >
      <FolderPlus
        className="w-5 h-5"
        data-testid="folder-plus-icon"
      />
    </button>
  );
}
