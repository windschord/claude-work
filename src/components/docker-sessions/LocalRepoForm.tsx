'use client';

import { useState, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FolderOpen, Loader2, AlertCircle, X } from 'lucide-react';
import { DirectoryBrowser } from './DirectoryBrowser';

/**
 * Props for LocalRepoForm component
 */
export interface LocalRepoFormProps {
  onSubmit: (data: { name: string; localPath: string; branch: string }) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Branch fetch state
 */
interface BranchState {
  branches: string[];
  currentBranch: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Validation errors
 */
interface ValidationErrors {
  name?: string;
  localPath?: string;
  branch?: string;
}

/**
 * LocalRepoForm component
 *
 * Form for creating a session from a local repository.
 * Includes session name input, repository path selection via DirectoryBrowser,
 * and branch selection dropdown that populates after repository selection.
 */
export function LocalRepoForm({ onSubmit, isSubmitting }: LocalRepoFormProps) {
  const [name, setName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [branch, setBranch] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showBrowser, setShowBrowser] = useState(false);
  const [branchState, setBranchState] = useState<BranchState>({
    branches: [],
    currentBranch: null,
    loading: false,
    error: null,
  });

  /**
   * Fetch branches for the selected repository
   */
  const fetchBranches = useCallback(async (path: string) => {
    setBranchState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const url = `/api/filesystem/branches?path=${encodeURIComponent(path)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get branches');
      }

      const data = await response.json();
      setBranchState({
        branches: data.branches,
        currentBranch: data.currentBranch,
        loading: false,
        error: null,
      });
      setBranch(data.currentBranch || (data.branches.length > 0 ? data.branches[0] : ''));
    } catch (error) {
      setBranchState({
        branches: [],
        currentBranch: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get branches',
      });
    }
  }, []);

  /**
   * Handle repository selection from DirectoryBrowser
   */
  const handleRepositorySelect = useCallback((path: string) => {
    setLocalPath(path);
    setShowBrowser(false);
    fetchBranches(path);
  }, [fetchBranches]);

  /**
   * Handle browser cancel
   */
  const handleBrowserCancel = useCallback(() => {
    setShowBrowser(false);
  }, []);

  /**
   * Validate form fields
   */
  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate session name
    if (!name.trim()) {
      newErrors.name = 'Session name is required';
    } else if (name.length < 2) {
      newErrors.name = 'Session name must be at least 2 characters';
    } else if (name.length > 50) {
      newErrors.name = 'Session name must be at most 50 characters';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      newErrors.name = 'Session name can only contain letters, numbers, hyphens, and underscores';
    }

    // Validate repository path
    if (!localPath) {
      newErrors.localPath = 'Repository path is required';
    }

    // Validate branch
    if (localPath && !branch && branchState.branches.length > 0) {
      newErrors.branch = 'Branch is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit({
      name: name.trim(),
      localPath,
      branch,
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Session Name */}
        <div>
          <label
            htmlFor="local-session-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Session Name
          </label>
          <input
            id="local-session-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="my-session"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
              errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Repository Path */}
        <div>
          <label
            htmlFor="local-repo-path"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Repository Path
          </label>
          <div className="flex gap-2">
            <div
              id="local-repo-path"
              data-testid="repo-path-display"
              className={`flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate ${
                errors.localPath ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {localPath || 'No repository selected'}
            </div>
            <button
              type="button"
              onClick={() => setShowBrowser(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <FolderOpen size={16} />
              Browse
            </button>
          </div>
          {errors.localPath && (
            <p className="mt-1 text-sm text-red-500">{errors.localPath}</p>
          )}
        </div>

        {/* Branch Selection */}
        <div>
          <label
            htmlFor="local-branch"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Branch
          </label>
          <div className="relative">
            <select
              id="local-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={isSubmitting || !localPath || branchState.loading || branchState.branches.length === 0}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                errors.branch ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {branchState.branches.length === 0 && !branchState.loading && (
                <option value="">Select a repository first</option>
              )}
              {branchState.branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {branchState.loading && (
              <div
                data-testid="branch-loading"
                className="absolute right-8 top-1/2 transform -translate-y-1/2"
              >
                <Loader2 size={16} className="animate-spin text-blue-500" />
              </div>
            )}
          </div>
          {branchState.error && (
            <div data-testid="branch-error" className="mt-1 flex items-center gap-1 text-sm text-red-500">
              <AlertCircle size={14} />
              <span>{branchState.error}</span>
            </div>
          )}
          {errors.branch && (
            <p className="mt-1 text-sm text-red-500">{errors.branch}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 data-testid="submit-loading" size={16} className="mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Session'
            )}
          </button>
        </div>
      </form>

      {/* Directory Browser Modal */}
      <Transition appear show={showBrowser} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={handleBrowserCancel}
        >
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
                <Dialog.Panel
                  data-testid="directory-browser-modal"
                  className="w-full max-w-2xl h-[600px] transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Select Repository
                    </Dialog.Title>
                    <button
                      type="button"
                      onClick={handleBrowserCancel}
                      className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Directory Browser */}
                  <div className="flex-1 overflow-hidden">
                    <DirectoryBrowser
                      onSelect={handleRepositorySelect}
                      onCancel={handleBrowserCancel}
                    />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
