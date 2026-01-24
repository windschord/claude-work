'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { Check } from 'lucide-react';
import { useEnvironments, Environment } from '@/hooks/useEnvironments';

export interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (sessionId: string) => void;
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
      // selectedEnvironmentIdは維持（再度開いた時に同じ環境が選択される）
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedEnvironmentId) {
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          environment_id: selectedEnvironmentId,
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
