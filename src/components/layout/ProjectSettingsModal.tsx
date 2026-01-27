'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Plus, Trash2 } from 'lucide-react';
import { Project } from '@/store';

interface RunScript {
  name: string;
  command: string;
}

export interface ProjectSettingsModalProps {
  /** モーダルの開閉状態 */
  isOpen: boolean;
  /** モーダルを閉じるときのコールバック */
  onClose: () => void;
  /** 設定保存成功時のコールバック */
  onSuccess: () => void;
  /** 編集対象のプロジェクト */
  project: Project;
}

/**
 * ProjectSettingsModalコンポーネント
 *
 * プロジェクトの設定を編集するためのモーダルダイアログ。
 * プロジェクト名、パス、ランスクリプトを編集できます。
 *
 * @param props - コンポーネントのプロパティ
 * @returns プロジェクト設定モーダルのJSX要素
 */
export function ProjectSettingsModal({
  isOpen,
  onClose,
  onSuccess,
  project,
}: ProjectSettingsModalProps) {
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);
  const [runScripts, setRunScripts] = useState<RunScript[]>(project.run_scripts || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // プロジェクトが変更された時に状態を更新
  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setPath(project.path);
      setRunScripts(project.run_scripts || []);
      setError('');
    }
  }, [isOpen, project]);

  const handleAddScript = () => {
    setRunScripts([...runScripts, { name: '', command: '' }]);
  };

  const handleRemoveScript = (index: number) => {
    setRunScripts(runScripts.filter((_, i) => i !== index));
  };

  const handleScriptChange = (index: number, field: 'name' | 'command', value: string) => {
    const newScripts = [...runScripts];
    newScripts[index] = { ...newScripts[index], [field]: value };
    setRunScripts(newScripts);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('プロジェクト名を入力してください');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 空のスクリプトをフィルタリング
      const filteredScripts = runScripts.filter(
        (script) => script.name.trim() && script.command.trim()
      );

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          path: path.trim(),
          run_scripts: filteredScripts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'プロジェクトの更新に失敗しました');
      }

      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'プロジェクトの更新に失敗しました';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  プロジェクト設定
                </Dialog.Title>

                <div className="space-y-4">
                  {/* プロジェクト名 */}
                  <div>
                    <label
                      htmlFor="project-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      プロジェクト名
                    </label>
                    <input
                      id="project-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* リポジトリパス */}
                  <div>
                    <label
                      htmlFor="project-path"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      リポジトリパス
                    </label>
                    <input
                      id="project-path"
                      type="text"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* ランスクリプト */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ランスクリプト
                      </label>
                      <button
                        type="button"
                        onClick={handleAddScript}
                        className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        disabled={isSubmitting}
                      >
                        <Plus className="w-4 h-4" />
                        スクリプトを追加
                      </button>
                    </div>

                    <div className="space-y-3">
                      {runScripts.map((script, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={script.name}
                              onChange={(e) => handleScriptChange(index, 'name', e.target.value)}
                              placeholder="名前"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                              disabled={isSubmitting}
                            />
                            <input
                              type="text"
                              value={script.command}
                              onChange={(e) => handleScriptChange(index, 'command', e.target.value)}
                              placeholder="コマンド"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 font-mono"
                              disabled={isSubmitting}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveScript(index)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            disabled={isSubmitting}
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {runScripts.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          スクリプトがありません
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '保存中...' : '保存'}
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
