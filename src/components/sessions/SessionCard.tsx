'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Session, useAppStore } from '@/store';
import { SessionStatusIcon } from './SessionStatusIcon';
import { GitStatusBadge } from './GitStatusBadge';
import { DeleteSessionDialog } from './DeleteSessionDialog';

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteSession = useAppStore((state) => state.deleteSession);

  const handleClick = () => {
    onClick(session.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteSession(session.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの削除に失敗しました';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteError(null);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        data-testid="session-card"
        className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 min-h-[120px] hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 hover:scale-[1.02]"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{session.name}</h3>
            {session.docker_mode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Docker
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="delete-session-button"
              onClick={handleDeleteClick}
              className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
              aria-label="セッションを削除"
            >
              <Trash2 size={16} />
            </button>
            <SessionStatusIcon status={session.status} />
          </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">ブランチ: {session.branch_name}</p>
          {/* TODO: Session型にgit_statusフィールドを追加し、APIから実際のGitステータスを取得する */}
          {(() => {
            const gitStatus = (session as { git_status?: 'clean' | 'modified' | 'untracked' }).git_status;
            const badgeStatus: 'clean' | 'dirty' = gitStatus === 'clean' || !gitStatus ? 'clean' : 'dirty';
            return <GitStatusBadge status={badgeStatus} />;
          })()}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          作成日時: {new Date(session.created_at).toLocaleString('ja-JP')}
        </p>
      </div>
      </div>
      <DeleteSessionDialog
        isOpen={isDeleteDialogOpen}
        sessionName={session.name}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </>
  );
}
