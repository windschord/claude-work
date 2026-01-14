'use client';

import { useEffect, useState } from 'react';
import { FolderGit, Globe, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useRepositoryStore } from '@/store/repository-store';
import { AddRepositoryModal } from './AddRepositoryModal';

/**
 * Repository section component for sidebar
 *
 * Displays a list of repositories with session counts and management actions.
 */
export function RepositorySection() {
  const { repositories, loading, error, fetchRepositories, deleteRepository } =
    useRepositoryStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const handleDelete = async (id: string, name: string, sessionCount: number) => {
    if (sessionCount > 0) {
      return;
    }

    if (confirm(`Delete repository "${name}"?`)) {
      setDeletingId(id);
      try {
        await deleteRepository(id);
      } catch {
        // error is already set in store
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Repositories
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          title="Add repository"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {loading && repositories.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && repositories.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No repositories
          </div>
        )}

        {/* Repository list */}
        {repositories.length > 0 && (
          <ul className="py-1">
            {repositories.map((repo) => {
              const locationInfo = repo.type === 'local' ? repo.path : repo.url;
              return (
                <li
                  key={repo.id}
                  className="group flex items-start justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {/* Icon */}
                    {repo.type === 'local' ? (
                      <FolderGit
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-green-600 dark:text-green-500"
                      />
                    ) : (
                      <Globe
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-500"
                      />
                    )}
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                          title={repo.name}
                        >
                          {repo.name}
                        </p>
                        {/* Type Badge */}
                        <span
                          className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${
                            repo.type === 'local'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {repo.type === 'local' ? 'Local' : 'Remote'}
                        </span>
                      </div>
                      {/* Path/URL */}
                      {locationInfo && (
                        <p
                          className="text-xs text-gray-500 dark:text-gray-400 truncate"
                          title={locationInfo}
                        >
                          {locationInfo}
                        </p>
                      )}
                      {/* Session count */}
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {repo.sessionCount} session{repo.sessionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(repo.id, repo.name, repo.sessionCount)}
                    disabled={repo.sessionCount > 0 || deletingId === repo.id}
                    className={`p-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      repo.sessionCount > 0
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400'
                    } disabled:opacity-50`}
                    title={
                      repo.sessionCount > 0
                        ? 'Cannot delete: has active sessions'
                        : 'Delete repository'
                    }
                  >
                    {deletingId === repo.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add Repository Modal */}
      {showAddModal && <AddRepositoryModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
