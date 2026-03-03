'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Info } from 'lucide-react';
import type { NetworkFilterRule } from '@/db/schema';
import type { CreateRuleInput } from '@/hooks/useNetworkFilter';

interface NetworkRuleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRuleInput) => Promise<void>;
  initialData?: NetworkFilterRule | null;
}

/**
 * ターゲット文字列がワイルドカードを含むかを判定する
 */
function isWildcard(target: string): boolean {
  return target.startsWith('*.');
}

/**
 * ターゲットの簡易バリデーション
 * 空文字チェックのみ（詳細バリデーションはサーバー側で実施）
 */
function validateTarget(target: string): string | null {
  if (!target.trim()) {
    return 'ターゲットを入力してください';
  }
  return null;
}

/**
 * ポートの簡易バリデーション
 */
function validatePort(portStr: string): string | null {
  if (!portStr) return null;
  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'ポートは1〜65535の整数で指定してください';
  }
  return null;
}

/**
 * ネットワークルール追加・編集フォームモーダル
 *
 * Headless UI Dialog を使用したモーダル形式のフォーム。
 * ターゲット、ポート、説明の入力・バリデーションを行う。
 * ワイルドカード入力時にヘルプテキストを表示する。
 *
 * @param props.isOpen - モーダルの開閉状態
 * @param props.onClose - モーダルを閉じるコールバック
 * @param props.onSubmit - フォーム送信コールバック（作成/更新データ）
 * @param props.initialData - 編集時の初期データ
 */
export function NetworkRuleForm({ isOpen, onClose, onSubmit, initialData }: NetworkRuleFormProps) {
  const [target, setTarget] = useState('');
  const [portStr, setPortStr] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isEditMode = !!initialData;

  // 初期データを反映
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTarget(initialData.target);
        setPortStr(initialData.port != null ? String(initialData.port) : '');
        setDescription(initialData.description ?? '');
      } else {
        setTarget('');
        setPortStr('');
        setDescription('');
      }
      setError('');
    }
  }, [isOpen, initialData?.target, initialData?.port, initialData?.description]); // eslint-disable-line react-hooks/exhaustive-deps
  // CLAUDE.mdガイドライン準拠: initialDataオブジェクトではなくprimitiveプロパティのみを依存配列に含める

  const handleClose = () => {
    setTarget('');
    setPortStr('');
    setDescription('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    const targetError = validateTarget(target);
    if (targetError) {
      setError(targetError);
      return;
    }

    const portError = validatePort(portStr);
    if (portError) {
      setError(portError);
      return;
    }

    const descError = description.length > 200 ? '説明は200文字以内で入力してください' : null;
    if (descError) {
      setError(descError);
      return;
    }

    setIsLoading(true);

    try {
      const data: CreateRuleInput = {
        target: target.trim(),
        port: portStr ? Number(portStr) : null,
        description: description.trim() || undefined,
      };

      await onSubmit(data);
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const showWildcardHelp = isWildcard(target);
  const baseDomain = target.startsWith('*.') ? target.slice(2) : '';

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
                  {isEditMode ? 'ルールを編集' : 'ルールを追加'}
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  {/* ターゲット入力 */}
                  <div className="mb-4">
                    <label
                      htmlFor="rule-target"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      ターゲット
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      id="rule-target"
                      type="text"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="api.anthropic.com, *.github.com, 10.0.0.0/8"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      ドメイン名、IPアドレス、ワイルドカード（*.example.com）、CIDR（10.0.0.0/8）形式で入力
                    </p>

                    {/* ワイルドカード入力時のヘルプテキスト */}
                    {showWildcardHelp && baseDomain && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {baseDomain} の全てのサブドメインにマッチします
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ポート入力 */}
                  <div className="mb-4">
                    <label
                      htmlFor="rule-port"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      ポート
                      <span className="text-gray-400 ml-1 font-normal">（任意）</span>
                    </label>
                    <input
                      id="rule-port"
                      type="number"
                      value={portStr}
                      onChange={(e) => setPortStr(e.target.value)}
                      placeholder="443"
                      min={1}
                      max={65535}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      空白の場合は全ポートを許可します
                    </p>
                  </div>

                  {/* 説明入力 */}
                  <div className="mb-4">
                    <label
                      htmlFor="rule-description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      説明
                      <span className="text-gray-400 ml-1 font-normal">（任意）</span>
                    </label>
                    <input
                      id="rule-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="例: Claude APIへのアクセス"
                      maxLength={200}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={isLoading}
                    />
                    {description.length > 180 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {description.length}/200文字
                      </p>
                    )}
                  </div>

                  {/* エラー表示 */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {/* ボタン */}
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
                      disabled={!target.trim() || isLoading}
                    >
                      {isLoading
                        ? isEditMode ? '更新中...' : '追加中...'
                        : isEditMode ? '更新' : '追加'}
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
