import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { useRegistryFirewall } from '../useRegistryFirewall';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// サンプルデータ
const sampleHealth = {
  status: 'healthy',
  registries: ['npm', 'PyPI', 'Go'],
};

const sampleBlocks = [
  {
    timestamp: '2024-01-01T00:00:00Z',
    package_name: 'malicious-pkg',
    registry: 'npm',
    reason: 'Known malware',
    severity: 'critical',
  },
];

const sampleConfig = {
  config: {
    registry_firewall_enabled: true,
  },
};

function makeFetchResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('useRegistryFirewall', () => {
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
    it('マウント時にhealth・blocks・configを並列取得する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: sampleBlocks }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig));

      const { result } = renderHook(() => useRegistryFirewall());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.health).toEqual(sampleHealth);
      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0].package_name).toBe('malicious-pkg');
      expect(result.current.enabled).toBe(true);
      expect(result.current.error).toBeNull();

      // 3つのAPIを呼び出し
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenCalledWith('/api/registry-firewall/health');
      expect(mockFetch).toHaveBeenCalledWith('/api/registry-firewall/blocks?limit=10');
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/config');
    });

    it('同一propsの再レンダーで再取得しない', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: sampleBlocks }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig));

      const { result, rerender } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);

      // 再レンダーしてもfetchは増えない
      rerender();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('healthレスポンスが失敗した場合はstoppedステータスを設定する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse({}, 500))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: [] }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.health).toEqual({ status: 'stopped' });
    });

    it('blocksレスポンスが失敗した場合は空配列を設定する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({}, 500))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.blocks).toEqual([]);
    });

    it('blocksレスポンスが配列でない場合は空配列を設定する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: 'invalid' }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.blocks).toEqual([]);
    });

    it('registry_firewall_enabledがfalseの場合はenabledをfalseに設定する', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: [] }))
        .mockImplementationOnce(() => makeFetchResponse({ config: { registry_firewall_enabled: false } }));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enabled).toBe(false);
    });
  });

  describe('toggleEnabled', () => {
    it('有効/無効を切り替えてAPIを呼び出す', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: [] }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig))
        .mockImplementationOnce(() => makeFetchResponse({}));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleEnabled(false);
      });

      expect(result.current.enabled).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/config', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ registry_firewall_enabled: false }),
      }));
    });

    it('API失敗時にエラーをスローする', async () => {
      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: [] }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig))
        .mockImplementationOnce(() => makeFetchResponse({ error: '設定の更新に失敗しました' }, 500));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.toggleEnabled(false);
        })
      ).rejects.toThrow();
    });
  });

  describe('refetch', () => {
    it('refetch呼び出しでデータを再取得する', async () => {
      const updatedBlocks = [
        ...sampleBlocks,
        {
          timestamp: '2024-01-02T00:00:00Z',
          package_name: 'another-bad-pkg',
          registry: 'PyPI',
          reason: 'Typosquatting',
        },
      ];

      mockFetch
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: sampleBlocks }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig))
        .mockImplementationOnce(() => makeFetchResponse(sampleHealth))
        .mockImplementationOnce(() => makeFetchResponse({ blocks: updatedBlocks }))
        .mockImplementationOnce(() => makeFetchResponse(sampleConfig));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.blocks).toHaveLength(1);

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.blocks).toHaveLength(2);
      });

      // 初期フェッチ3回 + refetch3回 = 6回
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });
  });

  describe('エラーハンドリング', () => {
    it('ネットワークエラー時にerror状態を設定する', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });

    it('不明なエラー時にデフォルトメッセージを設定する', async () => {
      mockFetch.mockRejectedValue('unknown error');

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('データの取得に失敗しました');
    });
  });
});
