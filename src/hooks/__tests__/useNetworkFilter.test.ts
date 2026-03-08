import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { useNetworkFilter } from '../useNetworkFilter';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// サンプルデータ
const sampleRule = {
  id: 'rule-001',
  environment_id: 'env-001',
  target: 'api.anthropic.com',
  port: 443,
  description: 'Claude API',
  enabled: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

const sampleConfig = {
  id: 'config-001',
  environment_id: 'env-001',
  enabled: false,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

function makeFetchResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('useNetworkFilter', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('初期化', () => {
    it('マウント時にルール一覧とフィルタ設定を取得する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].target).toBe('api.anthropic.com');
      expect(result.current.filterConfig?.enabled).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('environmentIdが変更されたときに再フェッチする', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: { ...sampleConfig, environment_id: 'env-002' } }));

      const { result, rerender } = renderHook(
        ({ envId }) => useNetworkFilter(envId),
        { initialProps: { envId: 'env-001' } }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.rules).toHaveLength(1);

      rerender({ envId: 'env-002' });

      await waitFor(() => {
        expect(result.current.rules).toHaveLength(0);
      });

      // env-001 と env-002 それぞれで2回ずつ呼び出し
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('ルール取得', () => {
    it('ルール一覧を正しくフェッチする', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFetch).toHaveBeenCalledWith('/api/environments/env-001/network-rules');
      expect(result.current.rules[0]).toMatchObject({
        id: 'rule-001',
        target: 'api.anthropic.com',
        port: 443,
      });
    });
  });

  describe('フィルタ設定取得', () => {
    it('フィルタリング設定を正しくフェッチする', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: { ...sampleConfig, enabled: true } }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFetch).toHaveBeenCalledWith('/api/environments/env-001/network-filter');
      expect(result.current.filterConfig?.enabled).toBe(true);
    });
  });

  describe('ルール作成', () => {
    it('ルール作成後にルール一覧を再フェッチする', async () => {
      const newRule = { ...sampleRule, id: 'rule-002', target: '*.github.com' };

      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ rule: newRule }, 201))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule, newRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.rules).toHaveLength(1);

      await act(async () => {
        await result.current.createRule({ target: '*.github.com', port: 443 });
      });

      await waitFor(() => {
        expect(result.current.rules).toHaveLength(2);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-001/network-rules',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('*.github.com'),
        })
      );
    });
  });

  describe('ルール削除', () => {
    it('ルール削除後にルール一覧を再フェッチする', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) }))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.rules).toHaveLength(1);

      await act(async () => {
        await result.current.deleteRule('rule-001');
      });

      await waitFor(() => {
        expect(result.current.rules).toHaveLength(0);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-001/network-rules/rule-001',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('ルール更新', () => {
    it('ルール更新後にルール一覧を再フェッチする', async () => {
      const updatedRule = { ...sampleRule, port: 80 };

      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ rule: updatedRule }))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [updatedRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateRule('rule-001', { port: 80 });
      });

      await waitFor(() => {
        expect(result.current.rules[0].port).toBe(80);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-001/network-rules/rule-001',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('ルールトグル', () => {
    it('ルール有効/無効切り替えが正しくAPIを呼ぶ', async () => {
      const disabledRule = { ...sampleRule, enabled: false };

      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ rule: disabledRule }))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [disabledRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleRule('rule-001', false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-001/network-rules/rule-001',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"enabled":false'),
        })
      );
    });
  });

  describe('フィルタリング切り替え', () => {
    it('フィルタリング有効化が正しくAPIを呼ぶ', async () => {
      const enabledConfig = { ...sampleConfig, enabled: true };

      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ config: enabledConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: enabledConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.filterConfig?.enabled).toBe(false);

      await act(async () => {
        await result.current.toggleFilter(true);
      });

      await waitFor(() => {
        expect(result.current.filterConfig?.enabled).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-001/network-filter',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"enabled":true'),
        })
      );
    });
  });

  describe('refetch', () => {
    it('refetch呼び出しでルール一覧とフィルタ設定を再取得する', async () => {
      const newRule = { ...sampleRule, id: 'rule-002', target: '*.github.com' };

      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ rules: [sampleRule, newRule] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: { ...sampleConfig, enabled: true } }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.rules).toHaveLength(1);
      expect(result.current.filterConfig?.enabled).toBe(false);

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.rules).toHaveLength(2);
      });

      expect(result.current.filterConfig?.enabled).toBe(true);
      // 初期フェッチ2回 + refetch2回 = 4回
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('エラーハンドリング', () => {
    it('ルール一覧フェッチ失敗時にerror状態を設定する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ error: 'Internal server error' }, 500))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).not.toBeNull();
      expect(result.current.rules).toHaveLength(0);
    });

    it('フィルタ設定フェッチ失敗時にerror状態を設定する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ error: 'Internal server error' }, 500));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).not.toBeNull();
    });

    it('ルール作成失敗時にエラーをスローする', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({ rules: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: sampleConfig }))
        .mockImplementationOnce(() => makeFetchResponse({ error: 'Validation error' }, 400));

      const { result } = renderHook(() => useNetworkFilter('env-001'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.createRule({ target: 'invalid!!target' });
        })
      ).rejects.toThrow();
    });
  });
});
