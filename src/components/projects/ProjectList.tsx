'use client';

import { useState } from 'react';
import { useAppStore, Project } from '@/store';
import { ProjectCard } from './ProjectCard';
import { AddProjectModal } from './AddProjectModal';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { ProjectSettingsModal } from './ProjectSettingsModal';

/**
 * プロジェクト一覧コンポーネント
 *
 * プロジェクトの一覧表示、追加、削除、設定の機能を提供します。
 * プロジェクトがない場合は空の状態を表示します。
 *
 * @returns プロジェクト一覧のJSX要素
 */
export function ProjectList() {
  const { projects } = useAppStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
  };

  const handleSettingsClick = (project: Project) => {
    setProjectToEdit(project);
    setIsSettingsModalOpen(true);
  };

  const handleDeleteDialogClose = () => {
    setIsDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleSettingsModalClose = () => {
    setIsSettingsModalOpen(false);
    setProjectToEdit(null);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロジェクト一覧</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          プロジェクト追加
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">プロジェクトがありません</p>
          <p className="text-sm text-gray-400 mt-2">
            「プロジェクト追加」ボタンから新しいプロジェクトを追加してください
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDeleteClick}
              onSettings={handleSettingsClick}
            />
          ))}
        </div>
      )}

      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <DeleteProjectDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteDialogClose}
        project={projectToDelete}
      />

      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleSettingsModalClose}
        project={projectToEdit}
      />
    </div>
  );
}
