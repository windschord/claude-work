'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface DeleteRunScriptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scriptName: string;
}

/**
 * ランスクリプト削除確認ダイアログコンポーネント
 *
 * ランスクリプトを削除する前に確認を求めるダイアログです。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.onClose - ダイアログを閉じるときのコールバック関数
 * @param props.onConfirm - 削除を確認したときのコールバック関数
 * @param props.scriptName - 削除対象のスクリプト名
 * @returns ランスクリプト削除確認ダイアログのJSX要素
 */
export function DeleteRunScriptDialog({
  isOpen,
  onClose,
  onConfirm,
  scriptName,
}: DeleteRunScriptDialogProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
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
                  ランスクリプトを削除
                </Dialog.Title>

                <p className="text-sm text-gray-600 mb-6">
                  スクリプト「{scriptName}
                  」を削除しますか？この操作は元に戻せません。
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                  >
                    削除
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
