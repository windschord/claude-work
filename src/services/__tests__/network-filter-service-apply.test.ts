import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモック関数を先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockCheckAvailability,
  mockSetupFilterChain,
  mockRemoveFilterChain,
  mockResolveDomains,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockCheckAvailability: vi.fn(),
  mockSetupFilterChain: vi.fn(),
  mockRemoveFilterChain: vi.fn(),
  mockResolveDomains: vi.fn(),
}));

// Drizzle DBのモック
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbSelectGet,
          all: mockDbSelectAll,
        })),
        get: mockDbSelectGet,
        all: mockDbSelectAll,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: vi.fn(),
        })),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: vi.fn(),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: vi.fn(),
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn(),
      })),
    })),
  },
  schema: {
    networkFilterRules: {
      id: 'id',
      environment_id: 'environment_id',
      target: 'target',
      port: 'port',
      description: 'description',
      enabled: 'enabled',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
    networkFilterConfigs: {
      id: 'id',
      environment_id: 'environment_id',
      enabled: 'enabled',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

// dns/promisesモック（resolveDomains内部で使用）
vi.mock('dns/promises', () => ({
  default: {
    resolve4: vi.fn().mockResolvedValue([]),
    resolve6: vi.fn().mockResolvedValue([]),
  },
}));

import { NetworkFilterService, FilterApplicationError } from '../network-filter-service';
import { IptablesManager } from '../iptables-manager';
import type { NetworkFilterRule, NetworkFilterConfig } from '@/db/schema';

// IptablesManagerをモック
vi.mock('../iptables-manager', () => {
  const MockIptablesManager = vi.fn(function (this: Record<string, unknown>) {
    this.checkAvailability = mockCheckAvailability;
    this.setupFilterChain = mockSetupFilterChain;
    this.removeFilterChain = mockRemoveFilterChain;
  });
  return {
    IptablesManager: MockIptablesManager,
    iptablesManager: {
      checkAvailability: mockCheckAvailability,
      setupFilterChain: mockSetupFilterChain,
      removeFilterChain: mockRemoveFilterChain,
    },
  };
});

describe('NetworkFilterService - applyFilter / removeFilter', () => {
  let service: NetworkFilterService;
  let mockIptablesManager: IptablesManager;

  const now = new Date('2026-03-03T12:00:00Z');
  const envId = 'env-uuid-test-1234';
  const containerSubnet = '172.18.0.0/16';

  const makeConfig = (overrides: Partial<NetworkFilterConfig> = {}): NetworkFilterConfig => ({
    id: 'config-uuid-1',
    environment_id: envId,
    enabled: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  const makeRule = (overrides: Partial<NetworkFilterRule> = {}): NetworkFilterRule => ({
    id: 'rule-uuid-1',
    environment_id: envId,
    target: 'api.anthropic.com',
    port: 443,
    description: 'Claude API',
    enabled: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // IptablesManagerのモックインスタンスを作成
    mockIptablesManager = new IptablesManager();

    // デフォルトでiptables利用可能
    mockCheckAvailability.mockResolvedValue(true);
    mockSetupFilterChain.mockResolvedValue(undefined);
    mockRemoveFilterChain.mockResolvedValue(undefined);

    // NetworkFilterServiceにIptablesManagerを注入
    service = new NetworkFilterService(mockIptablesManager);
  });

  // ==================== applyFilter ====================

  describe('applyFilter', () => {
    // テスト1: フィルタリング有効時にルール取得→DNS解決→iptables適用の順序で実行される
    it('フィルタリング有効時にルール取得→DNS解決→iptables適用の順序で実行される', async () => {
      const config = makeConfig({ enabled: true });
      const rule = makeRule();

      // getFilterConfig → config返却
      mockDbSelectGet.mockReturnValueOnce(config);
      // getRules → [rule]返却
      mockDbSelectAll.mockReturnValueOnce([rule]);

      // resolveDomains の実行をスパイして確認
      const resolveSpy = vi.spyOn(service, 'resolveDomains').mockResolvedValueOnce([
        { ips: ['1.2.3.4'], port: 443, description: 'Claude API', originalTarget: 'api.anthropic.com' },
      ]);

      await service.applyFilter(envId, containerSubnet);

      // 順序の確認: getFilterConfig → checkAvailability → getRules → resolveDomains → setupFilterChain
      expect(mockCheckAvailability).toHaveBeenCalledOnce();
      expect(resolveSpy).toHaveBeenCalledWith([rule]);
      expect(mockSetupFilterChain).toHaveBeenCalledWith(
        envId,
        [{ ips: ['1.2.3.4'], port: 443, description: 'Claude API', originalTarget: 'api.anthropic.com' }],
        containerSubnet
      );
    });

    // テスト2: フィルタリング無効時に何も実行されない
    it('フィルタリング無効時に何も実行されない', async () => {
      const config = makeConfig({ enabled: false });
      mockDbSelectGet.mockReturnValueOnce(config);

      await service.applyFilter(envId, containerSubnet);

      expect(mockCheckAvailability).not.toHaveBeenCalled();
      expect(mockSetupFilterChain).not.toHaveBeenCalled();
    });

    // テスト3: iptables適用失敗時にFilterApplicationErrorがスローされる（フェイルセーフ）
    it('iptables適用失敗時にFilterApplicationErrorがスローされる（フェイルセーフ）', async () => {
      const config = makeConfig({ enabled: true });
      const rule = makeRule();

      mockDbSelectGet.mockReturnValueOnce(config);
      mockDbSelectAll.mockReturnValueOnce([rule]);
      vi.spyOn(service, 'resolveDomains').mockResolvedValueOnce([
        { ips: ['1.2.3.4'], port: 443, originalTarget: 'api.anthropic.com' },
      ]);

      mockSetupFilterChain.mockRejectedValueOnce(new Error('iptables permission denied'));

      await expect(service.applyFilter(envId, containerSubnet)).rejects.toThrow(FilterApplicationError);
    });

    // テスト4: DNS解決で一部失敗しても解決成功分のみ適用
    it('DNS解決で一部失敗しても解決成功分のみ適用', async () => {
      const config = makeConfig({ enabled: true });
      const rule1 = makeRule({ id: 'rule-1', target: 'api.anthropic.com' });
      const rule2 = makeRule({ id: 'rule-2', target: 'unknown-domain-that-fails.invalid' });

      mockDbSelectGet.mockReturnValueOnce(config);
      mockDbSelectAll.mockReturnValueOnce([rule1, rule2]);

      // resolveDomains: rule1のみ解決成功（rule2はスキップされた結果として1件のみ返す）
      vi.spyOn(service, 'resolveDomains').mockResolvedValueOnce([
        { ips: ['1.2.3.4'], port: 443, originalTarget: 'api.anthropic.com' },
      ]);

      await service.applyFilter(envId, containerSubnet);

      // 解決成功分のみでsetupFilterChainが呼ばれる
      expect(mockSetupFilterChain).toHaveBeenCalledWith(
        envId,
        [{ ips: ['1.2.3.4'], port: 443, originalTarget: 'api.anthropic.com' }],
        containerSubnet
      );
    });

    // テスト5: ルールが0件の場合もsetupFilterChainが呼ばれる（DNS許可+デフォルトDROPのみ）
    it('ルールが0件の場合もsetupFilterChainが呼ばれる', async () => {
      const config = makeConfig({ enabled: true });

      mockDbSelectGet.mockReturnValueOnce(config);
      mockDbSelectAll.mockReturnValueOnce([]);
      vi.spyOn(service, 'resolveDomains').mockResolvedValueOnce([]);

      await service.applyFilter(envId, containerSubnet);

      expect(mockSetupFilterChain).toHaveBeenCalledWith(envId, [], containerSubnet);
    });

    // テスト6: iptablesが利用不可の場合にFilterApplicationErrorがスローされる
    it('iptablesが利用不可の場合にFilterApplicationErrorがスローされる', async () => {
      const config = makeConfig({ enabled: true });
      mockDbSelectGet.mockReturnValueOnce(config);

      mockCheckAvailability.mockResolvedValueOnce(false);

      await expect(service.applyFilter(envId, containerSubnet)).rejects.toThrow(FilterApplicationError);
      expect(mockSetupFilterChain).not.toHaveBeenCalled();
    });

    // テスト10: 成功時にINFOログが出力される
    it('成功時にINFOログが出力される', async () => {
      const config = makeConfig({ enabled: true });
      const rule = makeRule();

      mockDbSelectGet.mockReturnValueOnce(config);
      mockDbSelectAll.mockReturnValueOnce([rule]);
      vi.spyOn(service, 'resolveDomains').mockResolvedValueOnce([
        { ips: ['1.2.3.4'], port: 443, originalTarget: 'api.anthropic.com' },
      ]);

      await service.applyFilter(envId, containerSubnet);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('フィルタリング'),
        expect.objectContaining({ environmentId: envId })
      );
    });

    // テスト11: 失敗時にERRORログが出力される
    it('失敗時にERRORログが出力される', async () => {
      const config = makeConfig({ enabled: true });
      const rule = makeRule();

      mockDbSelectGet.mockReturnValueOnce(config);
      mockDbSelectAll.mockReturnValueOnce([rule]);
      vi.spyOn(service, 'resolveDomains').mockResolvedValueOnce([
        { ips: ['1.2.3.4'], port: 443, originalTarget: 'api.anthropic.com' },
      ]);
      mockSetupFilterChain.mockRejectedValueOnce(new Error('iptables error'));

      await expect(service.applyFilter(envId, containerSubnet)).rejects.toThrow(FilterApplicationError);

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('フィルタリング'),
        expect.objectContaining({ environmentId: envId })
      );
    });
  });

  // ==================== removeFilter ====================

  describe('removeFilter', () => {
    // テスト7: フィルタチェインが正しく削除される
    it('フィルタチェインが正しく削除される', async () => {
      await service.removeFilter(envId);

      expect(mockRemoveFilterChain).toHaveBeenCalledWith(envId);
    });

    // テスト8: チェインが存在しない場合もエラーにならない（冪等）
    it('チェインが存在しない場合もエラーにならない（冪等）', async () => {
      mockRemoveFilterChain.mockRejectedValueOnce(new Error('chain does not exist'));

      // エラーにならずに正常完了
      await expect(service.removeFilter(envId)).resolves.toBeUndefined();
    });

    // テスト9: 削除時にINFOレベルのログが出力される
    it('削除時にINFOレベルのログが出力される', async () => {
      await service.removeFilter(envId);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('フィルタリング'),
        expect.objectContaining({ environmentId: envId })
      );
    });
  });
});
