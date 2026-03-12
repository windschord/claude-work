import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  ProxyClient,
  ProxyConnectionError,
  ProxyValidationError,
  type ProxyHealthStatus,
  type ProxyRulesMap,
} from '@/services/proxy-client';

describe('ProxyClient', () => {
  let client: ProxyClient;
  const BASE_URL = 'http://localhost:8080';

  beforeEach(() => {
    client = new ProxyClient(BASE_URL);
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  // ==================== healthCheck ====================

  describe('healthCheck', () => {
    it('正常応答をProxyHealthStatusとして返す', async () => {
      const mockResponse: ProxyHealthStatus = {
        status: 'healthy',
        uptime: 3600,
        activeConnections: 5,
        ruleCount: 12,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.healthCheck();

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/health`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it('接続失敗時にProxyConnectionErrorをスローする', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.healthCheck()).rejects.toThrow(ProxyConnectionError);
      await expect(client.healthCheck()).rejects.toThrow('proxyに接続できません');
    });

    it('HTTP 500エラー時にProxyConnectionErrorをスローする', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(client.healthCheck()).rejects.toThrow(ProxyConnectionError);
    });
  });

  // ==================== getAllRules ====================

  describe('getAllRules', () => {
    it('全ルールをProxyRulesMapとして返す', async () => {
      const mockRules: ProxyRulesMap = {
        '172.20.0.3': {
          source_ip: '172.20.0.3',
          entries: [{ host: 'api.anthropic.com', port: 443 }],
          updated_at: '2026-01-01T00:00:00Z',
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockRules), { status: 200 })
      );

      const result = await client.getAllRules();

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/rules`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockRules);
    });
  });

  // ==================== setRules ====================

  describe('setRules', () => {
    it('PUTリクエストを正しいエンドポイントに送信し、結果を返す', async () => {
      const sourceIP = '172.20.0.3';
      const entries = [
        { host: 'api.anthropic.com', port: 443 },
        { host: '*.github.com' },
      ];
      const mockResponse: ProxyRuleSet = {
        source_ip: sourceIP,
        entries,
        updated_at: '2026-01-01T00:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.setRules(sourceIP, entries);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/rules/${sourceIP}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ entries }),
          signal: expect.any(AbortSignal),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('422レスポンス時にProxyValidationErrorをスローする', async () => {
      const errorBody = {
        details: [{ field: 'entries[0].host', message: 'Invalid host format' }],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), { status: 422 })
      );

      await expect(client.setRules('172.20.0.3', [{ host: 'invalid..host' }]))
        .rejects.toThrow(ProxyValidationError);
    });

    it('接続失敗時にリトライし、最終的にProxyConnectionErrorをスローする', async () => {
      // バックオフ待機を即座に解決させてテスト時間を短縮
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));

      try {
        vi.mocked(fetch)
          .mockRejectedValueOnce(new TypeError('fetch failed'))
          .mockRejectedValueOnce(new TypeError('fetch failed'))
          .mockRejectedValueOnce(new TypeError('fetch failed'));

        await expect(client.setRules('172.20.0.3', [])).rejects.toThrow(ProxyConnectionError);
        // 3回試行（初回 + 2回リトライ）
        expect(fetch).toHaveBeenCalledTimes(3);
      } finally {
        vi.stubGlobal('setTimeout', originalSetTimeout);
      }
    });
  });

  // ==================== deleteRules ====================

  describe('deleteRules', () => {
    it('DELETEリクエストを正しいエンドポイントに送信する', async () => {
      const sourceIP = '172.20.0.3';

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 204 })
      );

      await client.deleteRules(sourceIP);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/rules/${sourceIP}`,
        expect.objectContaining({
          method: 'DELETE',
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  // ==================== deleteAllRules ====================

  describe('deleteAllRules', () => {
    it('全ルール削除のDELETEリクエストを送信する', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 204 })
      );

      await client.deleteAllRules();

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/rules`,
        expect.objectContaining({
          method: 'DELETE',
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  // ==================== エラークラス ====================

  describe('ProxyConnectionError', () => {
    it('nameがProxyConnectionErrorである', () => {
      const err = new ProxyConnectionError('test');
      expect(err.name).toBe('ProxyConnectionError');
      expect(err).toBeInstanceOf(Error);
    });

    it('causeを保持する', () => {
      const cause = new Error('original');
      const err = new ProxyConnectionError('wrapper', cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('ProxyValidationError', () => {
    it('nameがProxyValidationErrorである', () => {
      const err = new ProxyValidationError('test');
      expect(err.name).toBe('ProxyValidationError');
      expect(err).toBeInstanceOf(Error);
    });

    it('detailsを保持する', () => {
      const details = [{ field: 'host', message: 'invalid' }];
      const err = new ProxyValidationError('validation failed', details);
      expect(err.details).toEqual(details);
    });
  });
});
