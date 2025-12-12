'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectsStore } from '@/store/projects';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { projects, fetchProjects, isLoading } = useProjectsStore();

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  const project = projects.find((p) => p.id === projectId);

  if (isLoading) {
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

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">セッション一覧</h2>
        <p className="text-gray-500">セッション一覧は今後実装予定です。</p>
      </div>
    </div>
  );
}
