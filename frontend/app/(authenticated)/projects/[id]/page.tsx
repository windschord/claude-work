'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectsStore } from '@/store/projects';
import { useSessionsStore } from '@/store/sessions';
import SessionList from '@/components/sessions/SessionList';
import CreateSessionForm from '@/components/sessions/CreateSessionForm';
import { RunScriptSettings } from '@/components/projects/RunScriptSettings';

type TabType = 'sessions' | 'settings';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const { projects, fetchProjects, isLoading: projectsLoading } = useProjectsStore();
  const { sessions, fetchSessions, createSession, isLoading: sessionsLoading, error } = useSessionsStore();

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  useEffect(() => {
    if (projectId) {
      fetchSessions(projectId);
    }
  }, [projectId, fetchSessions]);

  const project = projects.find((p) => p.id === projectId);

  const handleCreateSession = async (name: string, initialPrompt?: string, count?: number, model?: string) => {
    await createSession(projectId, name, initialPrompt, count, model);
  };

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">プロジェクトが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{project.path}</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`${
              activeTab === 'sessions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            セッション
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            設定
          </button>
        </nav>
      </div>

      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <CreateSessionForm
            projectId={projectId}
            project={project}
            onSubmit={handleCreateSession}
            isLoading={sessionsLoading}
          />

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">セッション一覧</h2>
            <SessionList sessions={sessions} isLoading={sessionsLoading} />
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-6">
          <RunScriptSettings projectId={projectId} />
        </div>
      )}
    </div>
  );
}
