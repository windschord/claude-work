'use client';

interface ChromeDebugInfoProps {
  chromeContainerId: string | null;
  chromeDebugPort: number | null;
}

/**
 * Chrome DevTools デバッグ情報セクション
 *
 * セッション詳細画面に表示される。
 * chrome_container_id が存在する場合のみ表示。
 */
export function ChromeDebugInfo({ chromeContainerId, chromeDebugPort }: ChromeDebugInfoProps) {
  if (!chromeContainerId) {
    return null;
  }

  return (
    <div className="p-3 border border-orange-200 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/20">
      <h5 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
        Chrome DevTools Debug
      </h5>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-orange-600 dark:text-orange-300">Status:</span>
          <span className="text-orange-800 dark:text-orange-100">
            {chromeDebugPort
              ? 'Running'
              : 'Running (debug port unavailable)'}
          </span>
        </div>
        {chromeDebugPort && (
          <div className="flex items-center gap-2">
            <span className="text-orange-600 dark:text-orange-300">Debug URL:</span>
            <code className="text-xs bg-orange-100 dark:bg-orange-800/50 px-1.5 py-0.5 rounded text-orange-800 dark:text-orange-100">
              localhost:{chromeDebugPort}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
