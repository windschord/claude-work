'use client';

import { useState } from 'react';
import { Plus, ShieldCheck, FlaskConical, Loader2 } from 'lucide-react';
import type { NetworkFilterRule } from '@/db/schema';
import { useNetworkFilter } from '@/hooks/useNetworkFilter';
import { NetworkRuleList } from './NetworkRuleList';
import { NetworkRuleForm } from './NetworkRuleForm';
import { NetworkTemplateDialog } from './NetworkTemplateDialog';
import { NetworkTestDialog } from './NetworkTestDialog';
import type { CreateRuleInput } from '@/hooks/useNetworkFilter';
import type { EnvironmentType } from '@/hooks/useEnvironments';

interface NetworkFilterSectionProps {
  environmentId: string;
  environmentType: EnvironmentType;
}

/**
 * ネットワークフィルタリング設定セクション
 *
 * 環境設定ページに統合されるネットワークフィルタリングセクション。
 * Docker環境の場合のみ表示される。
 *
 * 機能:
 * - フィルタリングの有効/無効トグル
 * - ルール一覧の表示
 * - ルール追加/編集/削除
 * - テンプレート適用ダイアログ（NetworkTemplateDialog）
 * - 通信テストダイアログ（NetworkTestDialog）
 *
 * @param props.environmentId - 環境ID
 * @param props.environmentType - 環境タイプ（DOCKER の場合のみ表示）
 */
export function NetworkFilterSection({ environmentId, environmentType }: NetworkFilterSectionProps) {
  // Docker環境の場合のみ表示
  if (environmentType !== 'DOCKER') {
    return null;
  }

  return <NetworkFilterSectionInner environmentId={environmentId} />;
}

interface NetworkFilterSectionInnerProps {
  environmentId: string;
}

function NetworkFilterSectionInner({ environmentId }: NetworkFilterSectionInnerProps) {
  const {
    rules,
    filterConfig,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    toggleFilter,
    refresh,
  } = useNetworkFilter(environmentId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NetworkFilterRule | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);

  const handleAddRule = () => {
    setEditingRule(null);
    setIsFormOpen(true);
  };

  const handleEditRule = (rule: NetworkFilterRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingRule(null);
  };

  const handleFormSubmit = async (data: CreateRuleInput) => {
    if (editingRule) {
      await updateRule(editingRule.id, data);
    } else {
      await createRule(data);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    await deleteRule(ruleId);
  };

  const handleToggleFilter = async () => {
    const currentEnabled = filterConfig?.enabled ?? false;
    await toggleFilter(!currentEnabled);
  };

  const isFilterEnabled = filterConfig?.enabled ?? false;

  return (
    <div className="mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            ネットワークフィルタリング
          </h4>
        </div>

        {/* フィルタリング有効/無効トグル */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isFilterEnabled ? '有効' : '無効'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isFilterEnabled}
            onClick={handleToggleFilter}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isFilterEnabled
                ? 'bg-blue-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
            aria-label={isFilterEnabled ? 'フィルタリングを無効にする' : 'フィルタリングを有効にする'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isFilterEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 説明テキスト */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        有効にすると、ホワイトリストに登録されたホストのみ通信を許可します。
        無効の場合はすべての通信が許可されます。
      </p>

      {/* ローディング表示 */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">読み込み中...</span>
        </div>
      )}

      {/* エラー表示 */}
      {error && !isLoading && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ルール一覧 */}
      {!isLoading && !error && (
        <>
          <NetworkRuleList
            rules={rules}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onToggle={toggleRule}
          />

          {/* アクションボタン行 */}
          <div className="mt-4 flex items-center gap-3">
            {/* ルール追加ボタン */}
            <button
              type="button"
              onClick={handleAddRule}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <Plus className="h-4 w-4" />
              ルールを追加
            </button>

            {/* テンプレート適用ボタン */}
            <button
              type="button"
              onClick={() => setIsTemplateDialogOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              テンプレートを適用
            </button>

            {/* 通信テストボタン */}
            <button
              type="button"
              onClick={() => setIsTestDialogOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <FlaskConical className="h-4 w-4" />
              通信テスト
            </button>
          </div>
        </>
      )}

      {/* ルール追加/編集フォームモーダル */}
      <NetworkRuleForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={editingRule}
      />

      {/* テンプレート適用ダイアログ */}
      <NetworkTemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        environmentId={environmentId}
        onApplied={async () => {
          await refresh();
          setIsTemplateDialogOpen(false);
        }}
      />

      {/* 通信テストダイアログ */}
      <NetworkTestDialog
        isOpen={isTestDialogOpen}
        onClose={() => setIsTestDialogOpen(false)}
        environmentId={environmentId}
      />
    </div>
  );
}
