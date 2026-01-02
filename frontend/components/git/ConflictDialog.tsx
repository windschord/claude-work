'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useGitOpsStore } from '@/store/gitOps';

export default function ConflictDialog() {
  const { conflictFiles, clearConflict } = useGitOpsStore();

  const isOpen = conflictFiles !== null && conflictFiles.length > 0;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={clearConflict}>
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
                  className="text-lg font-medium leading-6 text-red-600"
                >
                  コンフリクトが発生しました
                </Dialog.Title>
                <div className="mt-4">
                  <p className="text-sm text-gray-700 mb-3">
                    以下のファイルでコンフリクトが発生しました。手動で解決してください。
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-64 overflow-y-auto">
                    <ul className="space-y-1">
                      {conflictFiles?.map((file, index) => (
                        <li key={index} className="text-sm text-red-800 font-mono">
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={clearConflict}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600"
                  >
                    OK
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
