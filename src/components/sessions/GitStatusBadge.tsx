'use client';

import { Check, AlertCircle } from 'lucide-react';

interface GitStatusBadgeProps {
  status: 'clean' | 'dirty';
}

/**
 * Gitステータスバッジコンポーネント
 *
 * セッションのGit状態を視覚的に表示するバッジです。
 * クリーン状態と未コミット変更がある状態を色とアイコンで区別します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.status - Gitステータス ('clean' または 'dirty')
 * @returns GitステータスバッジのJSX要素
 */
export function GitStatusBadge({ status }: GitStatusBadgeProps) {
  if (status === 'clean') {
    return (
      <span
        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-green-100 text-green-800"
        data-testid="git-status-badge-clean"
      >
        <Check className="w-3 h-3" data-testid="git-status-icon-clean" />
        <span>クリーン</span>
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-yellow-100 text-yellow-800"
      data-testid="git-status-badge-dirty"
    >
      <AlertCircle className="w-3 h-3" data-testid="git-status-icon-dirty" />
      <span>未コミット変更あり</span>
    </span>
  );
}
