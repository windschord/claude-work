import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  ProxyClient,
  ProxyConnectionError,
  ProxyValidationError,
  type ProxyHealthStatus,
  type ProxyRuleSet,
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

  afterEach(() => {
    vi.unstubAllGlobals();
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

      const promise = client.healthCheck();
      await expect(promise).rejects.toSatisfy((error: Error) => {
        return error instanceof ProxyConnectionError && error.message === 'proxyに接続できません';
      });
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

    it('接続失敗時にProxyConnectionErrorをスローする', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.getAllRules()).rejects.toThrow(ProxyConnectionError);
    });

    it('HTTP 500エラー時にProxyConnectionErrorをスローする', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(client.getAllRules()).rejects.toThrow(ProxyConnectionError);
    });

    it('HTTP 500エラーメッセージにステータスコードを含む', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(client.getAllRules()).rejects.toThrow(/HTTP 500/);
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

    it('IPv6アドレスがURLエンコードされてリクエストされる', async () => {
      const ipv6 = '2001:db8::1';
      const entries = [{ host: 'api.anthropic.com', port: 443 }];
      const mockResponse: ProxyRuleSet = {
        source_ip: ipv6,
        entries,
        updated_at: '2026-01-01T00:00:00Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await client.setRules(ipv6, entries);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/rules/${encodeURIComponent(ipv6)}`,
        expect.objectContaining({ method: 'PUT' })
      );
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

    it('4xxエラー時にリトライせずエラーをスローする', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      );

      await expect(client.setRules('172.20.0.3', [])).rejects.toThrow(ProxyValidationError);
      // 4xxはリトライしない - 1回のみ呼ばれる
      expect(fetch).toHaveBeenCalledTimes(1);
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
        vi.unstubAllGlobals();
      }
    });

    it('HTTP 500エラー時にリトライし、最終的にProxyConnectionErrorをスローする', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));

      try {
        vi.mocked(fetch)
          .mockResolvedValueOnce(new Response('Error', { status: 500 }))
          .mockResolvedValueOnce(new Response('Error', { status: 500 }))
          .mockResolvedValueOnce(new Response('Error', { status: 500 }));

        await expect(client.setRules('172.20.0.3', [])).rejects.toThrow(ProxyConnectionError);
        expect(fetch).toHaveBeenCalledTimes(3);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('422レスポンスでJSON解析失敗時もProxyValidationErrorをスローする', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not json', {
          status: 422,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      await expect(client.setRules('172.20.0.3', [{ host: 'test' }]))
        .rejects.toThrow(ProxyValidationError);
    });

    it('422レスポンスのdetailsが保持される', async () => {
      const errorBody = {
        details: [{ field: 'entries[0].host', message: 'Invalid' }],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), { status: 422 })
      );

      const error = await client.setRules('172.20.0.3', [{ host: 'invalid' }]).catch((e) => e);
      expect(error).toBeInstanceOf(ProxyValidationError);
      expect(error.details).toEqual(errorBody.details);
    });

    it('リトライ後に成功する場合', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));

      try {
        const mockResponse: ProxyRuleSet = {
          source_ip: '172.20.0.3',
          entries: [],
          updated_at: '2026-01-01T00:00:00Z',
        };
        vi.mocked(fetch)
          .mockRejectedValueOnce(new TypeError('fetch failed'))
          .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));

        const result = await client.setRules('172.20.0.3', []);
        expect(result).toEqual(mockResponse);
        expect(fetch).toHaveBeenCalledTimes(2);
      } finally {
        vi.unstubAllGlobals();
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

    it('IPv6アドレスがURLエンコードされてリクエストされる', async () => {
      const ipv6 = '2001:db8::1';
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 204 })
      );

      await client.deleteRules(ipv6);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/rules/${encodeURIComponent(ipv6)}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('接続失敗時にProxyConnectionErrorをスローする', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));
      try {
        vi.mocked(fetch)
          .mockRejectedValueOnce(new TypeError('fail'))
          .mockRejectedValueOnce(new TypeError('fail'))
          .mockRejectedValueOnce(new TypeError('fail'));
        await expect(client.deleteRules('172.20.0.3')).rejects.toThrow('proxyに接続できません');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('4xxエラー時にProxyValidationErrorをスローしメッセージにステータスを含む', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      );
      await expect(client.deleteRules('172.20.0.3')).rejects.toThrow(/HTTP 404/);
    });

    it('400エラー時にProxyValidationErrorをスローする', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Bad Request', { status: 400 })
      );
      await expect(client.deleteRules('172.20.0.3')).rejects.toThrow(ProxyValidationError);
    });

    it('5xxエラー時にリトライし、ProxyConnectionErrorをスローしメッセージにステータスを含む', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));
      try {
        vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 500 }));
        await expect(client.deleteRules('172.20.0.3')).rejects.toThrow(/HTTP 500/);
      } finally {
        vi.unstubAllGlobals();
      }
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

    it('接続失敗時にProxyConnectionErrorをスローする', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));
      try {
        vi.mocked(fetch)
          .mockRejectedValueOnce(new TypeError('fail'))
          .mockRejectedValueOnce(new TypeError('fail'))
          .mockRejectedValueOnce(new TypeError('fail'));
        await expect(client.deleteAllRules()).rejects.toThrow('proxyに接続できません');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('4xxエラー時にProxyValidationErrorをスローしメッセージにステータスを含む', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Bad Request', { status: 400 })
      );
      await expect(client.deleteAllRules()).rejects.toThrow(/HTTP 400/);
    });

    it('499エラー時にProxyValidationErrorをスローする', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Error', { status: 499 })
      );
      await expect(client.deleteAllRules()).rejects.toThrow(ProxyValidationError);
    });

    it('500エラー時はProxyValidationErrorではなくProxyConnectionErrorをスローする', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));
      try {
        vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 500 }));
        const error = await client.deleteAllRules().catch((e) => e);
        expect(error).toBeInstanceOf(ProxyConnectionError);
        expect(error).not.toBeInstanceOf(ProxyValidationError);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('5xxエラーメッセージにステータスを含む', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));
      try {
        vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 502 }));
        await expect(client.deleteAllRules()).rejects.toThrow(/HTTP 502/);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  // ==================== エラークラス ====================

  describe('parseJson error handling', () => {
    it('不正なJSONレスポンスでProxyConnectionErrorをスローする', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not json{{', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      );

      const error = await client.healthCheck().catch((e) => e);
      expect(error).toBeInstanceOf(ProxyConnectionError);
      expect(error.message).toMatch(/パースできません/);
    });
  });

  describe('healthCheck error messages', () => {
    it('HTTP エラーメッセージにステータスコードを含む', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Error', { status: 503 })
      );
      await expect(client.healthCheck()).rejects.toThrow(/HTTP 503/);
    });

    it('接続エラーメッセージが正しい', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fail'));
      await expect(client.healthCheck()).rejects.toThrow('proxyに接続できません');
    });

    it('非Errorの例外もProxyConnectionErrorにラップされる', async () => {
      vi.mocked(fetch).mockRejectedValueOnce('string error');
      await expect(client.healthCheck()).rejects.toThrow(ProxyConnectionError);
    });
  });

  describe('setRules error messages', () => {
    it('4xxクライアントエラーメッセージにステータスコードを含む', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Bad Request', { status: 400 })
      );
      await expect(client.setRules('172.20.0.3', [])).rejects.toThrow(/HTTP 400/);
    });

    it('422エラーメッセージが正しい', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{}', { status: 422 })
      );
      await expect(client.setRules('172.20.0.3', [])).rejects.toThrow('ルールのバリデーションに失敗しました');
    });

    it('5xxエラーメッセージにステータスコードを含む', async () => {
      const originalSetTimeout = globalThis.setTimeout;
      vi.stubGlobal('setTimeout', (fn: () => void) => originalSetTimeout(fn, 0));
      try {
        vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 500 }));
        await expect(client.setRules('172.20.0.3', [])).rejects.toThrow(/HTTP 500/);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

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
