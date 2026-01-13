'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useRepositoryStore } from '@/store/repository-store';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; repositoryId: string; parentBranch: string }) => Promise<void>;
}

interface ValidationErrors {
  name?: string;
  repository?: string;
  branch?: string;
}

/**
 * Generate branch name from session name
 */
function generateBranchName(sessionName: string): string {
  const sanitized = sessionName
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `session/${sanitized}`;
}

/**
 * Validate session name
 */
function validateName(name: string): string | undefined {
  if (!name.trim()) {
    return 'Session name is required';
  } else if (name.length < 2) {
    return 'Session name must be at least 2 characters';
  } else if (name.length > 50) {
    return 'Session name must be at most 50 characters';
  } else if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    return 'Session name can only contain letters, numbers, hyphens, and underscores';
  }
  return undefined;
}

/**
 * Create session modal component
 *
 * Provides a form to create a new Docker-based session.
 * Uses registered repositories for session creation.
 */
export function CreateSessionModal({ isOpen, onClose, onCreate }: CreateSessionModalProps) {
  // Repository store
  const {
    repositories,
    selectedRepository,
    branches,
    defaultBranch,
    loading: repositoryLoading,
    error: repositoryError,
    fetchRepositories,
    selectRepository,
    clearError,
  } = useRepositoryStore();

  // Form state
  const [sessionName, setSessionName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch repositories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRepositories();
    }
  }, [isOpen, fetchRepositories]);

  // Set default branch when branches are loaded
  useEffect(() => {
    if (defaultBranch && !selectedBranch) {
      setSelectedBranch(defaultBranch);
    }
  }, [defaultBranch, selectedBranch]);

  // Reset selected branch when repository changes
  useEffect(() => {
    if (selectedRepository) {
      setSelectedBranch(defaultBranch || '');
    }
  }, [selectedRepository, defaultBranch]);

  const resetForm = () => {
    setSessionName('');
    setSelectedBranch('');
    setErrors({});
    setSubmitError(null);
    selectRepository(null);
    clearError();
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repoId = e.target.value;
    if (!repoId) {
      selectRepository(null);
      setSelectedBranch('');
      return;
    }
    const repo = repositories.find((r) => r.id === repoId);
    if (repo) {
      selectRepository(repo);
    }
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    const nameError = validateName(sessionName);
    if (nameError) {
      newErrors.name = nameError;
    }

    if (!selectedRepository) {
      newErrors.repository = 'Repository is required';
    }

    if (selectedRepository && !selectedBranch) {
      newErrors.branch = 'Parent branch is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: sessionName.trim(),
        repositoryId: selectedRepository!.id,
        parentBranch: selectedBranch,
      });
      resetForm();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatedBranchName = sessionName.trim() ? generateBranchName(sessionName.trim()) : '';

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Create New Session
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Repository Selection */}
                  <div>
                    <label
                      htmlFor="repository"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Repository
                    </label>
                    <div className="relative">
                      <select
                        id="repository"
                        value={selectedRepository?.id || ''}
                        onChange={handleRepositoryChange}
                        disabled={isSubmitting || repositoryLoading}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                          errors.repository ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <option value="">Select repository...</option>
                        {repositories.map((repo) => (
                          <option key={repo.id} value={repo.id}>
                            {repo.name} ({repo.type})
                          </option>
                        ))}
                      </select>
                      {repositoryLoading && (
                        <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                          <Loader2 size={16} className="animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
                    {errors.repository && (
                      <p className="mt-1 text-sm text-red-500">{errors.repository}</p>
                    )}
                    {repositoryError && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-red-500">
                        <AlertCircle size={14} />
                        <span>{repositoryError}</span>
                      </div>
                    )}
                  </div>

                  {/* Parent Branch Selection */}
                  <div>
                    <label
                      htmlFor="parent-branch"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Parent Branch
                    </label>
                    <div className="relative">
                      <select
                        id="parent-branch"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={isSubmitting || !selectedRepository || branches.length === 0}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                          errors.branch ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {!selectedRepository && (
                          <option value="">Select repository first...</option>
                        )}
                        {selectedRepository && branches.length === 0 && (
                          <option value="">Loading branches...</option>
                        )}
                        {branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.branch && (
                      <p className="mt-1 text-sm text-red-500">{errors.branch}</p>
                    )}
                  </div>

                  {/* Session Name */}
                  <div>
                    <label
                      htmlFor="session-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Session Name
                    </label>
                    <input
                      id="session-name"
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="my-feature"
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                        errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                    )}
                  </div>

                  {/* Branch Name Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Branch Name (auto-generated)
                    </label>
                    <div
                      data-testid="branch-name-preview"
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 text-sm font-mono"
                    >
                      {generatedBranchName || 'session/...'}
                    </div>
                  </div>

                  {/* Submit Error */}
                  {submitError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create'
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
