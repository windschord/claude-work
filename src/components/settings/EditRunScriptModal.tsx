'use client';

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useRunScriptStore, type RunScript } from '@/store/run-scripts';

interface EditRunScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  script: RunScript;
}

/**
 * ランスクリプト編集モーダルコンポーネント
 *
 * 既存のランスクリプトを編集するモーダルダイアログです。
 * 名前、説明、コマンドを編集できます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるときのコールバック関数
 * @param props.projectId - プロジェクトID
 * @param props.script - 編集対象のスクリプト
 * @returns ランスクリプト編集モーダルのJSX要素
 */
export function EditRunScriptModal({
  isOpen,
  onClose,
  projectId,
  script,
}: EditRunScriptModalProps) {
  const { updateScript } = useRunScriptStore();
  const [name, setName] = useState(script.name);
  const [description, setDescription] = useState(script.description || '');
  const [command, setCommand] = useState(script.command);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setName(script.name);
    setDescription(script.description || '');
    setCommand(script.command);
  }, [script]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('スクリプト名を入力してください');
      return;
    }

    if (!command.trim()) {
      setError('コマンドを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      await updateScript(projectId, script.id, {
        name: name.trim(),
        description: description.trim() || null,
        command: command.trim(),
      });
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('スクリプトの更新に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  ランスクリプトを編集
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label
                      htmlFor="script-name-edit"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      名前 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="script-name-edit"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Test"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="script-description-edit"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      説明
                    </label>
                    <input
                      id="script-description-edit"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Run unit tests (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="script-command-edit"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      コマンド <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="script-command-edit"
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="npm test"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      disabled={isLoading}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!name.trim() || !command.trim() || isLoading}
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
