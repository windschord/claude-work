'use client';

import { Project } from '@/store';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onDelete: (project: Project) => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
        <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs font-medium">
          {project.session_count}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">{project.path}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onOpen(project.id)}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          開く
        </button>
        <button
          onClick={() => onDelete(project)}
          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  );
}
