import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedで全モック関数を先に初期化
const { mockResolve4, mockResolve6, mockLoggerWarn } = vi.hoisted(() => ({
  mockResolve4: vi.fn(),
  mockResolve6: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

// dns/promisesモック
vi.mock('dns/promises', () => ({
  default: {
    resolve4: mockResolve4,
    resolve6: mockResolve6,
  },
}));

// vi.hoistedでDBモックを先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
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
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { NetworkFilterService } from '../network-filter-service';
import type { NetworkFilterRule } from '@/db/schema';

describe('NetworkFilterService - DNS解決とテスト接続', () => {
  let service: NetworkFilterService;

  const now = new Date('2026-03-03T12:00:00Z');
  const envId = 'env-uuid-1';

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
    service = new NetworkFilterService();
  });

  // ==================== resolveDomains ====================

  describe('resolveDomains', () => {
    // テスト1: 通常ドメインをIPv4に解決できる
    it('通常ドメインをIPv4に解決できる', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: 443 });
      mockResolve4.mockResolvedValue(['1.2.3.4', '5.6.7.8']);
      mockResolve6.mockRejectedValue(new Error('No IPv6'));

      const result = await service.resolveDomains([rule]);

      expect(result).toHaveLength(1);
      expect(result[0].ips).toContain('1.2.3.4');
      expect(result[0].ips).toContain('5.6.7.8');
      expect(result[0].originalTarget).toBe('api.anthropic.com');
      expect(result[0].port).toBe(443);
    });

    // テスト2: IPv6のみ解決できる場合はスキップ（iptables-restoreはIPv4専用）
    it('IPv4解決が失敗し、IPv6のみ解決できる場合はスキップする', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: 443 });
      mockResolve4.mockRejectedValue(new Error('No IPv4'));
      mockResolve6.mockResolvedValue(['2001:db8::1', '2001:db8::2']);

      const result = await service.resolveDomains([rule]);

      // iptables-restoreはIPv4専用のため、IPv6アドレスは除外される。
      // IPv4解決が失敗した場合はスキップされる（空配列）。
      expect(result).toHaveLength(0);
      expect(mockLoggerWarn).toHaveBeenCalled();
      // resolve6は呼ばれない（IPv4のみ解決する実装）
      expect(mockResolve6).not.toHaveBeenCalled();
    });

    // テスト3: ワイルドカードドメインのベースドメインを解決
    it('ワイルドカードドメインのベースドメインを解決する', async () => {
      const rule = makeRule({ target: '*.github.com', port: 443 });
      // ベースドメインgithub.comの解決
      mockResolve4.mockImplementation(async (domain: string) => {
        if (domain === 'github.com') return ['140.82.114.4'];
        // サブドメインの解決失敗
        throw new Error(`ENOTFOUND ${domain}`);
      });
      mockResolve6.mockRejectedValue(new Error('No IPv6'));

      const result = await service.resolveDomains([rule]);

      expect(result).toHaveLength(1);
      expect(result[0].ips).toContain('140.82.114.4');
      expect(result[0].originalTarget).toBe('*.github.com');
      // resolve4がgithub.comで呼ばれていることを確認
      expect(mockResolve4).toHaveBeenCalledWith('github.com');
    });

    // テスト4: ワイルドカードドメインの一般的サブドメインを解決試行
    it('ワイルドカードドメインの一般的なサブドメインも解決試行する', async () => {
      const rule = makeRule({ target: '*.github.com', port: 443 });
      mockResolve4.mockImplementation(async (domain: string) => {
        if (domain === 'github.com') return ['140.82.114.4'];
        if (domain === 'api.github.com') return ['140.82.114.5'];
        if (domain === 'www.github.com') return ['140.82.114.6'];
        throw new Error(`ENOTFOUND ${domain}`);
      });
      mockResolve6.mockRejectedValue(new Error('No IPv6'));

      const result = await service.resolveDomains([rule]);

      expect(result).toHaveLength(1);
      // ベースドメイン + api + www のIPが含まれている
      expect(result[0].ips).toContain('140.82.114.4');
      expect(result[0].ips).toContain('140.82.114.5');
      expect(result[0].ips).toContain('140.82.114.6');
      // api.github.com と www.github.com の解決が試行された
      expect(mockResolve4).toHaveBeenCalledWith('api.github.com');
      expect(mockResolve4).toHaveBeenCalledWith('www.github.com');
    });

    // テスト5: IPアドレスルールはそのまま通過
    it('IPアドレスルールはDNS解決せずそのまま通過する', async () => {
      const rule = makeRule({ target: '192.168.1.1', port: 80 });

      const result = await service.resolveDomains([rule]);

      expect(result).toHaveLength(1);
      expect(result[0].ips).toEqual(['192.168.1.1']);
      expect(result[0].originalTarget).toBe('192.168.1.1');
      // DNS解決は呼ばれない
      expect(mockResolve4).not.toHaveBeenCalled();
      expect(mockResolve6).not.toHaveBeenCalled();
    });

    // テスト6: CIDR形式はそのまま通過
    it('CIDR形式のルールはDNS解決せずそのまま通過する', async () => {
      const rule = makeRule({ target: '10.0.0.0/8', port: null });

      const result = await service.resolveDomains([rule]);

      expect(result).toHaveLength(1);
      expect(result[0].ips).toEqual(['10.0.0.0/8']);
      expect(result[0].originalTarget).toBe('10.0.0.0/8');
      // DNS解決は呼ばれない
      expect(mockResolve4).not.toHaveBeenCalled();
    });

    // テスト7: DNS解決失敗時は警告ログを出力しスキップ
    it('DNS解決が完全に失敗した場合は警告ログを出力してスキップする', async () => {
      const rule = makeRule({ target: 'nonexistent.example.com', port: 443 });
      mockResolve4.mockRejectedValue(new Error('ENOTFOUND nonexistent.example.com'));
      mockResolve6.mockRejectedValue(new Error('ENOTFOUND nonexistent.example.com'));

      const result = await service.resolveDomains([rule]);

      // 解決失敗のためスキップ（空配列）
      expect(result).toHaveLength(0);
      // 警告ログが出力される
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    // テスト8: キャッシュヒット時はDNS解決を再実行しない
    it('キャッシュヒット時はDNS解決を再実行しない', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: 443 });
      mockResolve4.mockResolvedValue(['1.2.3.4']);
      mockResolve6.mockRejectedValue(new Error('No IPv6'));

      // 1回目の解決
      await service.resolveDomains([rule]);
      // 2回目の解決（キャッシュヒット）
      await service.resolveDomains([rule]);

      // DNS解決は1回のみ（キャッシュされているため）
      expect(mockResolve4).toHaveBeenCalledTimes(1);
    });

    // テスト9: キャッシュTTL超過時はDNS解決を再実行する
    it('キャッシュTTL超過時はDNS解決を再実行する', async () => {
      vi.useFakeTimers();
      const rule = makeRule({ target: 'api.anthropic.com', port: 443 });
      mockResolve4.mockResolvedValue(['1.2.3.4']);
      mockResolve6.mockRejectedValue(new Error('No IPv6'));

      // 1回目の解決
      await service.resolveDomains([rule]);

      // TTL（5分 = 300000ms）を超過させる
      vi.advanceTimersByTime(301000);

      // 2回目の解決（TTL超過後）
      await service.resolveDomains([rule]);

      vi.useRealTimers();

      // DNS解決が2回実行される
      expect(mockResolve4).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== testConnection ====================

  describe('testConnection', () => {
    const mockConfig = {
      id: 'config-uuid-1',
      environment_id: envId,
      enabled: true,
      created_at: now,
      updated_at: now,
    };

    // テスト10: ホワイトリスト内のドメインはallowed: true
    it('ホワイトリスト内のドメインはallowed: trueを返す', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: 443, enabled: true });

      // getFilterConfig → enabled: true
      mockDbSelectGet.mockReturnValue(mockConfig);
      // getRules → [rule]
      mockDbSelectAll.mockReturnValue([rule]);

      const result = await service.testConnection(envId, 'api.anthropic.com', 443);

      expect(result.allowed).toBe(true);
    });

    // テスト11: ホワイトリスト外のドメインはallowed: false
    it('ホワイトリスト外のドメインはallowed: falseを返す', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: 443, enabled: true });

      mockDbSelectGet.mockReturnValue(mockConfig);
      mockDbSelectAll.mockReturnValue([rule]);

      const result = await service.testConnection(envId, 'evil.example.com', 443);

      expect(result.allowed).toBe(false);
    });

    // テスト12: ポート指定ありルールで異なるポートはblocked
    it('ポート指定ありルールで異なるポートへの通信はblocked', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: 443, enabled: true });

      mockDbSelectGet.mockReturnValue(mockConfig);
      mockDbSelectAll.mockReturnValue([rule]);

      // ポート80は許可されていない（ルールはポート443のみ）
      const result = await service.testConnection(envId, 'api.anthropic.com', 80);

      expect(result.allowed).toBe(false);
    });

    // テスト13: ポート指定なしルールは全ポートallowed
    it('ポート指定なし（null）のルールは全ポートallowed', async () => {
      const rule = makeRule({ target: 'api.anthropic.com', port: null, enabled: true });

      mockDbSelectGet.mockReturnValue(mockConfig);
      mockDbSelectAll.mockReturnValue([rule]);

      const result80 = await service.testConnection(envId, 'api.anthropic.com', 80);
      const result443 = await service.testConnection(envId, 'api.anthropic.com', 443);
      const resultNoPort = await service.testConnection(envId, 'api.anthropic.com');

      expect(result80.allowed).toBe(true);
      expect(result443.allowed).toBe(true);
      expect(resultNoPort.allowed).toBe(true);
    });

    // テスト14: マッチしたルール情報が返却される
    it('マッチしたルール情報がmatchedRuleとして返却される', async () => {
      const rule = makeRule({
        id: 'rule-uuid-1',
        target: 'api.anthropic.com',
        port: 443,
        description: 'Claude API',
        enabled: true,
      });

      mockDbSelectGet.mockReturnValue(mockConfig);
      mockDbSelectAll.mockReturnValue([rule]);

      const result = await service.testConnection(envId, 'api.anthropic.com', 443);

      expect(result.allowed).toBe(true);
      expect(result.matchedRule).toBeDefined();
      expect(result.matchedRule?.id).toBe('rule-uuid-1');
      expect(result.matchedRule?.target).toBe('api.anthropic.com');
      expect(result.matchedRule?.port).toBe(443);
      expect(result.matchedRule?.description).toBe('Claude API');
    });

    // テスト15: フィルタリング無効時は全てallowed
    it('フィルタリング無効時は全てallowedを返す', async () => {
      const disabledConfig = { ...mockConfig, enabled: false };

      mockDbSelectGet.mockReturnValue(disabledConfig);
      // ルールは返さない（フィルタリング無効なので参照しない）
      mockDbSelectAll.mockReturnValue([]);

      const result = await service.testConnection(envId, 'any.evil.com', 443);

      expect(result.allowed).toBe(true);
      expect(result.matchedRule).toBeUndefined();
    });
  });
});
