'use client';

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { GitHubPAT, UpdatePATInput } from '@/hooks/useGitHubPATs';
import { validatePATName, validatePATFormat } from '@/lib/validation';

interface PATEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, input: UpdatePATInput) => Promise<GitHubPAT>;
  pat: GitHubPAT | null;
}

const MAX_DESCRIPTION_LENGTH = 200;

export function PATEditDialog({ isOpen, onClose, onSubmit, pat }: PATEditDialogProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && pat) {
      setName(pat.name);
      setToken('');
      setDescription(pat.description || '');
      setError('');
    }
  }, [isOpen, pat]);

  const handleClose = () => {
    if (isLoading) return;
    setName('');
    setToken('');
    setDescription('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pat) return;

    // name バリデーション
    const nameValidation = validatePATName(name.trim());
    if (!nameValidation.valid) {
      setError(nameValidation.errors.join(', '));
      return;
    }

    // token バリデーション（入力されている場合のみ）
    if (token.trim()) {
      const tokenValidation = validatePATFormat(token.trim());
      if (!tokenValidation.valid) {
        setError(tokenValidation.errors.join(', '));
        return;
      }
    }

    // description バリデーション
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(`説明は${MAX_DESCRIPTION_LENGTH}文字以内で入力してください`);
      return;
    }

    setIsLoading(true);

    try {
      await onSubmit(pat.id, {
        name: name.trim(),
        ...(token.trim() && { token: token.trim() }),
        description: description.trim(),
      });
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PATの更新に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  PATを編集
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label
                      htmlFor="pat-edit-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      名前 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="pat-edit-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例: Personal GitHub PAT"
                      maxLength={50}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      1-50文字
                    </p>
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="pat-edit-token"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      新しいトークン（変更する場合のみ入力）
                    </label>
                    <input
                      id="pat-edit-token"
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_... または github_pat_..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      空欄の場合は既存のトークンが維持されます
                    </p>
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="pat-edit-description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      説明
                    </label>
                    <textarea
                      id="pat-edit-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="例: 個人プロジェクト用"
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {description.length}/{MAX_DESCRIPTION_LENGTH}文字
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      disabled={isLoading}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!name.trim() || isLoading}
                    >
                      {isLoading ? '更新中...' : '更新'}
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
