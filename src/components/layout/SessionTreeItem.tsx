'use client';

import { Session } from '@/store';
import { SessionStatusIcon } from '@/components/sessions/SessionStatusIcon';

interface SessionTreeItemProps {
  /** セッション情報 */
  session: Session;
  /** アクティブ状態かどうか */
  isActive: boolean;
  /** クリック時のハンドラ */
  onClick: () => void;
}

/**
 * SessionTreeItemコンポーネント
 *
 * ツリー表示用のセッションアイテム。
 * セッション名とステータスアイコンを表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @returns セッションツリーアイテムのJSX要素
 */
export function SessionTreeItem({ session, isActive, onClick }: SessionTreeItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left pl-8 pr-3 py-2 rounded-md
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
  );
}
