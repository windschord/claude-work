'use client';

import { useState } from 'react';
import { ProjectList } from '@/components/projects/ProjectList';
import { AddProjectModal } from '@/components/projects/AddProjectModal';
import { DeleteProjectDialog } from '@/components/projects/DeleteProjectDialog';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
  };
  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* モバイル用閉じるボタン */}
          <div className="md:hidden flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">メニュー</h2>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
            >
              <span className="sr-only">メニューを閉じる</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* サイドバーコンテンツ */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* プロジェクト追加ボタン */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:bg-indigo-700"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                プロジェクト追加
              </button>

              {/* プロジェクト一覧エリア */}
              <div className="mt-6">
                <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  プロジェクト
                </h3>
                <div className="mt-2 space-y-1">
                  <ProjectList onDeleteClick={handleDeleteClick} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* モーダルとダイアログ */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <DeleteProjectDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteDialogClose}
        projectId={deleteTarget?.id ?? null}
        projectName={deleteTarget?.name ?? null}
      />
    </>
  );
}
