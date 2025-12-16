'use client';

import { useRouter } from 'next/navigation';
import { Project } from '@/store';

interface ProjectCardProps {
  project: Project;
  onDelete: (project: Project) => void;
}

/**
 * プロジェクトカードコンポーネント
 *
 * プロジェクトの情報を表示し、開くまたは削除のアクションを提供します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.project - 表示するプロジェクト情報
 * @param props.onDelete - プロジェクトを削除するときのコールバック関数
 * @returns プロジェクトカードのJSX要素
 */
export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const router = useRouter();
  return (
    <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full px-2 py-1 text-xs font-medium">
          {project.session_count}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{project.path}</p>
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/projects/${project.id}`)}
          className="flex-1 bg-blue-600 dark:bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors"
        >
          開く
        </button>
        <button
          onClick={() => onDelete(project)}
          className="flex-1 bg-red-600 dark:bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 dark:hover:bg-red-700 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  );
}
