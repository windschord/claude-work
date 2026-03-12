import { networkFilterService } from '@/services/network-filter-service';
import { ProxyClient, type ProxyRuleEntry } from '@/services/proxy-client';
import { logger } from '@/lib/logger';

/**
 * 環境のルールをDBから取得し、proxy API形式に変換してsetRulesを呼び出す。
 *
 * ルール取得・変換の責務をProxyClient（純粋なHTTPクライアント）から分離し、
 * このヘルパーに集約する。
 *
 * @param proxyClient - ProxyClientインスタンス
 * @param sourceIP - コンテナの送信元IPアドレス
 * @param environmentId - 環境ID
 */
export async function syncRulesForContainer(
  proxyClient: ProxyClient,
  sourceIP: string,
  environmentId: string,
): Promise<void> {
  const allRules = await networkFilterService.getRules(environmentId);

  const enabledRules = allRules.filter((rule) => rule.enabled === true);

  const entries: ProxyRuleEntry[] = enabledRules.map((rule) => {
    const entry: ProxyRuleEntry = { host: rule.target };
    if (rule.port !== null && rule.port !== undefined) {
      entry.port = rule.port;
    }
    return entry;
  });

  logger.info('proxyにルールを同期中', {
    sourceIP,
    environmentId,
    ruleCount: entries.length,
  });

  await proxyClient.setRules(sourceIP, entries);

  logger.info('proxyへのルール同期が完了しました', {
    sourceIP,
    environmentId,
    ruleCount: entries.length,
  });
}

/**
 * フィルタリングが有効で、アクティブなDockerセッションがある場合に
 * proxyにルールを再同期する。
 *
 * 同期の失敗はログ出力のみ（呼び出し元のAPIレスポンスには影響させない）。
 *
 * AdapterFactoryはdynamic importで遅延ロードする。
 * 静的importするとnode-pty依存がNext.jsビルド時に解決されてしまい、
 * API routeのビルドが失敗するため。
 */
export async function syncProxyRulesIfNeeded(environmentId: string): Promise<void> {
  try {
    const filterEnabled = await networkFilterService.isFilterEnabled(environmentId);
    if (!filterEnabled) return;

    // Dynamic import to avoid node-pty dependency at build time
    const { AdapterFactory } = await import('@/services/adapter-factory');
    const adapter = AdapterFactory.getDockerAdapterForEnvironment(environmentId);
    if (!adapter) return;

    const containerIPs = adapter.getActiveContainerIPs();
    if (!containerIPs || containerIPs.length === 0) return;

    const proxyClient = new ProxyClient();

    for (const ip of containerIPs) {
      try {
        await syncRulesForContainer(proxyClient, ip, environmentId);
        logger.info('Proxy rules synced for container', { environmentId, containerIP: ip });
      } catch (error) {
        logger.warn('Failed to sync proxy rules for container', {
          environmentId,
          containerIP: ip,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to sync proxy rules', {
      environmentId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}
