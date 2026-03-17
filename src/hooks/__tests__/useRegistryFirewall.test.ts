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

/**
 * 初期fetch3連続モックのセットアップヘルパー
 */
function setupInitialFetchMocks(
  overrides: {
    healthData?: unknown;
    blocksData?: unknown;
    configData?: unknown;
    healthStatus?: number;
    blocksStatus?: number;
    configStatus?: number;
  } = {},
) {
  const {
    healthData = sampleHealth,
    blocksData = { blocks: sampleBlocks },
    configData = sampleConfig,
    healthStatus = 200,
    blocksStatus = 200,
    configStatus = 200,
  } = overrides;
  mockFetch
    .mockImplementationOnce(() => makeFetchResponse(healthData, healthStatus))
    .mockImplementationOnce(() => makeFetchResponse(blocksData, blocksStatus))
    .mockImplementationOnce(() => makeFetchResponse(configData, configStatus));
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
      setupInitialFetchMocks();

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
      expect(mockFetch).toHaveBeenCalledWith('/api/registry-firewall/health', expect.objectContaining({ signal: expect.any(AbortSignal) }));
      expect(mockFetch).toHaveBeenCalledWith('/api/registry-firewall/blocks?limit=10', expect.objectContaining({ signal: expect.any(AbortSignal) }));
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/config', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('同一propsの再レンダーで再取得しない', async () => {
      setupInitialFetchMocks();

      const { result, rerender } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);

      // 再レンダーしてもfetchは増えない
      rerender();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('アンマウント時にAbortControllerでリクエストがキャンセルされる', async () => {
      // 遅延するfetchをモック
      let resolvers: Array<(v: unknown) => void> = [];
      mockFetch.mockImplementation(() => new Promise(resolve => {
        resolvers.push(resolve);
      }));

      const { unmount } = renderHook(() => useRegistryFirewall());

      // fetchが呼ばれたことを確認
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // AbortSignalが渡されていることを確認
      const signalArg = mockFetch.mock.calls[0][1];
      expect(signalArg).toHaveProperty('signal');
      expect(signalArg.signal).toBeInstanceOf(AbortSignal);
      expect(signalArg.signal.aborted).toBe(false);

      // アンマウント
      unmount();

      // アンマウント後にシグナルがabortされている
      expect(signalArg.signal.aborted).toBe(true);

      // 保留中のPromiseを解決しても安全(setStateが呼ばれない)
      resolvers.forEach(resolve => resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }));
    });

    it('healthレスポンスが失敗した場合はstoppedステータスを設定する', async () => {
      setupInitialFetchMocks({ healthData: {}, healthStatus: 500 });

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.health).toEqual({ status: 'stopped' });
    });

    it('blocksレスポンスが失敗した場合は空配列を設定する', async () => {
      setupInitialFetchMocks({ blocksData: {}, blocksStatus: 500 });

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.blocks).toEqual([]);
    });

    it('blocksレスポンスが配列でない場合は空配列を設定する', async () => {
      setupInitialFetchMocks({ blocksData: { blocks: 'invalid' } });

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.blocks).toEqual([]);
    });

    it('registry_firewall_enabledがfalseの場合はenabledをfalseに設定する', async () => {
      setupInitialFetchMocks({
        blocksData: { blocks: [] },
        configData: { config: { registry_firewall_enabled: false } },
      });

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enabled).toBe(false);
    });
  });

  describe('toggleEnabled', () => {
    it('有効/無効を切り替えてAPIを呼び出す', async () => {
      setupInitialFetchMocks({ blocksData: { blocks: [] } });
      mockFetch.mockImplementationOnce(() => makeFetchResponse({}));

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registry_firewall_enabled: false }),
      }));
    });

    it('API失敗時にエラーをスローしenabledが変化しない', async () => {
      setupInitialFetchMocks({ blocksData: { blocks: [] } });
      mockFetch.mockImplementationOnce(() => makeFetchResponse({ error: '設定の更新に失敗しました' }, 500));

      const { result } = renderHook(() => useRegistryFirewall());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.toggleEnabled(false);
        })
      ).rejects.toThrow();

      // 失敗時は状態を変更しない
      expect(result.current.enabled).toBe(true);
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

      setupInitialFetchMocks();
      // refetch用のモック
      mockFetch
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
