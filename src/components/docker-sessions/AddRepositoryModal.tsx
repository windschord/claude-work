'use client';

import { useState, useCallback, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, AlertCircle, FolderOpen, FolderGit2 } from 'lucide-react';
import { SourceTypeTabs } from './SourceTypeTabs';
import { DirectoryBrowser } from './DirectoryBrowser';
import { useRepositoryStore } from '@/store/repository-store';

interface AddRepositoryModalProps {
  onClose: () => void;
}

/**
 * Extract repository name from URL
 * @example https://github.com/user/repo.git -> repo
 * @example git@github.com:user/repo.git -> repo
 */
function extractRepoNameFromUrl(url: string): string {
  const match = url.match(/\/([^\/]+?)(\.git)?$/) || url.match(/:([^\/]+?)(\.git)?$/);
  return match ? match[1].replace('.git', '') : '';
}

/**
 * Extract directory name from path
 * @example /home/user/projects/my-repo -> my-repo
 */
function extractDirNameFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

type SourceType = 'local' | 'remote';

interface LocalState {
  path: string;
  name: string;
  useDirectoryName: boolean;
  isGitRepository: boolean;
}

interface RemoteState {
  url: string;
  name: string;
  autoGenerateName: boolean;
}

/**
 * AddRepositoryModal component
 *
 * Modal dialog for adding a new repository (local or remote).
 * Uses tabs to switch between local directory selection and remote URL input.
 */
export function AddRepositoryModal({ onClose }: AddRepositoryModalProps) {
  // Source type state
  const [sourceType, setSourceType] = useState<SourceType>('local');

  // Local tab state
  const [localState, setLocalState] = useState<LocalState>({
    path: '',
    name: '',
    useDirectoryName: true,
    isGitRepository: false,
  });

  // Remote tab state
  const [remoteState, setRemoteState] = useState<RemoteState>({
    url: '',
    name: '',
    autoGenerateName: true,
  });

  // Browser modal state
  const [showBrowser, setShowBrowser] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Store
  const addRepository = useRepositoryStore((state) => state.addRepository);

  /**
   * Update local name when path changes and useDirectoryName is checked
   */
  useEffect(() => {
    if (localState.useDirectoryName && localState.path) {
      const dirName = extractDirNameFromPath(localState.path);
      setLocalState((prev) => ({ ...prev, name: dirName }));
    }
  }, [localState.path, localState.useDirectoryName]);

  /**
   * Update remote name when URL changes and autoGenerateName is checked
   */
  useEffect(() => {
    if (remoteState.autoGenerateName && remoteState.url) {
      const repoName = extractRepoNameFromUrl(remoteState.url);
      setRemoteState((prev) => ({ ...prev, name: repoName }));
    }
  }, [remoteState.url, remoteState.autoGenerateName]);

  /**
   * Handle directory selection from DirectoryBrowser
   */
  const handleDirectorySelect = useCallback((path: string) => {
    // Check if the selected path is a git repository
    // The DirectoryBrowser already filters to only allow git repositories to be selected
    setLocalState((prev) => ({
      ...prev,
      path,
      isGitRepository: true, // DirectoryBrowser only allows git repos to be selected
      name: prev.useDirectoryName ? extractDirNameFromPath(path) : prev.name,
    }));
    setShowBrowser(false);
  }, []);

  /**
   * Handle browser cancel
   */
  const handleBrowserCancel = useCallback(() => {
    setShowBrowser(false);
  }, []);

  /**
   * Reset form state
   */
  const resetForm = useCallback(() => {
    setSourceType('local');
    setLocalState({
      path: '',
      name: '',
      useDirectoryName: true,
      isGitRepository: false,
    });
    setRemoteState({
      url: '',
      name: '',
      autoGenerateName: true,
    });
    setSubmitError(null);
  }, []);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  }, [isSubmitting, resetForm, onClose]);

  /**
   * Validate local form
   */
  const validateLocal = (): string | null => {
    if (!localState.path) {
      return 'Please select a directory';
    }
    if (!localState.name.trim()) {
      return 'Name is required';
    }
    return null;
  };

  /**
   * Validate remote form
   */
  const validateRemote = (): string | null => {
    if (!remoteState.url.trim()) {
      return 'URL is required';
    }
    if (!remoteState.name.trim()) {
      return 'Name is required';
    }
    return null;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate based on source type
    const validationError = sourceType === 'local' ? validateLocal() : validateRemote();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      if (sourceType === 'local') {
        await addRepository({
          name: localState.name.trim(),
          type: 'local',
          path: localState.path,
        });
      } else {
        await addRepository({
          name: remoteState.name.trim(),
          type: 'remote',
          url: remoteState.url.trim(),
        });
      }

      resetForm();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to add repository');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle local name change
   */
  const handleLocalNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalState((prev) => ({
      ...prev,
      name: e.target.value,
      useDirectoryName: false,
    }));
  };

  /**
   * Handle useDirectoryName checkbox change
   */
  const handleUseDirectoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setLocalState((prev) => ({
      ...prev,
      useDirectoryName: checked,
      name: checked && prev.path ? extractDirNameFromPath(prev.path) : prev.name,
    }));
  };

  /**
   * Handle remote name change
   */
  const handleRemoteNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRemoteState((prev) => ({
      ...prev,
      name: e.target.value,
      autoGenerateName: false,
    }));
  };

  /**
   * Handle autoGenerateName checkbox change
   */
  const handleAutoGenerateNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setRemoteState((prev) => ({
      ...prev,
      autoGenerateName: checked,
      name: checked && prev.url ? extractRepoNameFromUrl(prev.url) : prev.name,
    }));
  };

  /**
   * Check if the Add button should be disabled
   */
  const isAddDisabled = (): boolean => {
    if (isSubmitting) return true;
    if (sourceType === 'local') {
      return !localState.path || !localState.name.trim();
    }
    return !remoteState.url.trim() || !remoteState.name.trim();
  };

  return (
    <Transition appear show={true} as={Fragment}>
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
                    Add Repository
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
                    data-testid="close-button"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Source Type Tabs */}
                <div className="mb-4">
                  <SourceTypeTabs
                    value={sourceType === 'local' ? 'local' : 'remote'}
                    onChange={(value) => setSourceType(value as SourceType)}
                    disabled={isSubmitting}
                  />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Local Tab Content */}
                  {sourceType === 'local' && (
                    <>
                      {/* Directory Browser Section */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Directory
                        </label>
                        <div className="flex gap-2">
                          <div
                            data-testid="directory-path-display"
                            className={`flex-1 flex items-center gap-2 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate border-gray-300 dark:border-gray-600`}
                          >
                            {localState.path ? (
                              <>
                                {localState.isGitRepository && (
                                  <FolderGit2
                                    size={16}
                                    className="text-orange-500 dark:text-orange-400 flex-shrink-0"
                                  />
                                )}
                                <span className="truncate">{localState.path}</span>
                              </>
                            ) : (
                              'No directory selected'
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowBrowser(true)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            data-testid="browse-button"
                          >
                            <FolderOpen size={16} />
                            Browse
                          </button>
                        </div>
                        {localState.isGitRepository && localState.path && (
                          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                            Git repository detected
                          </p>
                        )}
                      </div>

                      {/* Name Input */}
                      <div>
                        <label
                          htmlFor="local-name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Name
                        </label>
                        <input
                          id="local-name"
                          type="text"
                          value={localState.name}
                          onChange={handleLocalNameChange}
                          disabled={isSubmitting}
                          placeholder="Repository name"
                          className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 border-gray-300 dark:border-gray-600"
                          data-testid="local-name-input"
                        />
                        <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <input
                            type="checkbox"
                            checked={localState.useDirectoryName}
                            onChange={handleUseDirectoryNameChange}
                            disabled={isSubmitting}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            data-testid="use-directory-name-checkbox"
                          />
                          Use directory name
                        </label>
                      </div>
                    </>
                  )}

                  {/* Remote Tab Content */}
                  {sourceType === 'remote' && (
                    <>
                      {/* URL Input */}
                      <div>
                        <label
                          htmlFor="remote-url"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          URL
                        </label>
                        <input
                          id="remote-url"
                          type="text"
                          value={remoteState.url}
                          onChange={(e) =>
                            setRemoteState((prev) => ({ ...prev, url: e.target.value }))
                          }
                          disabled={isSubmitting}
                          placeholder="git@github.com:user/repo.git"
                          className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 border-gray-300 dark:border-gray-600"
                          data-testid="remote-url-input"
                        />
                      </div>

                      {/* Name Input */}
                      <div>
                        <label
                          htmlFor="remote-name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Name
                        </label>
                        <input
                          id="remote-name"
                          type="text"
                          value={remoteState.name}
                          onChange={handleRemoteNameChange}
                          disabled={isSubmitting}
                          placeholder="Repository name"
                          className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 border-gray-300 dark:border-gray-600"
                          data-testid="remote-name-input"
                        />
                        <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <input
                            type="checkbox"
                            checked={remoteState.autoGenerateName}
                            onChange={handleAutoGenerateNameChange}
                            disabled={isSubmitting}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            data-testid="auto-generate-name-checkbox"
                          />
                          Auto-generate from URL
                        </label>
                      </div>
                    </>
                  )}

                  {/* Submit Error */}
                  {submitError && (
                    <div
                      className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                      data-testid="submit-error"
                    >
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
                      data-testid="cancel-button"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAddDisabled()}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="add-button"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add'
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
                                Select Directory
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
                                onSelect={handleDirectorySelect}
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
