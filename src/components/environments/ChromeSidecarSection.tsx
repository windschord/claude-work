'use client';

interface ChromeSidecarSectionProps {
  enabled: boolean;
  image: string;
  tag: string;
  onEnabledChange: (enabled: boolean) => void;
  onImageChange: (image: string) => void;
  onTagChange: (tag: string) => void;
  disabled?: boolean;
}

/**
 * Chrome Sidecar設定セクション
 *
 * Docker環境設定内に組み込むChrome Sidecarの有効/無効切り替え、
 * イメージ名・タグのカスタマイズUI。
 */
export function ChromeSidecarSection({
  enabled,
  image,
  tag,
  onEnabledChange,
  onImageChange,
  onTagChange,
  disabled = false,
}: ChromeSidecarSectionProps) {
  const tagError = enabled && tag.trim().toLowerCase() === 'latest'
    ? '再現性のためバージョンを固定してください（latestは使用できません）'
    : null;

  return (
    <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Chrome Sidecar
        </h5>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            role="checkbox"
            aria-label="Chrome Sidecar を有効にする"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        セッション起動時にChrome DevTools MCPサーバー用のヘッドレスChromeコンテナを自動起動します
      </p>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="chrome-sidecar-image"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Chrome Image
          </label>
          <input
            id="chrome-sidecar-image"
            type="text"
            value={image}
            onChange={(e) => onImageChange(e.target.value)}
            placeholder="chromium/headless-shell"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={disabled || !enabled}
          />
        </div>

        <div>
          <label
            htmlFor="chrome-sidecar-tag"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Chrome Tag
          </label>
          <input
            id="chrome-sidecar-tag"
            type="text"
            value={tag}
            onChange={(e) => onTagChange(e.target.value)}
            placeholder="131.0.6778.204"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              tagError
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            disabled={disabled || !enabled}
          />
          {tagError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{tagError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
