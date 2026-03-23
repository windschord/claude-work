'use client';

interface ChromeBadgeProps {
  chromeContainerId: string | null;
}

/**
 * Chrome サイドカーバッジ
 *
 * セッションリストで表示される。
 * chrome_container_id が存在する場合のみ表示。
 * オレンジ色のバッジ。
 */
export function ChromeBadge({ chromeContainerId }: ChromeBadgeProps) {
  if (!chromeContainerId) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
      Chrome
    </span>
  );
}
