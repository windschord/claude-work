'use client';

import { useState } from 'react';
import { Trash2, GitPullRequest } from 'lucide-react';
import { Session } from '@/store';
import { SessionStatusIcon } from '@/components/sessions/SessionStatusIcon';

/** 環境タイプに応じたバッジの色 */
const environmentColors = {
  HOST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DOCKER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SSH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

/** 環境タイプの短縮表示 */
const environmentLabels = {
  HOST: 'H',
  DOCKER: 'D',
  SSH: 'S',
};

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

  const handlePRClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (session.pr_url) {
      window.open(session.pr_url, '_blank', 'noopener,noreferrer');
    }
  };

  // PRステータスに応じた色を取得
  const getPRStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'open':
        return 'text-green-600 dark:text-green-400';
      case 'merged':
        return 'text-purple-600 dark:text-purple-400';
      case 'closed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
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
        <span className="truncate text-sm flex-1">{session.name}</span>

        {/* 動作環境バッジ */}
        {session.environment_type && (
          <span
            data-testid="environment-badge"
            className={`
              px-1.5 py-0.5 text-xs font-medium rounded
              ${environmentColors[session.environment_type]}
            `}
            title={session.environment_name || session.environment_type}
          >
            {environmentLabels[session.environment_type]}
          </span>
        )}

        {/* PR番号バッジ */}
        {session.pr_number && (
          <span
            data-testid="pr-badge"
            onClick={handlePRClick}
            className={`
              flex items-center gap-0.5 text-xs font-medium cursor-pointer
              hover:underline ${getPRStatusColor(session.pr_status)}
            `}
            title={`PR #${session.pr_number} (${session.pr_status || 'unknown'})`}
          >
            <GitPullRequest className="w-3 h-3" />
            #{session.pr_number}
          </span>
        )}
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

