'use client';

/**
 * Docker Sessions Home Page
 *
 * Docker sessionの管理画面。セッション一覧とターミナルを統合表示します。
 * - 左側: セッション一覧
 * - 右側: 選択されたセッションのターミナル
 */

import { useState, useCallback } from 'react';
import {
  DockerSessionList,
  CreateSessionModal,
  DockerTerminalPanel,
  RepositorySection,
} from '@/components/docker-sessions';
import { useDockerSessions } from '@/hooks/useDockerSessions';
import { Plus } from 'lucide-react';

export default function DockerHome() {
  const {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    startSession,
    stopSession,
    deleteSession,
  } = useDockerSessions();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSessionConnect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCreateSession = useCallback(
    async (request: { name: string; repoUrl: string; branch: string }) => {
      const session = await createSession(request);
      setSelectedSessionId(session.id);
    },
    [createSession]
  );

  const handleStartSession = useCallback(
    async (sessionId: string) => {
      await startSession(sessionId);
    },
    [startSession]
  );

  const handleStopSession = useCallback(
    async (sessionId: string) => {
      await stopSession(sessionId);
      // If this was the selected session, clear selection
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
    },
    [stopSession, selectedSessionId]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
      // If this was the selected session, clear selection
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
    },
    [deleteSession, selectedSessionId]
  );

  return (
    <div className="flex h-full flex-col">
      {/* ページタイトル (E2Eテスト用) */}
      <h1 className="sr-only">Docker Sessions</h1>

      <div className="flex flex-1 min-h-0">
        {/* サイドバー (左側) */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {/* リポジトリセクション */}
          <RepositorySection />

          {/* 区切り線 */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* セッションヘッダー */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sessions
            </h2>
            <button
              onClick={handleOpenCreateModal}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              title="Create new session"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* セッションリスト */}
          <div className="flex-1 overflow-auto">
            <DockerSessionList
              sessions={sessions}
              loading={loading}
              error={error}
              onRefresh={fetchSessions}
              onStart={handleStartSession}
              onStop={handleStopSession}
              onDelete={handleDeleteSession}
              onConnect={handleSessionConnect}
            />
          </div>
        </div>

        {/* ターミナル (右側) */}
        <div className="flex-1 min-w-0">
          {selectedSessionId ? (
            <DockerTerminalPanel sessionId={selectedSessionId} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <p className="text-lg mb-2">No session selected</p>
                <p className="text-sm">
                  Select a session from the list or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* セッション作成モーダル */}
      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
        onCreate={handleCreateSession}
      />
    </div>
  );
}
