'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { useUIStore } from '@/store/ui';
import { ProjectTreeItem } from './ProjectTreeItem';
import { CreateSessionModal } from '@/components/sessions/CreateSessionModal';
import { AddProjectButton } from './AddProjectButton';
import { AddProjectModal } from '@/components/projects/AddProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Project, Session } from '@/store';
import toast from 'react-hot-toast';

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedProjectForSettings, setSelectedProjectForSettings] = useState<Project | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSessionDeleteDialogOpen, setIsSessionDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

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

  // プロジェクト設定を開く
  const handleOpenSettings = useCallback((project: Project) => {
    setSelectedProjectForSettings(project);
    setIsSettingsModalOpen(true);
  }, []);

  // プロジェクト設定成功時の処理
  const handleSettingsSuccess = useCallback(async () => {
    await fetchProjects();
    toast.success('プロジェクト設定を保存しました');
  }, [fetchProjects]);

  // プロジェクト削除ダイアログを開く
  const handleOpenDeleteDialog = useCallback((project: Project) => {
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
  }, []);

  // プロジェクト削除を実行
  const handleDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'プロジェクトの削除に失敗しました');
      }

      await fetchProjects();
      toast.success('プロジェクトを削除しました');
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'プロジェクトの削除に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [projectToDelete, fetchProjects]);

  // セッション削除ダイアログを開く
  const handleOpenSessionDeleteDialog = useCallback((sessionId: string, projectId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSessionToDelete(session);
      setSelectedProjectIdForSession(projectId);
      setIsSessionDeleteDialogOpen(true);
    }
  }, [sessions]);

  // セッション削除を実行
  const handleDeleteSession = useCallback(async () => {
    if (!sessionToDelete) return;

    setIsDeletingSession(true);
    try {
      const response = await fetch(`/api/sessions/${sessionToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'セッションの削除に失敗しました');
      }

      await fetchProjects();
      toast.success('セッションを削除しました');
      setIsSessionDeleteDialogOpen(false);
      setSessionToDelete(null);

      // 現在表示中のセッションを削除した場合、/にリダイレクト
      if (currentSessionId === sessionToDelete.id) {
        router.push('/');
        setCurrentSessionId(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'セッションの削除に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsDeletingSession(false);
    }
  }, [sessionToDelete, fetchProjects, currentSessionId, router, setCurrentSessionId]);

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
                    onSettings={() => handleOpenSettings(project)}
                    onDelete={() => handleOpenDeleteDialog(project)}
                    onSessionDelete={(sessionId) => handleOpenSessionDeleteDialog(sessionId, project.id)}
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
      />

      {/* プロジェクト設定モーダル */}
      {selectedProjectForSettings && (
        <ProjectSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => {
            setIsSettingsModalOpen(false);
            setSelectedProjectForSettings(null);
          }}
          onSuccess={handleSettingsSuccess}
          project={selectedProjectForSettings}
        />
      )}

      {/* プロジェクト削除確認ダイアログ */}
      {projectToDelete && (
        <DeleteConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setProjectToDelete(null);
          }}
          onConfirm={handleDeleteProject}
          title="プロジェクトを削除"
          message={`「${projectToDelete.name}」を削除しますか？この操作は取り消せません。関連するセッションも全て削除されます。(worktreeは削除されません)`}
          isLoading={isDeleting}
        />
      )}

      {/* セッション削除確認ダイアログ */}
      {sessionToDelete && (
        <DeleteConfirmDialog
          isOpen={isSessionDeleteDialogOpen}
          onClose={() => {
            setIsSessionDeleteDialogOpen(false);
            setSessionToDelete(null);
          }}
          onConfirm={handleDeleteSession}
          title="セッションを削除"
          message={`「${sessionToDelete.name}」を削除しますか？worktree(${sessionToDelete.worktree_path})とブランチも削除されます。`}
          isLoading={isDeletingSession}
        />
      )}
    </>
  );
}
