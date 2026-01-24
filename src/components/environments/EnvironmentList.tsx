'use client';

import { useState } from 'react';
import { Environment, CreateEnvironmentInput, UpdateEnvironmentInput } from '@/hooks/useEnvironments';
import { EnvironmentCard } from './EnvironmentCard';
import { EnvironmentForm } from './EnvironmentForm';
import { DeleteEnvironmentDialog } from './DeleteEnvironmentDialog';
import toast from 'react-hot-toast';

interface EnvironmentListProps {
  environments: Environment[];
  isLoading: boolean;
  error: string | null;
  onCreateEnvironment: (input: CreateEnvironmentInput) => Promise<Environment>;
  onUpdateEnvironment: (id: string, input: UpdateEnvironmentInput) => Promise<Environment>;
  onDeleteEnvironment: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

/**
 * 環境一覧コンポーネント
 *
 * 環境の一覧表示、追加、編集、削除の機能を提供します。
 * 環境がない場合は空の状態を表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @returns 環境一覧のJSX要素
 */
export function EnvironmentList({
  environments,
  isLoading,
  error,
  onCreateEnvironment,
  onUpdateEnvironment,
  onDeleteEnvironment,
  onRefresh,
}: EnvironmentListProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [environmentToEdit, setEnvironmentToEdit] = useState<Environment | null>(null);
  const [environmentToDelete, setEnvironmentToDelete] = useState<Environment | null>(null);

  const handleEditClick = (environment: Environment) => {
    setEnvironmentToEdit(environment);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (environment: Environment) => {
    setEnvironmentToDelete(environment);
    setIsDeleteDialogOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEnvironmentToEdit(null);
  };

  const handleDeleteDialogClose = () => {
    setIsDeleteDialogOpen(false);
    setEnvironmentToDelete(null);
  };

  const handleCreate = async (input: CreateEnvironmentInput | UpdateEnvironmentInput): Promise<Environment | void> => {
    try {
      const created = await onCreateEnvironment(input as CreateEnvironmentInput);
      toast.success('環境を作成しました');
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境の作成に失敗しました';
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleUpdate = async (input: CreateEnvironmentInput | UpdateEnvironmentInput) => {
    if (!environmentToEdit) return;
    try {
      await onUpdateEnvironment(environmentToEdit.id, input as UpdateEnvironmentInput);
      toast.success('環境を更新しました');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境の更新に失敗しました';
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!environmentToDelete) return;
    try {
      await onDeleteEnvironment(environmentToDelete.id);
      toast.success('環境を削除しました');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境の削除に失敗しました';
      toast.error(errorMessage);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">実行環境</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-500 dark:text-gray-400">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">実行環境</h1>
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            再読み込み
          </button>
        </div>
        <div className="text-center py-12">
          <p className="text-red-500 dark:text-red-400">{error}</p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">実行環境</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          環境を追加
        </button>
      </div>

      {environments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">環境がありません</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            「環境を追加」ボタンから新しい環境を追加してください
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((environment) => (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      <EnvironmentForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
        mode="create"
      />

      <EnvironmentForm
        isOpen={isEditModalOpen}
        onClose={handleEditModalClose}
        onSubmit={handleUpdate}
        environment={environmentToEdit}
        mode="edit"
      />

      <DeleteEnvironmentDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteDialogClose}
        environment={environmentToDelete}
        onConfirm={handleDelete}
      />
    </div>
  );
}
