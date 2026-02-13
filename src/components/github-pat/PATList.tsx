'use client';

import { useState } from 'react';
import { GitHubPAT, CreatePATInput, UpdatePATInput } from '@/hooks/useGitHubPATs';
import toast from 'react-hot-toast';

interface PATListProps {
  pats: GitHubPAT[];
  isLoading: boolean;
  error: string | null;
  onCreatePAT: (input: CreatePATInput) => Promise<GitHubPAT>;
  onUpdatePAT: (id: string, input: UpdatePATInput) => Promise<GitHubPAT>;
  onDeletePAT: (id: string) => Promise<void>;
  onTogglePAT: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function PATList({
  pats,
  isLoading,
  error,
  onCreatePAT,
  onUpdatePAT,
  onDeletePAT,
  onTogglePAT,
  onRefresh,
}: PATListProps) {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const resetAddForm = () => {
    setNewName('');
    setNewToken('');
    setNewDescription('');
    setIsAddFormOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await onCreatePAT({
        name: newName.trim(),
        token: newToken.trim(),
        ...(newDescription.trim() && { description: newDescription.trim() }),
      });
      toast.success('PATを作成しました');
      resetAddForm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PATの作成に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditStart = (pat: GitHubPAT) => {
    setEditingId(pat.id);
    setEditName(pat.name);
    setEditDescription(pat.description || '');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdate = async (id: string) => {
    setIsUpdating(true);
    try {
      await onUpdatePAT(id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      toast.success('PATを更新しました');
      handleEditCancel();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PATの更新に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeletePAT(id);
      toast.success('PATを削除しました');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PATの削除に失敗しました';
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    try {
      await onTogglePAT(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PATの切り替えに失敗しました';
      toast.error(errorMessage);
    } finally {
      setTogglingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GitHub PAT管理</h1>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GitHub PAT管理</h1>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GitHub PAT管理</h1>
        <button
          onClick={() => setIsAddFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          disabled={isAddFormOpen}
        >
          PATを追加
        </button>
      </div>

      {/* Add PAT Form */}
      {isAddFormOpen && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">新しいPATを追加</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="pat-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                id="pat-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: Personal GitHub PAT"
                maxLength={50}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isCreating}
              />
            </div>
            <div>
              <label htmlFor="pat-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                トークン <span className="text-red-500">*</span>
              </label>
              <input
                id="pat-token"
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="ghp_... または github_pat_..."
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isCreating}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                トークンは暗号化されて保存されます
              </p>
            </div>
            <div>
              <label htmlFor="pat-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                説明
              </label>
              <input
                id="pat-description"
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="例: 個人プロジェクト用"
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isCreating}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating || !newName.trim() || !newToken.trim()}
              >
                {isCreating ? '作成中...' : '作成'}
              </button>
              <button
                type="button"
                onClick={resetAddForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                disabled={isCreating}
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PAT Table */}
      {pats.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">PATが登録されていません</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            「PATを追加」ボタンから新しいPATを登録してください
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">名前</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">説明</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">ステータス</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">作成日</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">アクション</th>
              </tr>
            </thead>
            <tbody>
              {pats.map((pat) => (
                <tr key={pat.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  {editingId === pat.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={50}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          disabled={isUpdating}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={200}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          disabled={isUpdating}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={pat.isActive} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(pat.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleUpdate(pat.id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={isUpdating || !editName.trim()}
                          >
                            {isUpdating ? '保存中...' : '保存'}
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            disabled={isUpdating}
                          >
                            キャンセル
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {pat.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {pat.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={pat.isActive} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(pat.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggle(pat.id)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                              pat.isActive
                                ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-yellow-900 dark:hover:bg-yellow-800'
                                : 'text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-300 dark:bg-green-900 dark:hover:bg-green-800'
                            }`}
                            disabled={togglingId === pat.id}
                          >
                            {togglingId === pat.id ? '...' : pat.isActive ? '無効化' : '有効化'}
                          </button>
                          <button
                            onClick={() => handleEditStart(pat)}
                            className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900 dark:hover:bg-blue-800 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(pat.id)}
                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 dark:text-red-300 dark:bg-red-900 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
                            disabled={deletingId === pat.id}
                          >
                            {deletingId === pat.id ? '削除中...' : '削除'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      }`}
    >
      {isActive ? '有効' : '無効'}
    </span>
  );
}
