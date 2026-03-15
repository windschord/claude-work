'use client';

import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { useRegistryFirewall } from '@/hooks/useRegistryFirewall';

const SUPPORTED_REGISTRIES = ['npm', 'PyPI', 'Go', 'Cargo', 'Docker'];

/**
 * Registry Firewallのステータスカラーとラベルを返す
 */
function getStatusIndicator(status: 'healthy' | 'unhealthy' | 'stopped' | undefined) {
  switch (status) {
    case 'healthy':
      return { color: 'bg-green-500', label: '正常' };
    case 'unhealthy':
      return { color: 'bg-red-500', label: '異常' };
    case 'stopped':
    default:
      return { color: 'bg-gray-400', label: '停止中' };
  }
}

/**
 * パッケージセキュリティ(Registry Firewall)ステータスコンポーネント
 *
 * 環境設定ページに表示する「パッケージセキュリティ」セクション。
 * Registry Firewallのヘルスステータス・有効/無効トグル・ブロックログを表示する。
 */
export function RegistryFirewallStatus() {
  const { health, blocks, enabled, isLoading, error, toggleEnabled } = useRegistryFirewall();

  const { color: statusColor, label: statusLabel } = getStatusIndicator(health?.status);

  const handleToggle = async () => {
    try {
      await toggleEnabled(!enabled);
    } catch {
      // エラーは無視（UIでエラー表示しない - 操作失敗はトースト通知が適切だが、今回は簡易実装）
    }
  };

  return (
    <div className="p-6 pb-0">
      <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
        {/* セクションヘッダー */}
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            パッケージセキュリティ
          </h2>
        </div>

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

        {!isLoading && (
          <>
            {/* Registry Firewallヘッダー行 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Registry Firewall
                </span>
                {/* ステータスインジケーター */}
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{statusLabel}</span>
                </div>
              </div>

              {/* 有効/無効トグル */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {enabled ? '有効' : '無効'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={handleToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    enabled
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={enabled ? 'Registry Firewallを無効にする' : 'Registry Firewallを有効にする'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 対応レジストリ一覧 */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-gray-500 dark:text-gray-400">対応レジストリ:</span>
              {SUPPORTED_REGISTRIES.map((registry) => (
                <span
                  key={registry}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {registry}
                </span>
              ))}
            </div>

            {/* 管理画面リンク */}
            <div className="mb-4">
              <a
                href="/api/registry-firewall/ui/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                管理画面を開く
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* ブロックログ */}
            <div>
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                最近のブロックログ
              </h3>
              {blocks.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  ブロックログはありません
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        <th className="pb-1 pr-3 font-medium">日時</th>
                        <th className="pb-1 pr-3 font-medium">パッケージ名</th>
                        <th className="pb-1 pr-3 font-medium">レジストリ</th>
                        <th className="pb-1 font-medium">理由</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((block, index) => (
                        <tr
                          key={index}
                          className="text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <td className="py-1 pr-3 whitespace-nowrap">
                            {new Date(block.timestamp).toLocaleString('ja-JP', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-1 pr-3 max-w-[120px] truncate">
                            {block.package_name}
                          </td>
                          <td className="py-1 pr-3">{block.registry}</td>
                          <td className="py-1 text-gray-500 dark:text-gray-400">{block.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2">
                    <a
                      href="/api/registry-firewall/ui/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      全てのログを見る
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
