'use client';

import { Environment, EnvironmentType } from '@/hooks/useEnvironments';

interface EnvironmentCardProps {
  environment: Environment;
  onEdit: (environment: Environment) => void;
  onDelete: (environment: Environment) => void;
}

/**
 * 環境タイプの表示名を取得
 */
function getTypeDisplayName(type: EnvironmentType): string {
  switch (type) {
    case 'HOST':
      return 'ホスト';
    case 'DOCKER':
      return 'Docker';
    case 'SSH':
      return 'SSH';
    default:
      return type;
  }
}

/**
 * 環境タイプのバッジスタイルを取得
 */
function getTypeBadgeStyle(type: EnvironmentType): string {
  switch (type) {
    case 'HOST':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
    case 'DOCKER':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
    case 'SSH':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
  }
}

/**
 * Dockerイメージ情報をレンダリング
 */
function renderImageInfo(environment: Environment): React.ReactNode {
  if (environment.type !== 'DOCKER') return null;

  let config: Record<string, unknown> = {};
  try {
    config = typeof environment.config === 'string'
      ? JSON.parse(environment.config || '{}')
      : environment.config || {};
  } catch {
    // Invalid JSON - use empty config
    config = {};
  }

  if (config.imageSource === 'dockerfile') {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        <span className="font-medium">Dockerfile:</span>{' '}
        {config.dockerfileUploaded ? (
          <span className="text-green-600 dark:text-green-400">アップロード済み</span>
        ) : (
          <span className="text-yellow-600 dark:text-yellow-400">未アップロード</span>
        )}
      </div>
    );
  }

  const imageName = (config.imageName as string) || 'claude-code-sandboxed';
  const imageTag = (config.imageTag as string) || 'latest';
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
      <span className="font-medium">イメージ:</span>{' '}
      <span>{imageName}:{imageTag}</span>
    </div>
  );
}

/**
 * ステータスインジケータコンポーネント
 */
function StatusIndicator({ available, authenticated }: { available: boolean; authenticated: boolean }) {
  if (!available) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-sm text-red-600 dark:text-red-400">利用不可</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="text-sm text-yellow-600 dark:text-yellow-400">未認証</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      <span className="text-sm text-green-600 dark:text-green-400">利用可能</span>
    </div>
  );
}

/**
 * 環境カードコンポーネント
 *
 * 環境の情報を表示し、編集、削除のアクションを提供します。
 * デフォルト環境は削除ボタンが無効化されます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.environment - 表示する環境情報
 * @param props.onEdit - 環境を編集するときのコールバック関数
 * @param props.onDelete - 環境を削除するときのコールバック関数
 * @returns 環境カードのJSX要素
 */
export function EnvironmentCard({ environment, onEdit, onDelete }: EnvironmentCardProps) {
  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEdit(environment);
  };

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete(environment);
  };

  const status = environment.status;
  const available = status?.available ?? true;
  const authenticated = status?.authenticated ?? false;

  return (
    <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {environment.name}
          </h3>
          {environment.is_default && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 text-xs font-medium">
              デフォルト
            </span>
          )}
        </div>
        <span className={`${getTypeBadgeStyle(environment.type)} rounded-full px-2 py-1 text-xs font-medium`}>
          {getTypeDisplayName(environment.type)}
        </span>
      </div>

      {environment.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {environment.description}
        </p>
      )}

      {renderImageInfo(environment)}

      <div className="mb-4">
        <StatusIndicator available={available} authenticated={authenticated} />
        {status?.error && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{status.error}</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleEdit}
          className="flex-1 bg-gray-600 dark:bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
        >
          編集
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex-1 bg-red-600 dark:bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={environment.is_default}
          title={environment.is_default ? 'デフォルト環境は削除できません' : ''}
        >
          削除
        </button>
      </div>
    </div>
  );
}
