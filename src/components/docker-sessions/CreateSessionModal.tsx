'use client';

import { useState, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import type { CreateDockerSessionRequest, SessionSourceType } from '@/types/docker-session';
import { SourceTypeTabs } from './SourceTypeTabs';
import { DirectoryBrowser } from './DirectoryBrowser';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (request: CreateDockerSessionRequest) => Promise<void>;
}

interface RemoteValidationErrors {
  name?: string;
  repoUrl?: string;
  branch?: string;
}

interface LocalValidationErrors {
  name?: string;
  localPath?: string;
  branch?: string;
}

/**
 * Branch fetch state for local repository
 */
interface BranchState {
  branches: string[];
  currentBranch: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Validate repository URL
 */
function validateRepoUrl(url: string): boolean {
  // Support SSH and HTTPS formats
  const sshPattern = /^git@[\w.-]+:[\w./-]+\.git$/;
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w./-]+(?:\.git)?$/;
  return sshPattern.test(url) || httpsPattern.test(url);
}

/**
 * Create session modal component
 *
 * Provides a form to create a new Docker-based session.
 * Supports both remote (git clone) and local (bind mount) repositories.
 */
export function CreateSessionModal({ isOpen, onClose, onCreate }: CreateSessionModalProps) {
  // Source type state
  const [sourceType, setSourceType] = useState<SessionSourceType>('remote');

  // Remote form state
  const [remoteName, setRemoteName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [remoteBranch, setRemoteBranch] = useState('main');
  const [remoteErrors, setRemoteErrors] = useState<RemoteValidationErrors>({});

  // Local form state
  const [localName, setLocalName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [localBranch, setLocalBranch] = useState('');
  const [localErrors, setLocalErrors] = useState<LocalValidationErrors>({});
  const [showBrowser, setShowBrowser] = useState(false);
  const [branchState, setBranchState] = useState<BranchState>({
    branches: [],
    currentBranch: null,
    loading: false,
    error: null,
  });

  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Fetch branches for the selected local repository
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
      setLocalBranch(data.currentBranch || (data.branches.length > 0 ? data.branches[0] : ''));
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

  const resetForm = () => {
    // Reset source type
    setSourceType('remote');

    // Reset remote form
    setRemoteName('');
    setRepoUrl('');
    setRemoteBranch('main');
    setRemoteErrors({});

    // Reset local form
    setLocalName('');
    setLocalPath('');
    setLocalBranch('');
    setLocalErrors({});
    setBranchState({
      branches: [],
      currentBranch: null,
      loading: false,
      error: null,
    });

    // Reset shared state
    setSubmitError(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  /**
   * Validate session name
   */
  const validateName = (name: string): string | undefined => {
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
  };

  /**
   * Validate remote form
   */
  const validateRemote = (): boolean => {
    const newErrors: RemoteValidationErrors = {};

    const nameError = validateName(remoteName);
    if (nameError) {
      newErrors.name = nameError;
    }

    if (!repoUrl.trim()) {
      newErrors.repoUrl = 'Repository URL is required';
    } else if (!validateRepoUrl(repoUrl.trim())) {
      newErrors.repoUrl = 'Invalid repository URL format. Use SSH (git@...) or HTTPS format.';
    }

    if (!remoteBranch.trim()) {
      newErrors.branch = 'Branch name is required';
    }

    setRemoteErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Validate local form
   */
  const validateLocal = (): boolean => {
    const newErrors: LocalValidationErrors = {};

    const nameError = validateName(localName);
    if (nameError) {
      newErrors.name = nameError;
    }

    if (!localPath) {
      newErrors.localPath = 'Repository path is required';
    }

    if (localPath && !localBranch && branchState.branches.length > 0) {
      newErrors.branch = 'Branch is required';
    }

    setLocalErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle remote form submission
   */
  const handleRemoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateRemote()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: remoteName.trim(),
        sourceType: 'remote',
        repoUrl: repoUrl.trim(),
        branch: remoteBranch.trim(),
      });
      resetForm();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle local form submission
   */
  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateLocal()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: localName.trim(),
        sourceType: 'local',
        localPath,
        branch: localBranch,
      } as CreateDockerSessionRequest);
      resetForm();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };

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

                {/* Source Type Tabs */}
                <div className="mb-4">
                  <SourceTypeTabs
                    value={sourceType}
                    onChange={setSourceType}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Remote Form */}
                {sourceType === 'remote' && (
                  <form onSubmit={handleRemoteSubmit} className="space-y-4">
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
                        value={remoteName}
                        onChange={(e) => setRemoteName(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="my-session"
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                          remoteErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {remoteErrors.name && (
                        <p className="mt-1 text-sm text-red-500">{remoteErrors.name}</p>
                      )}
                    </div>

                    {/* Repository URL */}
                    <div>
                      <label
                        htmlFor="repo-url"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Repository URL
                      </label>
                      <input
                        id="repo-url"
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="git@github.com:user/repo.git"
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                          remoteErrors.repoUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {remoteErrors.repoUrl && (
                        <p className="mt-1 text-sm text-red-500">{remoteErrors.repoUrl}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        SSH or HTTPS format
                      </p>
                    </div>

                    {/* Branch */}
                    <div>
                      <label
                        htmlFor="branch"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Branch
                      </label>
                      <input
                        id="branch"
                        type="text"
                        value={remoteBranch}
                        onChange={(e) => setRemoteBranch(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="main"
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                          remoteErrors.branch ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {remoteErrors.branch && (
                        <p className="mt-1 text-sm text-red-500">{remoteErrors.branch}</p>
                      )}
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
                          'Create Session'
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Local Form */}
                {sourceType === 'local' && (
                  <form onSubmit={handleLocalSubmit} className="space-y-4">
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
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="my-session"
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                          localErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {localErrors.name && (
                        <p className="mt-1 text-sm text-red-500">{localErrors.name}</p>
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
                            localErrors.localPath ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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
                      {localErrors.localPath && (
                        <p className="mt-1 text-sm text-red-500">{localErrors.localPath}</p>
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
                          value={localBranch}
                          onChange={(e) => setLocalBranch(e.target.value)}
                          disabled={isSubmitting || !localPath || branchState.loading || branchState.branches.length === 0}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                            localErrors.branch ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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
                      {localErrors.branch && (
                        <p className="mt-1 text-sm text-red-500">{localErrors.branch}</p>
                      )}
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
                          'Create Session'
                        )}
                      </button>
                    </div>
                  </form>
                )}

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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
