'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectsStore } from '@/store/projects';

interface ProjectListProps {
  onDeleteClick: (id: string, name: string) => void;
}

export function ProjectList({ onDeleteClick }: ProjectListProps) {
  const router = useRouter();
  const { projects, isLoading, error, fetchProjects, selectProject } = useProjectsStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-3 py-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">プロジェクトがありません</p>
      </div>
    );
  }

  const handleProjectClick = (id: string) => {
    selectProject(id);
    router.push(`/projects/${id}`);
  };

  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group flex items-center justify-between rounded-md px-3 py-2 md:py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer active:bg-gray-200 dark:active:bg-gray-600"
        >
          <div
            className="flex-1 truncate min-h-[44px] flex flex-col justify-center"
            onClick={() => handleProjectClick(project.id)}
          >
            <p className="font-medium text-gray-900 dark:text-white">{project.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{project.path}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(project.id, project.name);
            }}
            className="ml-2 min-w-[44px] min-h-[44px] md:opacity-0 md:group-hover:opacity-100 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-opacity active:bg-red-100 dark:active:bg-red-900/50"
          >
            <span className="sr-only">削除</span>
            <svg
              className="h-5 w-5 md:h-4 md:w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
