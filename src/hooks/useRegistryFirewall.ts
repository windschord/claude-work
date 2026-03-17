'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface RegistryFirewallHealth {
  status: 'healthy' | 'unhealthy' | 'stopped';
  registries?: string[];
}

export interface RegistryFirewallBlock {
  timestamp: string;
  package_name: string;
  registry: string;
  reason: string;
  severity?: string;
}

interface RegistryFirewallState {
  health: RegistryFirewallHealth | null;
  blocks: RegistryFirewallBlock[];
  enabled: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseRegistryFirewallReturn extends RegistryFirewallState {
  toggleEnabled: (enabled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Registry Firewall状態管理フック
 *
 * registry-firewallのヘルス・ブロックログ・有効/無効設定を管理する。
 *
 * @returns health/blocks/enabled状態と操作関数
 */
export function useRegistryFirewall(): UseRegistryFirewallReturn {
  const [health, setHealth] = useState<RegistryFirewallHealth | null>(null);
  const [blocks, setBlocks] = useState<RegistryFirewallBlock[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * ヘルス・ブロックログ・設定を並列取得して状態を更新する。
   * useRefで保持し、useEffectからはref経由で呼び出す（依存配列を安全に保つため）。
   * AbortSignalを受け取り、アンマウント後のsetStateを防止する。
   */
  const fetchAllRef = useRef(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [healthRes, blocksRes, configRes] = await Promise.all([
        fetch('/api/registry-firewall/health', { signal }),
        fetch('/api/registry-firewall/blocks?limit=10', { signal }),
        fetch('/api/settings/config', { signal }),
      ]);

      // abort済みの場合はsetStateしない
      if (signal?.aborted) return;

      // ヘルス
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData as RegistryFirewallHealth);
      } else {
        setHealth({ status: 'stopped' });
      }

      // ブロックログ
      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        setBlocks(
          Array.isArray(blocksData.blocks)
            ? (blocksData.blocks as RegistryFirewallBlock[])
            : []
        );
      } else {
        setBlocks([]);
      }

      // 設定(有効/無効)
      if (configRes.ok) {
        const configData = await configRes.json();
        const registryFirewallEnabled = configData?.config?.registry_firewall_enabled;
        setEnabled(registryFirewallEnabled !== false);
      }
    } catch (err) {
      // AbortErrorはアンマウントによるキャンセルなので無視する
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (signal?.aborted) return;
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(errorMessage);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  });

  // マウント時にデータを取得し、アンマウント時にabortする
  useEffect(() => {
    const controller = new AbortController();
    fetchAllRef.current(controller.signal);
    return () => controller.abort();
  }, []);

  /**
   * registry_firewall_enabledの有効/無効を切り替える
   */
  const toggleEnabled = useCallback(async (nextEnabled: boolean): Promise<void> => {
    const response = await fetch('/api/settings/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry_firewall_enabled: nextEnabled }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || '設定の更新に失敗しました');
    }

    setEnabled(nextEnabled);
  }, []);

  /**
   * データを再取得する
   */
  const refetch = useCallback(async (): Promise<void> => {
    await fetchAllRef.current();
  }, []);

  return {
    health,
    blocks,
    enabled,
    isLoading,
    error,
    toggleEnabled,
    refetch,
  };
}
