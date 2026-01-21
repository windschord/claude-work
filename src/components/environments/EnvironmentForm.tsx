'use client';

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition, Listbox } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { Environment, EnvironmentType, CreateEnvironmentInput, UpdateEnvironmentInput } from '@/hooks/useEnvironments';

interface EnvironmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<void>;
  environment?: Environment | null;
  mode: 'create' | 'edit';
}

const ENVIRONMENT_TYPES: { value: EnvironmentType; label: string; description: string }[] = [
  { value: 'HOST', label: 'ホスト', description: 'ローカルホスト環境で実行' },
  { value: 'DOCKER', label: 'Docker', description: 'Dockerコンテナ内で実行' },
  { value: 'SSH', label: 'SSH', description: 'SSHリモート接続（未実装）' },
];

/**
 * 環境作成・編集フォームモーダルコンポーネント
 *
 * 新規環境の作成と既存環境の編集を行うモーダルダイアログです。
 * バリデーション、エラーハンドリング、ローディング状態の管理を行います。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @param props.onSubmit - フォーム送信時のコールバック関数
 * @param props.environment - 編集対象の環境情報（編集モード時）
 * @param props.mode - 'create' または 'edit'
 * @returns 環境フォームモーダルのJSX要素
 */
export function EnvironmentForm({ isOpen, onClose, onSubmit, environment, mode }: EnvironmentFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<EnvironmentType>('HOST');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 編集モードの場合、既存の値を設定
  useEffect(() => {
    if (mode === 'edit' && environment) {
      setName(environment.name);
      setType(environment.type);
      setDescription(environment.description || '');
    } else if (mode === 'create') {
      setName('');
      setType('HOST');
      setDescription('');
    }
  }, [mode, environment, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('環境名を入力してください');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'create') {
        await onSubmit({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          config: {},
        } as CreateEnvironmentInput);
      } else {
        await onSubmit({
          name: name.trim(),
          description: description.trim() || undefined,
        } as UpdateEnvironmentInput);
      }
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('HOST');
    setDescription('');
    setError('');
    onClose();
  };

  const selectedTypeOption = ENVIRONMENT_TYPES.find((t) => t.value === type);

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
                  {mode === 'create' ? '環境を追加' : '環境を編集'}
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label
                      htmlFor="environment-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      環境名
                    </label>
                    <input
                      id="environment-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例: Docker Dev"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isLoading}
                    />
                  </div>

                  {mode === 'create' && (
                    <div className="mb-4">
                      <label
                        htmlFor="environment-type"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        タイプ
                      </label>
                      <Listbox value={type} onChange={setType} disabled={isLoading}>
                        <div className="relative">
                          <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <span className="block truncate text-gray-900 dark:text-gray-100">
                              {selectedTypeOption?.label}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronDown
                                className="h-5 w-5 text-gray-400"
                                aria-hidden="true"
                              />
                            </span>
                          </Listbox.Button>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              {ENVIRONMENT_TYPES.map((typeOption) => (
                                <Listbox.Option
                                  key={typeOption.value}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                      active
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                        : 'text-gray-900 dark:text-gray-100'
                                    }`
                                  }
                                  value={typeOption.value}
                                  disabled={typeOption.value === 'SSH'}
                                >
                                  {({ selected }) => (
                                    <>
                                      <div className="flex flex-col">
                                        <span
                                          className={`block truncate ${
                                            selected ? 'font-medium' : 'font-normal'
                                          } ${typeOption.value === 'SSH' ? 'opacity-50' : ''}`}
                                        >
                                          {typeOption.label}
                                        </span>
                                        <span className={`block text-xs text-gray-500 dark:text-gray-400 ${typeOption.value === 'SSH' ? 'opacity-50' : ''}`}>
                                          {typeOption.description}
                                        </span>
                                      </div>
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
                    </div>
                  )}

                  <div className="mb-4">
                    <label
                      htmlFor="environment-description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      説明（任意）
                    </label>
                    <textarea
                      id="environment-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="例: 開発用Docker環境"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                      disabled={isLoading}
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
                      disabled={isLoading}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!name.trim() || isLoading}
                    >
                      {isLoading
                        ? mode === 'create'
                          ? '作成中...'
                          : '更新中...'
                        : mode === 'create'
                        ? '作成'
                        : '更新'}
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
