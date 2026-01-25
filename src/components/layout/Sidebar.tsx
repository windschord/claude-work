'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { useUIStore } from '@/store/ui';
import { ProjectTreeItem } from './ProjectTreeItem';
import { CreateSessionModal } from '@/components/sessions/CreateSessionModal';
import { AddProjectButton } from './AddProjectButton';
import { AddProjectModal } from './AddProjectModal';

/**
 * サイドバーコンポーネント
 *
 * プロジェクト一覧とセッションをツリー表示します。
 * - プロジェクト一覧の表示
 * - 各プロジェクト配下にセッションをツリー表示
 * - プロジェクト展開/折りたたみ
 * - セッション選択と詳細ページへの遷移
 * - レスポンシブ対応（モバイル時は折りたたみ）
 */
export function Sidebar() {
  const router = useRouter();
  const {
    projects,
    sessions,
    currentSessionId,
    setSelectedProjectId,
    setCurrentSessionId,
    isSidebarOpen,
    setIsSidebarOpen,
    fetchSessions,
    fetchProjects,
  } = useAppStore();
  const { isProjectExpanded, toggleProject } = useUIStore();
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [selectedProjectIdForSession, setSelectedProjectIdForSession] = useState<string | null>(null);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);

  // プロジェクトごとにセッションをグループ化
  const sessionsByProject = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    projects.forEach((project) => {
      map.set(
        project.id,
        sessions.filter((session) => session.project_id === project.id)
      );
    });
    return map;
  }, [projects, sessions]);

  // プロジェクト展開/折りたたみ切り替え
  const handleProjectToggle = useCallback((projectId: string) => {
    toggleProject(projectId);
  }, [toggleProject]);

  // セッションクリック時の処理
  const handleSessionClick = useCallback(
    (sessionId: string, projectId: string) => {
      setCurrentSessionId(sessionId);
      setSelectedProjectId(projectId);
      router.push(`/sessions/${sessionId}`);
      // モバイル時はセッション選択後にサイドバーを閉じる
      setIsSidebarOpen(false);
    },
    [router, setCurrentSessionId, setSelectedProjectId, setIsSidebarOpen]
  );

  // 新規セッション追加時の処理（モーダルを開く）
  const handleAddSession = useCallback(
    (projectId: string) => {
      setSelectedProjectIdForSession(projectId);
      setSelectedProjectId(projectId);
      setIsCreateSessionModalOpen(true);
    },
    [setSelectedProjectId]
  );

  // セッション作成成功時の処理
  const handleSessionCreated = useCallback(
    async (sessionId: string) => {
      if (selectedProjectIdForSession) {
        await fetchSessions(selectedProjectIdForSession);
      }
      router.push(`/sessions/${sessionId}`);
      setIsSidebarOpen(false);
    },
    [selectedProjectIdForSession, fetchSessions, router, setIsSidebarOpen]
  );

  // プロジェクト追加成功時の処理
  const handleProjectAdded = useCallback(async () => {
    await fetchProjects();
  }, [fetchProjects]);

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
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">プロジェクト</h2>
            <AddProjectButton onClick={() => setIsAddProjectModalOpen(true)} />
          </div>

          {/* プロジェクトツリー */}
          <div className="flex-1 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                プロジェクトがありません
              </div>
            ) : (
              <div className="p-2">
                {projects.map((project) => (
                  <ProjectTreeItem
                    key={project.id}
                    project={project}
                    sessions={sessionsByProject.get(project.id) || []}
                    isExpanded={isProjectExpanded(project.id)}
                    currentSessionId={currentSessionId}
                    onToggle={() => handleProjectToggle(project.id)}
                    onSessionClick={(sessionId) =>
                      handleSessionClick(sessionId, project.id)
                    }
                    onAddSession={() => handleAddSession(project.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* セッション作成モーダル */}
      {selectedProjectIdForSession && (
        <CreateSessionModal
          isOpen={isCreateSessionModalOpen}
          onClose={() => setIsCreateSessionModalOpen(false)}
          projectId={selectedProjectIdForSession}
          onSuccess={handleSessionCreated}
        />
      )}

      {/* プロジェクト追加モーダル */}
      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onSuccess={handleProjectAdded}
      />
    </>
  );
}
