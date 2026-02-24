'use client';

interface EnvironmentBadgeProps {
  type: string;
  name: string;
}

const badgeColorMap: Record<string, string> = {
  DOCKER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  HOST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  SSH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const defaultBadgeColor = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

/**
 * 環境バッジコンポーネント（共通）
 *
 * 環境タイプとラベルを表示するシンプルなバッジです。
 * プロジェクト設定画面など、純粋な表示のみが必要な場合に使用します。
 */
export function EnvironmentBadge({ type, name }: EnvironmentBadgeProps) {
  const colorClass = badgeColorMap[type] || defaultBadgeColor;

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {type}
      </span>
      <span className="text-sm text-gray-900 dark:text-gray-100">
        {name}
      </span>
    </div>
  );
}
