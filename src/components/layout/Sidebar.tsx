'use client';

import { useRouter } from 'next/navigation';
import { FolderGit2 } from 'lucide-react';
import { useAppStore } from '@/store';

/**
 * サイドバーコンポーネント
 *
 * プロジェクト一覧を表示します。
 * - プロジェクト一覧の表示
 * - プロジェクト選択と詳細ページへの遷移
 * - レスポンシブ対応（モバイル時は折りたたみ）
 */
export function Sidebar() {
  const router = useRouter();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useAppStore();

  const handleProjectClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    router.push(`/projects/${projectId}`);
    // モバイル時はプロジェクト選択後にサイドバーを閉じる
    setIsSidebarOpen(false);
  };

  return (
    <>
      {/* オーバーレイ（モバイル時のみ） */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="h-full flex flex-col">
          {/* ヘッダー */}
          <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">プロジェクト</h2>
          </div>

          {/* プロジェクト一覧 */}
          <div className="flex-1 overflow-y-auto">
            {!projects || projects.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                プロジェクトがありません
              </div>
            ) : (
              <div className="p-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                    className={`
                      w-full text-left px-3 py-3 rounded-lg mb-1
                      transition-colors duration-150
                      ${
                        selectedProjectId === project.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <FolderGit2
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          selectedProjectId === project.id
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{project.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {project.session_count}セッション
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
