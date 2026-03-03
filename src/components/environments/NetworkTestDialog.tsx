'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface MatchedRule {
  id: string;
  target: string;
  port: number | null;
  description?: string;
}

interface TestResult {
  allowed: boolean;
  matchedRule?: MatchedRule;
}

interface NetworkTestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  environmentId: string;
}

/**
 * 通信テスト（dry-run）ダイアログコンポーネント
 *
 * 指定した宛先への通信が許可/ブロックされるかをdry-runで確認する。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.onClose - ダイアログを閉じるときのコールバック関数
 * @param props.environmentId - 対象環境のID
 * @returns 通信テストダイアログのJSX要素
 */
export function NetworkTestDialog({
  isOpen,
  onClose,
  environmentId,
}: NetworkTestDialogProps) {
  const [target, setTarget] = useState('');
  const [port, setPort] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!target.trim()) return;

    setError('');
    setIsLoading(true);
    setTestResult(null);

    const body: { target: string; port?: number } = { target: target.trim() };
    if (port.trim()) {
      const portNumber = parseInt(port.trim(), 10);
      if (!isNaN(portNumber)) {
        body.port = portNumber;
      }
    }

    try {
      const response = await fetch(
        `/api/environments/${environmentId}/network-filter/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '通信テストに失敗しました');
      }
      setTestResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信テストに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTarget('');
    setPort('');
    setError('');
    setTestResult(null);
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  通信テスト
                </Dialog.Title>

                <div className="mb-4">
                  <label
                    htmlFor="network-test-target"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    ドメイン / IPアドレス
                  </label>
                  <input
                    id="network-test-target"
                    type="text"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder="example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={isLoading}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleTest();
                    }}
                  />
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="network-test-port"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    ポート番号（任意）
                  </label>
                  <input
                    id="network-test-port"
                    type="number"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    placeholder="443"
                    min={1}
                    max={65535}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={isLoading}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleTest();
                    }}
                  />
                </div>

                {/* エラー表示 */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* テスト結果表示 */}
                {testResult && (
                  <div
                    className={`mb-4 p-3 rounded-md border ${
                      testResult.allowed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        testResult.allowed
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {testResult.allowed ? 'Allowed' : 'Blocked'}
                    </p>
                    {testResult.allowed && testResult.matchedRule && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                        <p className="font-mono">{testResult.matchedRule.target}</p>
                        {testResult.matchedRule.description && (
                          <p className="mt-0.5">{testResult.matchedRule.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ボタン */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    閉じる
                  </button>
                  <button
                    type="button"
                    onClick={handleTest}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || !target.trim()}
                  >
                    {isLoading ? 'テスト中...' : 'テスト実行'}
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
