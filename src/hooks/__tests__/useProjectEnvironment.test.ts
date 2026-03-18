import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { useProjectEnvironment } from '../useProjectEnvironment';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const sampleEnvironment = {
  id: 'env-001',
  name: 'テスト環境',
  type: 'DOCKER' as const,
  description: null,
  config: JSON.stringify({ imageName: 'ghcr.io/windschord/claude-work-sandbox', imageTag: 'latest' }),
  auth_dir_path: null,
  project_id: 'proj-001',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

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

const sampleFilterConfig = {
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

describe('useProjectEnvironment', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // デフォルトのモック応答を設定
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/environment/network-rules') && !url.includes('/templates')) {
        return makeFetchResponse({ rules: [sampleRule] });
      }
      if (url.includes('/environment/network-filter')) {
        return makeFetchResponse({ config: sampleFilterConfig });
      }
      if (url.includes('/environment')) {
        return makeFetchResponse({ environment: sampleEnvironment });
      }
      return makeFetchResponse({});
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('初期化', () => {
    it('マウント時に環境とネットワークデータを取得する', async () => {
      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      // 初期状態はローディング
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.environment).toEqual(sampleEnvironment);
      expect(result.current.error).toBeNull();
    });

    it('環境取得に失敗した場合エラー状態になる', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/environment/network-rules')) {
          return makeFetchResponse({ rules: [] });
        }
        if (url.includes('/environment/network-filter')) {
          return makeFetchResponse({ config: null });
        }
        return makeFetchResponse({ error: '環境が見つかりません' }, 404);
      });

      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.environment).toBeNull();
      expect(result.current.error).toBe('環境が見つかりません');
    });
  });

  describe('updateEnvironment()', () => {
    it('環境設定を更新できる', async () => {
      const updatedEnv = { ...sampleEnvironment, name: '更新された環境' };
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url.includes('/environment/network-rules')) {
          return makeFetchResponse({ rules: [sampleRule] });
        }
        if (url.includes('/environment/network-filter')) {
          return makeFetchResponse({ config: sampleFilterConfig });
        }
        if (url.includes('/environment') && options?.method === 'PUT') {
          return makeFetchResponse({ environment: updatedEnv });
        }
        return makeFetchResponse({ environment: sampleEnvironment });
      });

      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateEnvironment({ name: '更新された環境' });
      });

      expect(result.current.environment?.name).toBe('更新された環境');
    });

    it('アクティブセッションが存在する場合は警告メッセージを返す', async () => {
      const warningMessage = '実行中のセッションがあります。次回のセッション起動時に適用されます。';
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url.includes('/environment/network-rules')) {
          return makeFetchResponse({ rules: [] });
        }
        if (url.includes('/environment/network-filter')) {
          return makeFetchResponse({ config: sampleFilterConfig });
        }
        if (url.includes('/environment') && options?.method === 'PUT') {
          return makeFetchResponse({ environment: sampleEnvironment, warning: warningMessage });
        }
        return makeFetchResponse({ environment: sampleEnvironment });
      });

      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateEnvironment({ type: 'HOST' });
      });

      expect(result.current.warning).toBe(warningMessage);
    });
  });

  describe('ネットワークフィルター操作', () => {
    it('ネットワークフィルターの有効/無効を切り替えられる', async () => {
      const updatedConfig = { ...sampleFilterConfig, enabled: true };
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url.includes('/environment/network-rules')) {
          return makeFetchResponse({ rules: [sampleRule] });
        }
        if (url.includes('/environment/network-filter') && options?.method === 'PUT') {
          return makeFetchResponse({ config: updatedConfig });
        }
        if (url.includes('/environment/network-filter')) {
          return makeFetchResponse({ config: sampleFilterConfig });
        }
        return makeFetchResponse({ environment: sampleEnvironment });
      });

      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateNetworkFilter(true);
      });

      expect(result.current.networkFilter?.enabled).toBe(true);
    });
  });

  describe('ネットワークルール操作', () => {
    it('ルールを作成できる', async () => {
      const newRule = { ...sampleRule, id: 'rule-002', target: 'example.com' };
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url.includes('/environment/network-rules') && options?.method === 'POST') {
          return makeFetchResponse({ rule: newRule });
        }
        if (url.includes('/environment/network-rules')) {
          return makeFetchResponse({ rules: [sampleRule, newRule] });
        }
        if (url.includes('/environment/network-filter')) {
          return makeFetchResponse({ config: sampleFilterConfig });
        }
        return makeFetchResponse({ environment: sampleEnvironment });
      });

      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createRule({
          target: 'example.com',
          port: 443,
          description: 'Example',
        });
      });

      expect(result.current.networkRules).toHaveLength(2);
    });

    it('ルールを削除できる', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url.includes('/network-rules/rule-001') && options?.method === 'DELETE') {
          return makeFetchResponse({}, 200);
        }
        if (url.includes('/environment/network-rules')) {
          return makeFetchResponse({ rules: [] });
        }
        if (url.includes('/environment/network-filter')) {
          return makeFetchResponse({ config: sampleFilterConfig });
        }
        return makeFetchResponse({ environment: sampleEnvironment });
      });

      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteRule('rule-001');
      });

      expect(result.current.networkRules).toHaveLength(0);
    });
  });

  describe('APIエンドポイント', () => {
    it('新しいAPIエンドポイント /api/projects/[projectId]/environment を使用する', async () => {
      const { result } = renderHook(() => useProjectEnvironment('proj-001'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 環境取得APIが正しいエンドポイントを使用しているか確認
      const calls = mockFetch.mock.calls.map((call) => call[0] as string);
      expect(calls.some((url) => url.includes('/api/projects/proj-001/environment'))).toBe(true);
    });
  });
});
