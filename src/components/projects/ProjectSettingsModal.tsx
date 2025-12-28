'use client';

import { useState, Fragment, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Project, useAppStore } from '@/store';
import toast from 'react-hot-toast';

/**
 * スクリプト編集用のローカル型定義
 *
 * APIから取得したRunScriptと新規作成のスクリプトの両方を扱うため、
 * 編集に必要な最小限のフィールドのみを含みます。
 * temp-で始まるIDは新規作成、それ以外は既存スクリプトを示します。
 */
interface EditableScript {
  id: string;
  name: string;
  description: string;
  command: string;
}

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

/**
 * プロジェクト設定モーダルコンポーネント
 *
 * プロジェクトのデフォルトモデルと実行スクリプトの設定を行うモーダルダイアログです。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @param props.project - 設定対象のプロジェクト
 * @returns プロジェクト設定モーダルのJSX要素
 */
export function ProjectSettingsModal({ isOpen, onClose, project }: ProjectSettingsModalProps) {
  const { fetchProjects } = useAppStore();
  const [defaultModel, setDefaultModel] = useState('auto');
  const [scripts, setScripts] = useState<EditableScript[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchScripts = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/scripts`);
      if (!response.ok) {
        throw new Error('Failed to fetch scripts');
      }
      const data = await response.json();
      // APIレスポンスをEditableScript形式にマッピング
      // description: string | null を description: string に変換
      const editableScripts: EditableScript[] = (data.scripts || []).map(
        (script: { id: string; name: string; description: string | null; command: string }) => ({
          id: script.id,
          name: script.name,
          description: script.description || '',
          command: script.command,
        })
      );
      setScripts(editableScripts);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
      toast.error('スクリプトの取得に失敗しました');
      setScripts([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen && project) {
      setDefaultModel(project.default_model || 'auto');
      fetchScripts(project.id);
    }
  }, [isOpen, project, fetchScripts]);

  /**
   * すべての設定を保存（モデル設定とスクリプト）
   */
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setError('');
    setIsLoading(true);

    try {
      // 1. モデル設定を保存
      const modelResponse = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_model: defaultModel,
        }),
      });

      if (!modelResponse.ok) {
        throw new Error('Failed to update project settings');
      }

      // 2. スクリプトを保存
      const incompleteScripts = scripts.filter(
        (s) => !s.name.trim() || !s.command.trim()
      );
      if (incompleteScripts.length > 0) {
        toast.error(`${incompleteScripts.length}件のスクリプトは名前またはコマンドが未入力のためスキップされます`);
      }

      for (const script of scripts) {
        if (!script.name.trim() || !script.command.trim()) {
          continue;
        }

        const isNewScript = !script.id || script.id.startsWith('temp-');

        if (isNewScript) {
          const response = await fetch(`/api/projects/${project.id}/scripts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: script.name,
              description: script.description || '',
              command: script.command,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create script');
          }
        } else {
          const response = await fetch(`/api/projects/${project.id}/scripts/${script.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: script.name,
              description: script.description || '',
              command: script.command,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to update script');
          }
        }
      }

      await fetchProjects();
      await fetchScripts(project.id);
      toast.success('設定を保存しました');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '設定の保存に失敗しました';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddScript = () => {
    // 一時的なIDを生成（新規スクリプトの識別用）
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setScripts([...scripts, { id: tempId, name: '', description: '', command: '' }]);
  };

  const handleScriptChange = (index: number, field: keyof EditableScript, value: string) => {
    const newScripts = [...scripts];
    newScripts[index] = { ...newScripts[index], [field]: value };
    setScripts(newScripts);
  };

  const handleDeleteScript = async (index: number) => {
    const script = scripts[index];
    if (!project) return;

    // temp-で始まるIDは未保存のスクリプト
    const isSavedScript = script.id && !script.id.startsWith('temp-');

    // 保存済みのスクリプトを削除する場合は確認ダイアログを表示
    if (isSavedScript && !window.confirm('このスクリプトを削除してもよろしいですか？')) {
      return;
    }

    // 保存済みのスクリプトのみAPI経由で削除
    if (isSavedScript) {
      try {
        const response = await fetch(`/api/projects/${project.id}/scripts/${script.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete script');
        }

        toast.success('スクリプトを削除しました');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'スクリプトの削除に失敗しました';
        toast.error(errorMessage);
        return;
      }
    }

    const newScripts = scripts.filter((_, i) => i !== index);
    setScripts(newScripts);
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!project) return null;

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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  プロジェクト設定
                </Dialog.Title>

                <form onSubmit={handleSaveAll}>
                  <div className="mb-6">
                    <label
                      htmlFor="default-model"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      デフォルトモデル
                    </label>
                    <select
                      id="default-model"
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                    >
                      <option value="auto">Auto</option>
                      <option value="opus">Opus</option>
                      <option value="sonnet">Sonnet</option>
                      <option value="haiku">Haiku</option>
                    </select>
                  </div>

                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        実行スクリプト
                      </label>
                      <button
                        type="button"
                        onClick={handleAddScript}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        disabled={isLoading}
                      >
                        + スクリプトを追加
                      </button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {scripts.map((script, index) => (
                        <div
                          key={script.id}
                          className="border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-gray-50 dark:bg-gray-700"
                        >
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <input
                                type="text"
                                value={script.name}
                                onChange={(e) => handleScriptChange(index, 'name', e.target.value)}
                                placeholder="名前"
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                disabled={isLoading}
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={script.description || ''}
                                onChange={(e) => handleScriptChange(index, 'description', e.target.value)}
                                placeholder="説明（任意）"
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                disabled={isLoading}
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={script.command}
                                onChange={(e) => handleScriptChange(index, 'command', e.target.value)}
                                placeholder="コマンド"
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleDeleteScript(index)}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                disabled={isLoading}
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
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
                      disabled={isLoading}
                    >
                      {isLoading ? '保存中...' : 'すべて保存'}
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
