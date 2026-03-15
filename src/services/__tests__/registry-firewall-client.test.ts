import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  RegistryFirewallClient,
  getRegistryFirewallClient,
  type RegistryFirewallHealthResponse,
  type BlockLogsResponse,
} from '@/services/registry-firewall-client';

describe('RegistryFirewallClient', () => {
  let client: RegistryFirewallClient;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
    // シングルトンをリセットするためにモジュールをリセット
    client = new RegistryFirewallClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // ==================== getHealth ====================

  describe('getHealth', () => {
    it('正常応答をRegistryFirewallHealthResponseとして返す', async () => {
      const mockResponse: RegistryFirewallHealthResponse = {
        status: 'healthy',
        registries: ['npm', 'pypi', 'rubygems'],
        version: '1.0.0',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.getHealth();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it('タイムアウト時に { status: "stopped" } を返す（例外をスローしない）', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      vi.mocked(fetch).mockRejectedValueOnce(abortError);

      const result = await client.getHealth();

      expect(result).toEqual({ status: 'stopped' });
    });

    it('ネットワークエラー時に { status: "stopped" } を返す（例外をスローしない）', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await client.getHealth();

      expect(result).toEqual({ status: 'stopped' });
    });

    it('HTTP 500エラー時に { status: "stopped" } を返す', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      const result = await client.getHealth();

      expect(result).toEqual({ status: 'stopped' });
    });

    it('HTTP 401エラー時に { status: "unhealthy" } を返す', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const result = await client.getHealth();

      expect(result.status).toBe('unhealthy');
    });
  });

  // ==================== getBlocks ====================

  describe('getBlocks', () => {
    it('正常応答をBlockLogsResponseとして返す', async () => {
      const mockResponse: BlockLogsResponse = {
        blocks: [
          {
            timestamp: '2026-01-01T00:00:00Z',
            package_name: 'malicious-package',
            registry: 'npm',
            reason: 'Suspicious activity',
            severity: 'high',
          },
        ],
        total: 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.getBlocks();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/blocks'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it('limitパラメータをクエリ文字列に付与する', async () => {
      const mockResponse: BlockLogsResponse = { blocks: [], total: 0 };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await client.getBlocks(50);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
    });

    it('エラー時に空のBlockLogsResponseを返す', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await client.getBlocks();

      expect(result).toEqual({ blocks: [], total: 0 });
    });

    it('HTTP 500エラー時に空のBlockLogsResponseを返す', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      const result = await client.getBlocks();

      expect(result).toEqual({ blocks: [], total: 0 });
    });
  });

  // ==================== 認証ヘッダー ====================

  describe('認証', () => {
    it('REGISTRY_FIREWALL_API_TOKEN設定時にAuthorizationヘッダーを付与する', async () => {
      vi.stubEnv('REGISTRY_FIREWALL_API_TOKEN', 'test-token-123');
      const clientWithToken = new RegistryFirewallClient();

      const mockResponse: RegistryFirewallHealthResponse = {
        status: 'healthy',
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await clientWithToken.getHealth();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('REGISTRY_FIREWALL_API_TOKEN未設定時にAuthorizationヘッダーを付与しない', async () => {
      vi.stubEnv('REGISTRY_FIREWALL_API_TOKEN', '');
      const clientWithoutToken = new RegistryFirewallClient();

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'healthy' }), { status: 200 })
      );

      await clientWithoutToken.getHealth();

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const options = callArgs[1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  // ==================== シングルトン ====================

  describe('getRegistryFirewallClient', () => {
    it('同じインスタンスを返す', async () => {
      // モジュール再読み込みを避けるため動的インポートを使用
      const { getRegistryFirewallClient: getFn } = await import('@/services/registry-firewall-client');
      const instance1 = getFn();
      const instance2 = getFn();
      expect(instance1).toBe(instance2);
    });

    it('RegistryFirewallClientのインスタンスを返す', async () => {
      const { getRegistryFirewallClient: getFn } = await import('@/services/registry-firewall-client');
      const instance = getFn();
      expect(instance).toBeInstanceOf(RegistryFirewallClient);
    });
  });
});
