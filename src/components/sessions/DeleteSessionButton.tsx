'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useAppStore, Session } from '@/store';
import { DeleteSessionDialog } from './DeleteSessionDialog';

interface DeleteSessionButtonProps {
  session: Session;
  className?: string;
}

/**
 * セッション削除ボタンコンポーネント
 *
 * タスク44.6: セッション詳細ページからセッションを削除するためのボタン
 * クリックすると確認ダイアログが表示され、削除後はプロジェクトページにリダイレクトされます。
 *
 * @param props.session - 削除対象のセッション
 * @param props.className - 追加のCSSクラス
 */
export function DeleteSessionButton({ session, className }: DeleteSessionButtonProps) {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteSession = useAppStore((state) => state.deleteSession);

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteSession(session.id);
      setIsDeleteDialogOpen(false);
      // プロジェクト一覧ページにリダイレクト
      router.push('/projects');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'セッションの削除に失敗しました';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  };

  return (
    <>
      <button
        onClick={handleDeleteClick}
        className={`
          flex items-center gap-2 px-3 py-2
          text-red-600 hover:text-red-700
          hover:bg-red-50 dark:hover:bg-red-900/20
          rounded-lg transition-colors
          ${className || ''}
        `}
        aria-label="セッションを削除"
      >
        <Trash2 className="w-4 h-4" />
        <span className="hidden sm:inline">削除</span>
      </button>

      <DeleteSessionDialog
        isOpen={isDeleteDialogOpen}
        sessionName={session.name}
        worktreePath={session.worktree_path}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </>
  );
}
