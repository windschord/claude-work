'use client';

import { useState, type MouseEvent } from 'react';
import { Project, useAppStore } from '@/store';
import { CreateSessionModal } from '@/components/sessions/CreateSessionModal';
import { useRouter } from 'next/navigation';
import { RefreshCw, Globe, HardDrive, Container } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectCardProps {
  project: Project;
  onDelete: (project: Project) => void;
  onSettings: (project: Project) => void;
}

/**
 * プロジェクトカードコンポーネント
 *
 * プロジェクトの情報を表示し、開く、設定、削除のアクションを提供します。
 * リモートリポジトリの場合はバッジと更新ボタンを表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.project - 表示するプロジェクト情報
 * @param props.onDelete - プロジェクトを削除するときのコールバック関数
 * @param props.onSettings - プロジェクト設定を開くときのコールバック関数
 * @returns プロジェクトカードのJSX要素
 */
export function ProjectCard({ project, onDelete, onSettings }: ProjectCardProps) {
  const router = useRouter();
  const { pullProject } = useAppStore();
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const isRemote = !!project.remote_url;
  const cloneLocation = project.clone_location || 'host'; // 既存プロジェクトはhost扱い

  const handleNewSession = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsCreateSessionModalOpen(true);
  };

  const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete(project);
  };

  const handleSettings = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSettings(project);
  };

  const handlePull = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsPulling(true);

    try {
      const result = await pullProject(project.id);
      if (result.updated) {
        toast.success('リポジトリを更新しました');
      } else {
        toast.success('既に最新です');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsPulling(false);
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  return (
    <>
      <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {project.name}
            </h3>
            {isRemote && (
              <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full px-2 py-0.5 text-xs font-medium">
                <Globe className="w-3 h-3" />
                Remote
              </span>
            )}
            {cloneLocation === 'docker' && (
              <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full px-2 py-0.5 text-xs font-medium">
                <Container className="w-3 h-3" />
                Docker
              </span>
            )}
            {cloneLocation === 'host' && (
              <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full px-2 py-0.5 text-xs font-medium">
                <HardDrive className="w-3 h-3" />
                Host
              </span>
            )}
          </div>
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full px-2 py-1 text-xs font-medium">
            {project.session_count}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{project.path}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNewSession}
            className="flex-1 bg-blue-600 dark:bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors"
          >
            新規セッション
          </button>
          {isRemote && (
            <button
              type="button"
              onClick={handlePull}
              disabled={isPulling}
              className="bg-green-600 dark:bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="リモートから更新"
            >
              <RefreshCw className={`w-5 h-5 ${isPulling ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSettings}
            className="flex-1 bg-gray-600 dark:bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
          >
            設定
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 bg-red-600 dark:bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 dark:hover:bg-red-700 transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      <CreateSessionModal
        isOpen={isCreateSessionModalOpen}
        onClose={() => setIsCreateSessionModalOpen(false)}
        projectId={project.id}
        onSuccess={handleSessionCreated}
      />
    </>
  );
}
