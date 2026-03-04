import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * NetworkFilterService 統合テスト（モック使用）
 *
 * フィルタリング機能全体のフローを検証する。
 * 外部依存（DB、iptables、DNS）はモックで代替する。
 */

// vi.hoistedでモック関数を先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockDbInsertGet,
  mockDbInsertOnConflictGet,
  mockDbDeleteRun,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockCheckAvailability,
  mockSetupFilterChain,
  mockRemoveFilterChain,
  mockCleanupOrphanedChains,
  mockDnsResolve4,
  mockDnsResolve6,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockDbInsertGet: vi.fn(),
  mockDbInsertOnConflictGet: vi.fn(),
  mockDbDeleteRun: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockCheckAvailability: vi.fn(),
  mockSetupFilterChain: vi.fn(),
  mockRemoveFilterChain: vi.fn(),
  mockCleanupOrphanedChains: vi.fn(),
  mockDnsResolve4: vi.fn(),
  mockDnsResolve6: vi.fn(),
}));

// ロガーのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
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
          get: mockDbInsertGet,
        })),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockDbInsertOnConflictGet,
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
        run: mockDbDeleteRun,
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

// dns/promisesのモック
vi.mock('dns/promises', () => ({
  default: {
    resolve4: mockDnsResolve4,
    resolve6: mockDnsResolve6,
  },
}));

// IptablesManagerのモック
vi.mock('../iptables-manager', () => {
  const MockIptablesManager = vi.fn(function (this: Record<string, unknown>) {
    this.checkAvailability = mockCheckAvailability;
    this.setupFilterChain = mockSetupFilterChain;
    this.removeFilterChain = mockRemoveFilterChain;
    this.cleanupOrphanedChains = mockCleanupOrphanedChains;
    this.listActiveChains = vi.fn().mockResolvedValue([]);
  });
  return {
    IptablesManager: MockIptablesManager,
    iptablesManager: {
      checkAvailability: mockCheckAvailability,
      setupFilterChain: mockSetupFilterChain,
      removeFilterChain: mockRemoveFilterChain,
      cleanupOrphanedChains: mockCleanupOrphanedChains,
    },
  };
});

import { NetworkFilterService, FilterApplicationError } from '../network-filter-service';
import { IptablesManager } from '../iptables-manager';
import type { NetworkFilterRule, NetworkFilterConfig } from '@/db/schema';

describe('NetworkFilterService - 統合テスト', () => {
  let service: NetworkFilterService;
  let mockIptablesManager: IptablesManager;

  const now = new Date('2026-03-03T12:00:00Z');
  const envId = 'env-uuid-integration-test';
  const containerSubnet = '172.18.0.0/16';

  const makeConfig = (overrides: Partial<NetworkFilterConfig> = {}): NetworkFilterConfig => ({
    id: 'config-uuid-integration-1',
    environment_id: envId,
    enabled: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  const makeRule = (overrides: Partial<NetworkFilterRule> = {}): NetworkFilterRule => ({
    id: 'rule-uuid-integration-1',
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

    mockIptablesManager = new IptablesManager();

    // デフォルト設定
    mockCheckAvailability.mockResolvedValue(true);
    mockSetupFilterChain.mockResolvedValue(undefined);
    mockRemoveFilterChain.mockResolvedValue(undefined);
    mockCleanupOrphanedChains.mockResolvedValue(undefined);
    mockDnsResolve4.mockResolvedValue([]);
    mockDnsResolve6.mockResolvedValue([]);

    service = new NetworkFilterService(mockIptablesManager);
  });

  // テスト6: フルフロー - ルール作成→フィルタリング有効化→applyFilter→removeFilter→ルール削除
  describe('フルフロー', () => {
    it('ルール作成→フィルタリング有効化→applyFilter→removeFilter→ルール削除の順序で動作する', async () => {
      const rule = makeRule();
      const config = makeConfig({ enabled: true });

      // ルール作成
      mockDbInsertGet.mockReturnValueOnce(rule);
      const createdRule = await service.createRule(envId, {
        target: 'api.anthropic.com',
        port: 443,
        description: 'Claude API',
      });
      expect(createdRule.target).toBe('api.anthropic.com');

      // フィルタリング有効化
      mockDbInsertOnConflictGet.mockReturnValueOnce(config);
      const updatedConfig = await service.updateFilterConfig(envId, true);
      expect(updatedConfig.enabled).toBe(true);

      // applyFilter: フィルタリング設定取得→ルール取得→DNS解決→iptables適用
      mockDbSelectGet.mockReturnValueOnce(config);     // getFilterConfig
      mockDbSelectAll.mockReturnValueOnce([rule]);     // getRules
      mockDnsResolve4.mockResolvedValueOnce(['1.2.3.4']);

      await service.applyFilter(envId, containerSubnet);

      expect(mockCheckAvailability).toHaveBeenCalledOnce();
      expect(mockSetupFilterChain).toHaveBeenCalledWith(
        envId,
        expect.arrayContaining([
          expect.objectContaining({ ips: expect.arrayContaining(['1.2.3.4']) }),
        ]),
        containerSubnet
      );

      // removeFilter
      await service.removeFilter(envId);
      expect(mockRemoveFilterChain).toHaveBeenCalledWith(envId);

      // ルール削除
      await service.deleteRule(rule.id);
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });
  });

  // テスト7: フェイルセーフ - iptables失敗時にFilterApplicationErrorがスローされる
  it('フェイルセーフ: iptables失敗時にFilterApplicationErrorがスローされる', async () => {
    const config = makeConfig({ enabled: true });
    const rule = makeRule();

    mockDbSelectGet.mockReturnValueOnce(config);
    mockDbSelectAll.mockReturnValueOnce([rule]);
    mockDnsResolve4.mockResolvedValueOnce(['1.2.3.4']);
    mockSetupFilterChain.mockRejectedValueOnce(new Error('iptables: Operation not permitted'));

    await expect(service.applyFilter(envId, containerSubnet)).rejects.toThrow(FilterApplicationError);

    // エラーログが出力されること
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('フィルタリング'),
      expect.objectContaining({ environmentId: envId })
    );
  });

  // テスト8: フィルタリング無効時 - applyFilterがスキップされる
  it('フィルタリング無効時: applyFilterがスキップされる', async () => {
    const config = makeConfig({ enabled: false });

    mockDbSelectGet.mockReturnValueOnce(config);

    await service.applyFilter(envId, containerSubnet);

    // iptablesには触れない
    expect(mockCheckAvailability).not.toHaveBeenCalled();
    expect(mockSetupFilterChain).not.toHaveBeenCalled();
  });

  // テスト9: DNS解決→iptablesルール生成→適用の一貫したフロー
  it('DNS解決→iptablesルール生成→適用の一貫したフロー', async () => {
    const config = makeConfig({ enabled: true });
    const rule = makeRule({ target: 'api.anthropic.com', port: 443 });

    mockDbSelectGet.mockReturnValueOnce(config);
    mockDbSelectAll.mockReturnValueOnce([rule]);

    // DNS解決: api.anthropic.com → 203.0.113.1
    mockDnsResolve4.mockResolvedValueOnce(['203.0.113.1']);
    mockDnsResolve6.mockResolvedValueOnce([]);

    await service.applyFilter(envId, containerSubnet);

    // setupFilterChainに解決済みIPが渡される
    expect(mockSetupFilterChain).toHaveBeenCalledWith(
      envId,
      expect.arrayContaining([
        expect.objectContaining({
          ips: expect.arrayContaining(['203.0.113.1']),
          port: 443,
          originalTarget: 'api.anthropic.com',
        }),
      ]),
      containerSubnet
    );
  });

  // テスト10: テンプレート適用→DNS解決→iptablesルール生成→適用のフロー
  it('テンプレート適用→DNS解決→iptablesルール生成→適用のフロー', async () => {
    const config = makeConfig({ enabled: true });

    // テンプレート取得
    const templates = service.getDefaultTemplates();
    expect(templates.length).toBeGreaterThan(0);

    const anthropicTemplate = templates.find(t => t.category === 'Anthropic API');
    expect(anthropicTemplate).toBeDefined();
    expect(anthropicTemplate!.rules.length).toBeGreaterThan(0);

    // テンプレートからルールを作成（既存ルールなし）
    mockDbSelectAll.mockReturnValueOnce([]); // getRules（重複チェック用）

    const templateRule: NetworkFilterRule = {
      id: 'rule-template-1',
      environment_id: envId,
      target: anthropicTemplate!.rules[0].target,
      port: anthropicTemplate!.rules[0].port,
      description: anthropicTemplate!.rules[0].description,
      enabled: true,
      created_at: now,
      updated_at: now,
    };
    mockDbInsertGet.mockReturnValueOnce(templateRule);

    const result = await service.applyTemplates(envId, anthropicTemplate!.rules);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);

    // applyFilter: フルフロー
    mockDbSelectGet.mockReturnValueOnce(config);
    mockDbSelectAll.mockReturnValueOnce([templateRule]);
    mockDnsResolve4.mockResolvedValueOnce(['203.0.113.10']);

    await service.applyFilter(envId, containerSubnet);

    // iptablesにルールが適用される
    expect(mockSetupFilterChain).toHaveBeenCalledWith(
      envId,
      expect.arrayContaining([
        expect.objectContaining({
          ips: expect.arrayContaining(['203.0.113.10']),
          port: anthropicTemplate!.rules[0].port,
          originalTarget: anthropicTemplate!.rules[0].target,
        }),
      ]),
      containerSubnet
    );
  });

  // 追加テスト: iptables利用不可時のapplyFilterのフェイルセーフ
  it('iptables利用不可時: FilterApplicationErrorがスローされる', async () => {
    const config = makeConfig({ enabled: true });

    mockDbSelectGet.mockReturnValueOnce(config);
    mockCheckAvailability.mockResolvedValueOnce(false);

    await expect(service.applyFilter(envId, containerSubnet)).rejects.toThrow(FilterApplicationError);
    expect(mockSetupFilterChain).not.toHaveBeenCalled();
  });

  // 追加テスト: removeFilter失敗時も警告ログのみでエラーにならない
  it('removeFilter失敗時も警告ログのみでエラーにならない', async () => {
    mockRemoveFilterChain.mockRejectedValueOnce(new Error('chain does not exist'));

    await expect(service.removeFilter(envId)).resolves.toBeUndefined();

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('クリーンアップ'),
      expect.objectContaining({ environmentId: envId })
    );
  });

  // 追加テスト: cleanupOrphanedRules - iptables利用可能時にcleanupOrphanedChainsが呼ばれる
  it('cleanupOrphanedRules: iptables利用可能時にcleanupOrphanedChainsが呼ばれる', async () => {
    await service.cleanupOrphanedRules();

    expect(mockCheckAvailability).toHaveBeenCalledOnce();
    expect(mockCleanupOrphanedChains).toHaveBeenCalledOnce();
  });

  // 追加テスト: cleanupOrphanedRules - iptables利用不可時にcleanupはスキップされる
  it('cleanupOrphanedRules: iptables利用不可時にcleanupはスキップされる', async () => {
    mockCheckAvailability.mockResolvedValueOnce(false);

    await expect(service.cleanupOrphanedRules()).resolves.toBeUndefined();

    expect(mockCleanupOrphanedChains).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('not available'),
      expect.anything()
    );
  });
});
