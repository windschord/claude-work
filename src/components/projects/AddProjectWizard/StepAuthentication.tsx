'use client';

import { useState } from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronDown, Check, Key, Plus } from 'lucide-react';
import { useGitHubPATs, GitHubPAT, CreatePATInput } from '@/hooks/useGitHubPATs';
import { PATCreateDialog } from '@/components/github-pat/PATCreateDialog';
import type { WizardData } from './types';

interface StepAuthenticationProps {
  githubPatId: string | null;
  onChange: (data: Partial<WizardData>) => void;
}

export function StepAuthentication({ githubPatId, onChange }: StepAuthenticationProps) {
  const { pats, isLoading, error, createPAT } = useGitHubPATs();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const activePATs = pats.filter((pat) => pat.isActive);
  const selected = activePATs.find((p) => p.id === githubPatId) || null;

  const handleChange = (pat: GitHubPAT | null) => {
    onChange({ githubPatId: pat?.id || null });
  };

  const handlePATSubmit = async (input: CreatePATInput): Promise<GitHubPAT> => {
    const newPAT = await createPAT(input);
    onChange({ githubPatId: newPAT.id });
    setShowCreateDialog(false);
    return newPAT;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
        認証情報設定
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        プライベートリポジトリ向けの認証設定です。パブリックリポジトリの場合はスキップできます。
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          GitHub Personal Access Token
        </label>

        <Listbox value={selected} onChange={handleChange}>
          <div className="relative">
            <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-gray-700 py-3 pl-4 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {selected ? (
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span className="block truncate text-gray-900 dark:text-gray-100">
                    {selected.name}
                  </span>
                </div>
              ) : (
                <span className="block truncate text-gray-500">
                  PATを使用しない（SSH Agent認証を使用）
                </span>
              )}
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </span>
            </Listbox.Button>

            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <Listbox.Option
                value={null}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                    active ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`
                }
              >
                {({ selected: isSelected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        isSelected ? 'font-medium' : 'font-normal'
                      } text-gray-900 dark:text-gray-100`}
                    >
                      PATを使用しない（SSH Agent認証を使用）
                    </span>
                    {isSelected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
              {activePATs.map((pat) => (
                <Listbox.Option
                  key={pat.id}
                  value={pat}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                      active ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`
                  }
                >
                  {({ selected: isSelected }) => (
                    <>
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500" />
                        <span
                          className={`block truncate ${
                            isSelected ? 'font-medium' : 'font-normal'
                          } text-gray-900 dark:text-gray-100`}
                        >
                          {pat.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          HTTPS でプライベートリポジトリをcloneする場合に PAT が必要です
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowCreateDialog(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <Plus className="w-4 h-4" />
        新しいPATを作成
      </button>

      {showCreateDialog && (
        <PATCreateDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handlePATSubmit}
        />
      )}
    </div>
  );
}
