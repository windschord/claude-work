'use client';

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface TemplateRule {
  target: string;
  port: number;
  description: string;
}

interface DefaultTemplate {
  category: string;
  rules: TemplateRule[];
}

interface ApplyResult {
  created: number;
  skipped: number;
  rules: unknown[];
}

interface NetworkTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  environmentId: string;
  onApplied: () => Promise<void>;
}

/**
 * デフォルトテンプレート適用ダイアログコンポーネント
 *
 * カテゴリ別にルールテンプレートを表示し、選択したルールを一括適用する。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.isOpen - ダイアログの開閉状態
 * @param props.onClose - ダイアログを閉じるときのコールバック関数
 * @param props.environmentId - 対象環境のID
 * @param props.onApplied - テンプレート適用後のコールバック関数
 * @returns テンプレート適用ダイアログのJSX要素
 */
export function NetworkTemplateDialog({
  isOpen,
  onClose,
  environmentId,
  onApplied,
}: NetworkTemplateDialogProps) {
  const [templates, setTemplates] = useState<DefaultTemplate[]>([]);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  // テンプレート一覧を取得するキーを生成する関数
  const getRuleKey = (template: DefaultTemplate, rule: TemplateRule) =>
    `${template.category}::${rule.target}::${rule.port}`;

  // ダイアログが開いたときにテンプレート一覧を取得する
  useEffect(() => {
    if (!isOpen) return;

    setApplyResult(null);
    setError('');

    const fetchTemplates = async () => {
      setIsFetching(true);
      try {
        const response = await fetch(
          `/api/environments/${environmentId}/network-rules/templates`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'テンプレートの取得に失敗しました');
        }
        const fetched: DefaultTemplate[] = data.templates;
        setTemplates(fetched);

        // 初期状態：全ルールを選択済みにする
        const allKeys = new Set<string>();
        fetched.forEach(template => {
          template.rules.forEach(rule => {
            allKeys.add(getRuleKey(template, rule));
          });
        });
        setSelectedRules(allKeys);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'テンプレートの取得に失敗しました');
      } finally {
        setIsFetching(false);
      }
    };

    fetchTemplates();
  }, [isOpen, environmentId]);

  // チェックボックスの切り替え
  const toggleRule = (key: string) => {
    setSelectedRules(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 全選択
  const selectAll = () => {
    const allKeys = new Set<string>();
    templates.forEach(template => {
      template.rules.forEach(rule => {
        allKeys.add(getRuleKey(template, rule));
      });
    });
    setSelectedRules(allKeys);
  };

  // 全解除
  const deselectAll = () => {
    setSelectedRules(new Set());
  };

  // テンプレートを適用する
  const handleApply = async () => {
    if (selectedRules.size === 0) return;

    setError('');
    setIsLoading(true);
    setApplyResult(null);

    // 選択されたルールを収集する
    const rulesToApply: TemplateRule[] = [];
    templates.forEach(template => {
      template.rules.forEach(rule => {
        if (selectedRules.has(getRuleKey(template, rule))) {
          rulesToApply.push(rule);
        }
      });
    });

    try {
      const response = await fetch(
        `/api/environments/${environmentId}/network-rules/templates/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules: rulesToApply.map(r => ({
              target: r.target,
              port: r.port,
              description: r.description,
            })),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'テンプレートの適用に失敗しました');
      }
      setApplyResult(data);
      await onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'テンプレートの適用に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setApplyResult(null);
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  デフォルトテンプレートを適用
                </Dialog.Title>

                {isFetching ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      テンプレートを読み込み中...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 全選択/全解除ボタン */}
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        disabled={isLoading}
                      >
                        全選択
                      </button>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        disabled={isLoading}
                      >
                        全解除
                      </button>
                    </div>

                    {/* テンプレート一覧 */}
                    <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                      {templates.map(template => (
                        <div key={template.category}>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {template.category}
                          </h4>
                          <div className="space-y-1 pl-2">
                            {template.rules.map(rule => {
                              const key = getRuleKey(template, rule);
                              return (
                                <label
                                  key={key}
                                  className="flex items-center gap-3 cursor-pointer py-1"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRules.has(key)}
                                    onChange={() => toggleRule(key)}
                                    disabled={isLoading}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                      {rule.target}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                      :{rule.port}
                                    </span>
                                    {rule.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {rule.description}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* エラー表示 */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* 適用結果表示 */}
                {applyResult && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <span className="font-medium">{applyResult.created}件追加</span>
                      {applyResult.skipped > 0 && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          （{applyResult.skipped}件スキップ）
                        </span>
                      )}
                    </p>
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
                    type="button"
                    onClick={handleApply}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || selectedRules.size === 0 || isFetching}
                  >
                    {isLoading ? '適用中...' : '適用'}
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
