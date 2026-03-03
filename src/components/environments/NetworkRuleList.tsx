'use client';

import { Pencil, Trash2 } from 'lucide-react';
import type { NetworkFilterRule } from '@/db/schema';

interface NetworkRuleListProps {
  rules: NetworkFilterRule[];
  onEdit: (rule: NetworkFilterRule) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string, enabled: boolean) => void;
}

/**
 * ネットワークフィルタリングルール一覧コンポーネント
 *
 * ルールをテーブル形式で表示し、各行に有効/無効トグル・編集・削除ボタンを提供する。
 *
 * @param props.rules - 表示するルール一覧
 * @param props.onEdit - 編集ボタンクリック時のコールバック
 * @param props.onDelete - 削除ボタンクリック時のコールバック
 * @param props.onToggle - 有効/無効切り替え時のコールバック
 */
export function NetworkRuleList({ rules, onEdit, onDelete, onToggle }: NetworkRuleListProps) {
  if (rules.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        ルールが設定されていません。「ルールを追加」ボタンからルールを追加してください。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-600">
            <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
              ターゲット
            </th>
            <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
              ポート
            </th>
            <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
              説明
            </th>
            <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
              有効
            </th>
            <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr
              key={rule.id}
              className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <td className="py-2 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">
                {rule.target}
              </td>
              <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                {rule.port != null ? rule.port : '全て'}
              </td>
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                {rule.description || '-'}
              </td>
              <td className="py-2 pr-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => onToggle(rule.id, !rule.enabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    rule.enabled
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={rule.enabled ? '無効にする' : '有効にする'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      rule.enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </td>
              <td className="py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(rule)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors rounded"
                    aria-label="編集"
                    title="編集"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(rule.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                    aria-label="削除"
                    title="削除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
