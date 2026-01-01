'use client';

import { ChevronRight, ChevronDown, FolderGit2, Plus } from 'lucide-react';
import { Project, Session } from '@/store';
import { SessionTreeItem } from './SessionTreeItem';

interface ProjectTreeItemProps {
  /** プロジェクト情報 */
  project: Project;
  /** このプロジェクトに属するセッション一覧 */
  sessions: Session[];
  /** 展開状態 */
  isExpanded: boolean;
  /** 現在アクティブなセッションID */
  currentSessionId: string | null;
  /** 展開/折りたたみ切り替え時のハンドラ */
  onToggle: () => void;
  /** セッションクリック時のハンドラ */
  onSessionClick: (sessionId: string) => void;
  /** セッション追加ボタンクリック時のハンドラ */
  onAddSession: () => void;
}

/**
 * ProjectTreeItemコンポーネント
 *
 * ツリー表示用のプロジェクトアイテム。
 * プロジェクト名と展開/折りたたみ機能を持ち、
 * 子要素としてセッション一覧を表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @returns プロジェクトツリーアイテムのJSX要素
 */
export function ProjectTreeItem({
  project,
  sessions,
  isExpanded,
  currentSessionId,
  onToggle,
  onSessionClick,
  onAddSession,
}: ProjectTreeItemProps) {
  return (
    <div className="mb-1">
      {/* プロジェクトヘッダー */}
      <div className="flex items-center group">
        <button
          type="button"
          data-testid="project-toggle"
          onClick={onToggle}
          className="
            flex-1 flex items-center gap-2
            px-2 py-2 rounded-md
            hover:bg-gray-100 dark:hover:bg-gray-800
            text-gray-700 dark:text-gray-300
            transition-colors duration-150
          "
        >
          {isExpanded ? (
            <ChevronDown
              className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
              data-testid="chevron-down-icon"
            />
          ) : (
            <ChevronRight
              className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
              data-testid="chevron-right-icon"
            />
          )}
          <FolderGit2 className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <span className="truncate font-medium text-sm">{project.name}</span>
        </button>

        {/* 追加ボタン */}
        <button
          type="button"
          data-testid="add-session-button"
          onClick={(e) => {
            e.stopPropagation();
            onAddSession();
          }}
          className="
            p-1 rounded-md mr-1
            opacity-0 group-hover:opacity-100
            hover:bg-gray-200 dark:hover:bg-gray-700
            text-gray-500 dark:text-gray-400
            transition-all duration-150
          "
          title="新規セッション"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* セッション一覧 */}
      {isExpanded && sessions.length > 0 && (
        <div className="mt-1">
          {sessions.map((session) => (
            <SessionTreeItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onClick={() => onSessionClick(session.id)}
            />
          ))}
        </div>
      )}

      {/* セッションがない場合 */}
      {isExpanded && sessions.length === 0 && (
        <div className="pl-8 py-2 text-sm text-gray-400 dark:text-gray-500">
          セッションなし
        </div>
      )}
    </div>
  );
}
