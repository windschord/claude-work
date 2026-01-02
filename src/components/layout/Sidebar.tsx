'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { useSettingsStore } from '@/store/settings';
import { useUIStore } from '@/store/ui';
import { ProjectTreeItem } from './ProjectTreeItem';

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
  } = useAppStore();
  const { defaultModel } = useSettingsStore();
  const { isProjectExpanded, toggleProject } = useUIStore();
  const [isCreating, setIsCreating] = useState(false);

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

  // 新規セッション追加時の処理（ワンクリック作成）
  const handleAddSession = useCallback(
    async (projectId: string) => {
      if (isCreating) return;

      setIsCreating(true);
      setSelectedProjectId(projectId);

      try {
        const response = await fetch(`/api/projects/${projectId}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: defaultModel,
            prompt: '',
          }),
        });

        const data = await response.json();

        if (response.ok && data.session) {
          // セッション一覧を更新
          await fetchSessions(projectId);
          // 新しいセッションに遷移
          router.push(`/sessions/${data.session.id}`);
          setIsSidebarOpen(false);
        }
      } catch (error) {
        console.error('Failed to create session:', error);
      } finally {
        setIsCreating(false);
      }
    },
    [isCreating, defaultModel, setSelectedProjectId, fetchSessions, router, setIsSidebarOpen]
  );

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
    </>
  );
}
