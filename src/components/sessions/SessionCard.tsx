'use client';

import { Session } from '@/store';
import { SessionStatusIcon } from './SessionStatusIcon';

interface SessionCardProps {
  session: Session;
  onClick: (sessionId: string) => void;
}

/**
 * セッションカードコンポーネント
 *
 * セッションの概要情報を表示するカードです。
 * セッション名、ステータス、モデル、ブランチ名、作成日時を表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.session - 表示するセッション情報
 * @param props.onClick - カードがクリックされたときのコールバック関数
 * @returns セッションカードのJSX要素
 */
export function SessionCard({ session, onClick }: SessionCardProps) {
  return (
    <div
      className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(session.id)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{session.name}</h3>
        <SessionStatusIcon status={session.status} />
      </div>
      <div className="space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-400">モデル: {session.model}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">ブランチ: {session.branch_name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          作成日時: {new Date(session.created_at).toLocaleString('ja-JP')}
        </p>
      </div>
    </div>
  );
}
