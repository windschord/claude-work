'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle } from 'lucide-react';

interface DangerousPathWarningProps {
  isOpen: boolean;
  path: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 危険なホストパス警告ダイアログコンポーネント
 *
 * ユーザーが危険なホストパス（/etc, /proc等）をボリュームマウントに
 * 入力した際に表示する警告確認ダイアログです。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.path - 警告対象のパス
 * @param props.onConfirm - 「同意して設定」ボタンのコールバック
 * @param props.onCancel - 「キャンセル」ボタンのコールバック
 * @returns 警告ダイアログのJSX要素
 */
export function DangerousPathWarning({ isOpen, path, onConfirm, onCancel }: DangerousPathWarningProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-20" onClose={onCancel}>
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
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                    >
                      セキュリティ警告
                    </Dialog.Title>

                    <div className="mt-3">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        以下のパスはシステムディレクトリです:
                      </p>
                      <code className="mt-2 block rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-mono text-red-600 dark:text-red-400">
                        {path}
                      </code>
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                        このパスをマウントするとセキュリティリスクがあります。本当に設定しますか?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                  >
                    同意して設定
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
