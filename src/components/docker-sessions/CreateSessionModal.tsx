'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { CreateDockerSessionRequest } from '@/types/docker-session';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (request: CreateDockerSessionRequest) => Promise<void>;
}

interface ValidationErrors {
  name?: string;
  repoUrl?: string;
  branch?: string;
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
 */
export function CreateSessionModal({ isOpen, onClose, onCreate }: CreateSessionModalProps) {
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setRepoUrl('');
    setBranch('main');
    setErrors({});
    setSubmitError(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Session name is required';
    } else if (name.length < 2) {
      newErrors.name = 'Session name must be at least 2 characters';
    } else if (name.length > 50) {
      newErrors.name = 'Session name must be at most 50 characters';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      newErrors.name = 'Session name can only contain letters, numbers, hyphens, and underscores';
    }

    if (!repoUrl.trim()) {
      newErrors.repoUrl = 'Repository URL is required';
    } else if (!validateRepoUrl(repoUrl.trim())) {
      newErrors.repoUrl = 'Invalid repository URL format. Use SSH (git@...) or HTTPS format.';
    }

    if (!branch.trim()) {
      newErrors.branch = 'Branch name is required';
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
        name: name.trim(),
        repoUrl: repoUrl.trim(),
        branch: branch.trim(),
      });
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        errors.repoUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    {errors.repoUrl && (
                      <p className="mt-1 text-sm text-red-500">{errors.repoUrl}</p>
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
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="main"
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                        errors.branch ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    {errors.branch && (
                      <p className="mt-1 text-sm text-red-500">{errors.branch}</p>
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
