'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Session } from '@/store';
import { SessionStatusIcon } from '@/components/sessions/SessionStatusIcon';

interface SessionTreeItemProps {
  /** セッション情報 */
  session: Session;
  /** アクティブ状態かどうか */
  isActive: boolean;
  /** クリック時のハンドラ */
  onClick: () => void;
  /** 削除ボタンクリック時のハンドラ */
  onDelete?: () => void;
}

/**
 * SessionTreeItemコンポーネント
 *
 * ツリー表示用のセッションアイテム。
 * セッション名とステータスアイコンを表示します。
 * ホバー時に削除アイコンを表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @returns セッションツリーアイテムのJSX要素
 */
export function SessionTreeItem({ session, isActive, onClick, onDelete }: SessionTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <div
      data-testid="session-tree-item"
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={`
          w-full text-left pl-8 pr-8 py-2 rounded-md
          transition-colors duration-150
          flex items-center gap-2
          ${
            isActive
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }
        `}
      >
        <SessionStatusIcon status={session.status} />
        <span className="truncate text-sm">{session.name}</span>
      </button>

      {/* 削除アイコン（ホバー時のみ表示） */}
      {isHovered && onDelete && (
        <button
          type="button"
          data-testid="delete-icon"
          onClick={handleDeleteClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
          title="セッションを削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

