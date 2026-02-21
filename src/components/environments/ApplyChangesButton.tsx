'use client';

import { useState, useEffect, Fragment, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { RefreshCw, Loader2 } from 'lucide-react';

interface ApplyChangesButtonProps {
  environmentId: string;
  onApplied?: () => void;
}

interface SessionInfo {
  id: string;
  name: string;
}

interface ApplyResult {
  applied: number;
  failed: number;
  sessions: Array<{ id: string; name: string; status: string }>;
}

type ComponentState = 'loading' | 'ready' | 'dialog' | 'applying' | 'result';

/**
 * 環境設定の即時適用ボタンコンポーネント
 *
 * 実行中のセッションに対して、環境設定の変更を即時適用するためのボタンと
 * 確認ダイアログを提供します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.environmentId - 対象の環境ID
 * @param props.onApplied - 適用完了時のコールバック関数
 * @returns 即時適用ボタンのJSX要素
 */
export function ApplyChangesButton({
  environmentId,
  onApplied,
}: ApplyChangesButtonProps) {
  const [state, setState] = useState<ComponentState>('loading');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/environments/${environmentId}/sessions`,
        { method: 'GET' }
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } finally {
      setState('ready');
    }
  }, [environmentId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleOpenDialog = () => {
    setState('dialog');
  };

  const handleCloseDialog = () => {
    setState('ready');
    setApplyResult(null);
  };

  const handleApply = async () => {
    setState('applying');
    try {
      const response = await fetch(
        `/api/environments/${environmentId}/apply`,
        { method: 'POST' }
      );
      if (response.ok) {
        const result: ApplyResult = await response.json();
        setApplyResult(result);
        setState('result');
        if (result.failed === 0) {
          onApplied?.();
        }
      } else {
        setState('dialog');
      }
    } catch {
      setState('dialog');
    }
  };

  const isDialogOpen = state === 'dialog' || state === 'applying' || state === 'result';

  if (state === 'loading') {
    return null;
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        実行中のセッションはありません
      </p>
    );
  }

  return (
    <>
      {!isDialogOpen && (
        <button
          type="button"
          onClick={handleOpenDialog}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          今すぐ適用
          <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 text-xs font-bold text-blue-600 bg-white rounded-full">
            {sessions.length}
          </span>
        </button>
      )}

      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={handleCloseDialog}>
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
                    設定変更の適用
                  </Dialog.Title>

                  {state !== 'result' && (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        以下のセッションに設定変更を適用します:
                      </p>

                      <ul className="mb-4 space-y-1">
                        {sessions.map((session) => (
                          <li
                            key={session.id}
                            className="text-sm text-gray-700 dark:text-gray-300 pl-4"
                          >
                            {session.name}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {applyResult && (
                    <div className="mb-4 p-3 rounded-md bg-gray-50 dark:bg-gray-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {applyResult.applied} 件のセッションに適用しました
                      </p>
                      {applyResult.failed > 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          失敗: {applyResult.failed} 件
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleCloseDialog}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={state === 'result' ? handleCloseDialog : handleApply}
                      disabled={state === 'applying'}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {state === 'applying' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      適用する
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
