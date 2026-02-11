'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, RadioGroup, Listbox } from '@headlessui/react';
import { Check, ChevronsUpDown, GitBranch } from 'lucide-react';
import { useEnvironments, Environment } from '@/hooks/useEnvironments';
import { ClaudeOptionsForm } from '@/components/claude-options/ClaudeOptionsForm';
import type { ClaudeCodeOptions, CustomEnvVars } from '@/components/claude-options/ClaudeOptionsForm';

export interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (sessionId: string) => void;
}

interface Branch {
  name: string;
  isDefault: boolean;
}

/**
 * 環境タイプに応じたバッジの色を取得
 */
function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'HOST':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'DOCKER':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'SSH':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

/**
 * 新規セッション作成モーダルコンポーネント
 *
 * 利用可能な実行環境一覧をラジオボタンで表示し、
 * 選択した環境でセッションを作成するモーダルダイアログです。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @param props.projectId - セッションを作成するプロジェクトのID
 * @param props.onSuccess - セッション作成成功時のコールバック関数（セッションIDを受け取る）
 * @returns セッション作成モーダルのJSX要素
 */
export function CreateSessionModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: CreateSessionModalProps) {
  const { environments, isLoading: isEnvironmentsLoading } = useEnvironments();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isBranchesLoading, setIsBranchesLoading] = useState(false);
  const [claudeOptions, setClaudeOptions] = useState<ClaudeCodeOptions>({});
  const [customEnvVars, setCustomEnvVars] = useState<CustomEnvVars>({});

  // デフォルト環境または最初の環境を初期選択
  useEffect(() => {
    if (!isEnvironmentsLoading && environments.length > 0 && !selectedEnvironmentId) {
      const defaultEnv = environments.find((env) => env.is_default);
      if (defaultEnv) {
        setSelectedEnvironmentId(defaultEnv.id);
      } else {
        // デフォルト環境がない場合は最初の環境を選択
        setSelectedEnvironmentId(environments[0].id);
      }
    }
  }, [environments, isEnvironmentsLoading, selectedEnvironmentId]);

  // モーダルが閉じられた時に状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setClaudeOptions({});
      setCustomEnvVars({});
      // selectedEnvironmentIdは維持（再度開いた時に同じ環境が選択される）
    }
  }, [isOpen]);

  // プロジェクトのブランチ一覧を取得
  useEffect(() => {
    if (!isOpen || !projectId) {
      return;
    }

    const fetchBranches = async () => {
      setIsBranchesLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/branches`);
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches || []);
          // デフォルトブランチを初期選択
          const defaultBranch = data.branches?.find((b: Branch) => b.isDefault);
          if (defaultBranch) {
            setSelectedBranch(defaultBranch.name);
          } else if (data.branches?.length > 0) {
            setSelectedBranch(data.branches[0].name);
          }
        }
      } catch {
        // ブランチ取得失敗は無視（ローカルプロジェクトでは失敗する場合がある）
        setBranches([]);
      } finally {
        setIsBranchesLoading(false);
      }
    };

    fetchBranches();
  }, [isOpen, projectId]);

  const handleSubmit = async () => {
    if (!selectedEnvironmentId) {
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environment_id: selectedEnvironmentId,
          source_branch: selectedBranch || undefined,
          claude_code_options: Object.keys(claudeOptions).some(k => claudeOptions[k as keyof ClaudeCodeOptions] !== undefined) ? claudeOptions : undefined,
          custom_env_vars: Object.keys(customEnvVars).length > 0 ? customEnvVars : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'セッション作成に失敗しました');
      }

      onSuccess(data.session.id);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'セッション作成に失敗しました';
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      onClose();
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
                  新規セッション作成
                </Dialog.Title>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    実行環境
                  </label>

                  {isEnvironmentsLoading ? (
                    <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
                      環境を読み込み中...
                    </div>
                  ) : environments.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400 py-4">
                      利用可能な環境がありません
                    </div>
                  ) : (
                    <RadioGroup
                      value={selectedEnvironmentId}
                      onChange={setSelectedEnvironmentId}
                      disabled={isCreating}
                    >
                      <div className="space-y-2">
                        {environments.map((env: Environment) => (
                          <RadioGroup.Option
                            key={env.id}
                            value={env.id}
                            className={({ checked }) =>
                              `relative flex cursor-pointer rounded-lg px-4 py-3 focus:outline-none ${
                                checked
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                              } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`
                            }
                          >
                            {({ checked }) => (
                              <div className="flex w-full items-center justify-between">
                                <div className="flex items-center">
                                  <div className="text-sm">
                                    <RadioGroup.Label
                                      as="p"
                                      className={`font-medium ${
                                        checked
                                          ? 'text-blue-900 dark:text-blue-100'
                                          : 'text-gray-900 dark:text-gray-100'
                                      }`}
                                    >
                                      {env.name}
                                    </RadioGroup.Label>
                                    {env.description && (
                                      <RadioGroup.Description
                                        as="span"
                                        className="text-xs text-gray-500 dark:text-gray-400"
                                      >
                                        {env.description}
                                      </RadioGroup.Description>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeBadgeColor(
                                      env.type
                                    )}`}
                                  >
                                    {env.type}
                                  </span>
                                  {checked && (
                                    <div className="shrink-0 text-blue-600 dark:text-blue-400">
                                      <Check className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </RadioGroup.Option>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </div>

                {/* ブランチ選択 */}
                {branches.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <div className="flex items-center gap-1">
                        <GitBranch className="w-4 h-4" />
                        ベースブランチ
                      </div>
                    </label>
                    {isBranchesLoading ? (
                      <div className="flex items-center justify-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                        ブランチを読み込み中...
                      </div>
                    ) : (
                      <Listbox value={selectedBranch} onChange={setSelectedBranch} disabled={isCreating}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm">
                            <span className="block truncate text-gray-900 dark:text-gray-100">
                              {selectedBranch || 'ブランチを選択'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                            </span>
                          </Listbox.Button>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                              {branches.map((branch) => (
                                <Listbox.Option
                                  key={branch.name}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                      active
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                        : 'text-gray-900 dark:text-gray-100'
                                    }`
                                  }
                                  value={branch.name}
                                >
                                  {({ selected }) => (
                                    <>
                                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                        {branch.name}
                                        {branch.isDefault && (
                                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(default)</span>
                                        )}
                                      </span>
                                      {selected && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                                          <Check className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                      )}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      セッションのワークツリーを作成するベースとなるブランチを選択
                    </p>
                  </div>
                )}

                {/* Claude Code オプション */}
                <div className="mb-4">
                  <ClaudeOptionsForm
                    options={claudeOptions}
                    envVars={customEnvVars}
                    onOptionsChange={setClaudeOptions}
                    onEnvVarsChange={setCustomEnvVars}
                    disabled={isCreating}
                  />
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
                    disabled={isCreating}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={
                      isCreating ||
                      isEnvironmentsLoading ||
                      environments.length === 0 ||
                      !selectedEnvironmentId
                    }
                  >
                    {isCreating ? '作成中...' : '作成'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
