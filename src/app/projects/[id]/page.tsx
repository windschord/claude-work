'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { AuthGuard } from '@/components/AuthGuard';
import { SessionList } from '@/components/sessions/SessionList';
import { CreateSessionForm } from '@/components/sessions/CreateSessionForm';

/**
 * プロジェクト詳細ページ
 *
 * 特定のプロジェクトのセッション一覧と新しいセッションを作成するフォームを表示します。
 * URLパラメータからプロジェクトIDを取得し、そのプロジェクトに関連するセッションを表示します。
 * レイアウト（ヘッダー、サイドバー）は親のlayout.tsxが提供します。
 *
 * @returns プロジェクト詳細ページのJSX要素
 */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { sessions, fetchSessions, checkAuth } = useAppStore();

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      if (projectId) {
        await fetchSessions(projectId);
      }
    };

    initialize();
  }, [projectId, fetchSessions, checkAuth]);

  const handleSessionClick = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleSessionCreated = async () => {
    // セッション作成後、一覧を再取得
    await fetchSessions(projectId);
  };

  return (
    <AuthGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">セッション管理</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">プロジェクトのセッション一覧</p>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">セッション一覧</h2>
            <SessionList sessions={sessions} onSessionClick={handleSessionClick} />
          </div>

          <div>
            <CreateSessionForm projectId={projectId} onSuccess={handleSessionCreated} />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
