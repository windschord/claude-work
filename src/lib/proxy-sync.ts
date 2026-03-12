import { networkFilterService } from '@/services/network-filter-service';
import { ProxyClient } from '@/services/proxy-client';
import { AdapterFactory } from '@/services/adapter-factory';
import { logger } from '@/lib/logger';

/**
 * フィルタリングが有効で、アクティブなDockerセッションがある場合に
 * proxyにルールを再同期する。
 *
 * 同期の失敗はログ出力のみ（呼び出し元のAPIレスポンスには影響させない）。
 */
export async function syncProxyRulesIfNeeded(environmentId: string): Promise<void> {
  try {
    const filterEnabled = await networkFilterService.isFilterEnabled(environmentId);
    if (!filterEnabled) return;

    const adapter = AdapterFactory.getDockerAdapterForEnvironment(environmentId);
    if (!adapter) return;

    const containerIPs = adapter.getActiveContainerIPs();
    if (!containerIPs || containerIPs.length === 0) return;

    const proxyClient = new ProxyClient();

    for (const ip of containerIPs) {
      try {
        await proxyClient.syncRules(ip, environmentId);
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
