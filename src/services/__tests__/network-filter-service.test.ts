import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dns from 'dns/promises';

// vi.hoistedでモックを先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockDbInsertGet,
  mockDbUpdateGet,
  mockDbDeleteRun,
  mockDbOnConflictGet,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockDbInsertGet: vi.fn(),
  mockDbUpdateGet: vi.fn(),
  mockDbDeleteRun: vi.fn(),
  mockDbOnConflictGet: vi.fn(),
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
            get: mockDbOnConflictGet,
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockDbUpdateGet,
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { NetworkFilterService, ValidationError, FilterApplicationError } from '../network-filter-service';
import type { IptablesManager } from '../iptables-manager';

describe('NetworkFilterService', () => {
  let service: NetworkFilterService;

  const now = new Date('2026-03-03T12:00:00Z');
  const envId = 'env-uuid-1';
  const ruleId = 'rule-uuid-1';

  const mockRule = {
    id: ruleId,
    environment_id: envId,
    target: 'api.anthropic.com',
    port: 443,
    description: 'Claude API',
    enabled: true,
    created_at: now,
    updated_at: now,
  };

  const mockConfig = {
    id: 'config-uuid-1',
    environment_id: envId,
    enabled: false,
    created_at: now,
    updated_at: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NetworkFilterService();
  });

  // ==================== getRules ====================

  describe('getRules', () => {
    it('指定環境のルール一覧を取得できる', async () => {
      mockDbSelectAll.mockReturnValue([mockRule]);

      const result = await service.getRules(envId);

      expect(result).toEqual([mockRule]);
      expect(result).toHaveLength(1);
    });

    it('存在しない環境IDで空配列を返す', async () => {
      mockDbSelectAll.mockReturnValue([]);

      const result = await service.getRules('non-existent-env');

      expect(result).toEqual([]);
    });
  });

  // ==================== createRule ====================

  describe('createRule', () => {
    it('有効なドメイン名でルールを作成できる', async () => {
      mockDbInsertGet.mockReturnValue(mockRule);

      const result = await service.createRule(envId, {
        target: 'api.anthropic.com',
        port: 443,
        description: 'Claude API',
      });

      expect(result).toEqual(mockRule);
    });

    it('有効なIPv4アドレスでルールを作成できる', async () => {
      const ipRule = { ...mockRule, target: '192.168.1.1' };
      mockDbInsertGet.mockReturnValue(ipRule);

      const result = await service.createRule(envId, {
        target: '192.168.1.1',
        port: 80,
      });

      expect(result.target).toBe('192.168.1.1');
    });

    it('ワイルドカード（*.example.com）でルールを作成できる', async () => {
      const wildcardRule = { ...mockRule, target: '*.example.com' };
      mockDbInsertGet.mockReturnValue(wildcardRule);

      const result = await service.createRule(envId, {
        target: '*.example.com',
        port: 443,
      });

      expect(result.target).toBe('*.example.com');
    });

    it('CIDR形式でルールを作成できる', async () => {
      const cidrRule = { ...mockRule, target: '192.168.0.0/16' };
      mockDbInsertGet.mockReturnValue(cidrRule);

      const result = await service.createRule(envId, {
        target: '192.168.0.0/16',
      });

      expect(result.target).toBe('192.168.0.0/16');
    });

    it('ポート省略時にnullが設定される', async () => {
      const noPortRule = { ...mockRule, port: null };
      mockDbInsertGet.mockReturnValue(noPortRule);

      const result = await service.createRule(envId, {
        target: 'api.anthropic.com',
      });

      expect(result.port).toBeNull();
    });

    it('不正な形式でValidationErrorがスローされる', async () => {
      await expect(
        service.createRule(envId, { target: 'invalid domain!' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==================== updateRule ====================

  describe('updateRule', () => {
    it('ルールを更新できる', async () => {
      const updatedRule = { ...mockRule, port: 80, description: 'Updated' };
      mockDbUpdateGet.mockReturnValue(updatedRule);

      const result = await service.updateRule(ruleId, {
        port: 80,
        description: 'Updated',
      });

      expect(result.port).toBe(80);
      expect(result.description).toBe('Updated');
    });
  });

  // ==================== deleteRule ====================

  describe('deleteRule', () => {
    it('ルールを削除できる', async () => {
      mockDbDeleteRun.mockReturnValue(undefined);

      await expect(service.deleteRule(ruleId)).resolves.toBeUndefined();
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });
  });

  // ==================== getFilterConfig ====================

  describe('getFilterConfig', () => {
    it('環境のフィルタリング設定を取得（未設定時はnull）', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.getFilterConfig(envId);

      expect(result).toBeNull();
    });

    it('既存の設定が存在する場合は設定を返す', async () => {
      mockDbSelectGet.mockReturnValue(mockConfig);

      const result = await service.getFilterConfig(envId);

      expect(result).toEqual(mockConfig);
      expect(result?.enabled).toBe(false);
    });
  });

  // ==================== updateFilterConfig ====================

  describe('updateFilterConfig', () => {
    it('フィルタリングを有効にする（新規作成）', async () => {
      const enabledConfig = { ...mockConfig, enabled: true };
      mockDbOnConflictGet.mockReturnValue(enabledConfig);

      const result = await service.updateFilterConfig(envId, true);

      expect(result.enabled).toBe(true);
    });

    it('既存設定の有効/無効を切り替えできる', async () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      mockDbOnConflictGet.mockReturnValue(disabledConfig);

      const result = await service.updateFilterConfig(envId, false);

      expect(result.enabled).toBe(false);
    });
  });

  // ==================== validateTarget (private - via createRule) ====================

  describe('validateTarget', () => {
    it('有効なドメイン名を受け付ける', async () => {
      mockDbInsertGet.mockReturnValue({ ...mockRule, target: 'example.com' });

      await expect(
        service.createRule(envId, { target: 'example.com' })
      ).resolves.toBeDefined();
    });

    it('有効なIPv4アドレスを受け付ける', async () => {
      mockDbInsertGet.mockReturnValue({ ...mockRule, target: '10.0.0.1' });

      await expect(
        service.createRule(envId, { target: '10.0.0.1' })
      ).resolves.toBeDefined();
    });

    it('IPv6アドレスを拒否する（iptables-restoreはIPv4のみ対応）', async () => {
      await expect(
        service.createRule(envId, { target: '::1' })
      ).rejects.toThrow(ValidationError);
    });

    it('*.サブドメイン形式を受け付ける', async () => {
      mockDbInsertGet.mockReturnValue({ ...mockRule, target: '*.npmjs.org' });

      await expect(
        service.createRule(envId, { target: '*.npmjs.org' })
      ).resolves.toBeDefined();
    });

    it('CIDR形式を受け付ける', async () => {
      mockDbInsertGet.mockReturnValue({ ...mockRule, target: '10.0.0.0/8' });

      await expect(
        service.createRule(envId, { target: '10.0.0.0/8' })
      ).resolves.toBeDefined();
    });

    it('空文字列を拒否する', async () => {
      await expect(
        service.createRule(envId, { target: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('不正なドメイン名を拒否する', async () => {
      await expect(
        service.createRule(envId, { target: 'invalid domain with spaces' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==================== validatePort (private - via createRule) ====================

  describe('validatePort', () => {
    it('1-65535の範囲を受け付ける', async () => {
      mockDbInsertGet.mockReturnValue({ ...mockRule, port: 1 });
      await expect(
        service.createRule(envId, { target: 'example.com', port: 1 })
      ).resolves.toBeDefined();

      mockDbInsertGet.mockReturnValue({ ...mockRule, port: 65535 });
      await expect(
        service.createRule(envId, { target: 'example.com', port: 65535 })
      ).resolves.toBeDefined();
    });

    it('範囲外のポートを拒否する', async () => {
      await expect(
        service.createRule(envId, { target: 'example.com', port: 0 })
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createRule(envId, { target: 'example.com', port: 65536 })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==================== getDefaultTemplates ====================

  describe('getDefaultTemplates', () => {
    it('デフォルトテンプレートを返す', () => {
      const templates = service.getDefaultTemplates();

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);

      // Anthropic API テンプレートが含まれている
      const anthropicTemplate = templates.find(t => t.category === 'Anthropic API');
      expect(anthropicTemplate).toBeDefined();
      expect(anthropicTemplate?.rules).toContainEqual(
        expect.objectContaining({ target: 'api.anthropic.com', port: 443 })
      );

      // npmテンプレートが含まれている
      const npmTemplate = templates.find(t => t.category === 'npm');
      expect(npmTemplate).toBeDefined();

      // GitHubテンプレートが含まれている
      const githubTemplate = templates.find(t => t.category === 'GitHub');
      expect(githubTemplate).toBeDefined();
    });
  });

  // ==================== applyTemplates ====================

  describe('applyTemplates', () => {
    it('テンプレートからルールを一括追加できる', async () => {
      // 既存ルールなし
      mockDbSelectAll.mockReturnValue([]);
      // ルール作成時の戻り値
      const createdRule1 = { ...mockRule, target: 'api.anthropic.com', port: 443 };
      const createdRule2 = { ...mockRule, id: 'rule-uuid-2', target: '*.npmjs.org', port: 443 };
      mockDbInsertGet
        .mockReturnValueOnce(createdRule1)
        .mockReturnValueOnce(createdRule2);

      const result = await service.applyTemplates(envId, [
        { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
        { target: '*.npmjs.org', port: 443, description: 'npm registry' },
      ]);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.rules).toHaveLength(2);
    });

    it('重複ルールをスキップする', async () => {
      // 既存ルールあり（api.anthropic.com:443）
      const existingRule = { ...mockRule, target: 'api.anthropic.com', port: 443 };
      mockDbSelectAll.mockReturnValue([existingRule]);
      // 新規ルールの作成
      const createdRule = { ...mockRule, id: 'rule-uuid-2', target: '*.npmjs.org', port: 443 };
      mockDbInsertGet.mockReturnValueOnce(createdRule);

      const result = await service.applyTemplates(envId, [
        { target: 'api.anthropic.com', port: 443, description: 'Claude API' },  // 重複
        { target: '*.npmjs.org', port: 443, description: 'npm registry' },       // 新規
      ]);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.rules).toHaveLength(1);
    });
  });

  // ==================== resolveWildcardDomain（resolveDomains経由）====================

  describe('resolveDomains - ワイルドカードドメインの拡張解決', () => {
    // IPv4 CIDR 判定用ヘルパー
    const IPV4_CIDR_PATTERN = /^\d+\.\d+\.\d+\.\d+\/\d+$/;
    const hasCidr = (ips: string[]) => ips.some(ip => IPV4_CIDR_PATTERN.test(ip));
    let dnsResolve4Spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // vi.spyOn を使用する理由:
      // このテストファイルはファイルトップレベルで vi.mock('@/lib/db') 等を使用しており、
      // dns/promises に対しては describe ブロック単位でのモック切り替えが必要なため
      // vi.spyOn + mockRestore パターンを採用している。
      // network-filter-service-dns.test.ts は dns/promises を vi.mock でモジュールレベルでモックしており、
      // テスト間でモック状態を共有する必要がない場合に適している。
      dnsResolve4Spy = vi.spyOn(dns, 'resolve4');
    });

    afterEach(() => {
      dnsResolve4Spy.mockRestore();
    });

    it('github.com ワイルドカードでサービス固有サブドメインが解決される', async () => {
      // dns.resolve4 のモック: 各サブドメインに対して固有のIPを返す
      dnsResolve4Spy.mockImplementation(async (domain: string) => {
        const ipMap: Record<string, string[]> = {
          'github.com': ['140.82.112.3'],
          'codeload.github.com': ['140.82.112.10'],
          'objects.github.com': ['140.82.112.11'],
          'pkg.github.com': ['140.82.112.12'],
          'ghcr.github.com': ['140.82.112.13'],
          'copilot-proxy.github.com': ['140.82.112.14'],
        };
        const result = ipMap[domain as string];
        if (!result) throw new Error(`NXDOMAIN: ${domain}`);
        return result;
      });

      const githubWildcardRule = {
        ...mockRule,
        target: '*.github.com',
        port: 443,
      };

      const resolved = await service.resolveDomains([githubWildcardRule]);

      expect(resolved).toHaveLength(1);
      const ips = resolved[0].ips;

      // サービス固有サブドメインのIPが含まれる（モックで設定した全IPを検証）
      expect(ips).toEqual(expect.arrayContaining([
        '140.82.112.10', // codeload.github.com
        '140.82.112.11', // objects.github.com
        '140.82.112.12', // pkg.github.com
        '140.82.112.13', // ghcr.github.com
        '140.82.112.14', // copilot-proxy.github.com
      ]));
    });

    it('github.com ワイルドカードで既知CIDRブロックが含まれる', async () => {
      // dns.resolve4 のモック: ベースドメインのみ解決
      dnsResolve4Spy.mockImplementation(async (domain: string) => {
        if (domain === 'github.com') return ['140.82.112.3'];
        throw new Error(`NXDOMAIN: ${domain}`);
      });

      const githubWildcardRule = {
        ...mockRule,
        target: '*.github.com',
        port: 443,
      };

      const resolved = await service.resolveDomains([githubWildcardRule]);

      expect(resolved).toHaveLength(1);
      const ips = resolved[0].ips;

      // 既知CIDRブロックが含まれる
      expect(ips).toContain('140.82.112.0/20');
      expect(ips).toContain('192.30.252.0/22');
      expect(ips).toContain('185.199.108.0/22');
      expect(ips).toContain('143.55.64.0/20');
    });

    it('githubusercontent.com ワイルドカードで固有サブドメインとCIDRが含まれる', async () => {
      dnsResolve4Spy.mockImplementation(async (domain: string) => {
        if (domain === 'githubusercontent.com') return ['185.199.108.1'];
        if (domain === 'objects.githubusercontent.com') return ['185.199.108.2'];
        if (domain === 'avatars.githubusercontent.com') return ['185.199.108.3'];
        throw new Error(`NXDOMAIN: ${domain}`);
      });

      const rule = {
        ...mockRule,
        target: '*.githubusercontent.com',
        port: 443,
      };

      const resolved = await service.resolveDomains([rule]);

      expect(resolved).toHaveLength(1);
      const ips = resolved[0].ips;

      // オブジェクトとアバターのサブドメインIPが含まれる
      expect(ips).toContain('185.199.108.2'); // objects
      expect(ips).toContain('185.199.108.3'); // avatars
      // CIDRが含まれる
      expect(ips).toContain('185.199.108.0/22');
    });

    it('npmjs.org ワイルドカードで registry サブドメインが解決される', async () => {
      dnsResolve4Spy.mockImplementation(async (domain: string) => {
        if (domain === 'npmjs.org') return ['104.16.0.1'];
        if (domain === 'registry.npmjs.org') return ['104.16.0.2'];
        throw new Error(`NXDOMAIN: ${domain}`);
      });

      const rule = {
        ...mockRule,
        target: '*.npmjs.org',
        port: 443,
      };

      const resolved = await service.resolveDomains([rule]);

      expect(resolved).toHaveLength(1);
      const ips = resolved[0].ips;

      // registry サブドメインのIPが含まれる
      expect(ips).toContain('104.16.0.2');
      // 未知ドメインなのでCIDRは含まれない
      expect(hasCidr(ips)).toBe(false);
    });

    it('未知ドメインのワイルドカードではCIDR追加なしで動作する', async () => {
      dnsResolve4Spy.mockImplementation(async (domain: string) => {
        if (domain === 'example.com') return ['93.184.216.34'];
        throw new Error(`NXDOMAIN: ${domain}`);
      });

      const rule = {
        ...mockRule,
        target: '*.example.com',
        port: 443,
      };

      const resolved = await service.resolveDomains([rule]);

      expect(resolved).toHaveLength(1);
      const ips = resolved[0].ips;

      // ベースドメインのIPは含まれる
      expect(ips).toContain('93.184.216.34');
      // CIDRは含まれない
      expect(hasCidr(ips)).toBe(false);
    });
  });

  // ==================== isFilterEnabled ====================

  describe('isFilterEnabled', () => {
    it('フィルタリング設定が存在してenabledがtrueの場合にtrueを返す', async () => {
      mockDbSelectGet.mockReturnValue({
        environment_id: envId,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.isFilterEnabled(envId);
      expect(result).toBe(true);
    });

    it('フィルタリング設定が存在しない場合にfalseを返す', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.isFilterEnabled(envId);
      expect(result).toBe(false);
    });

    it('フィルタリング設定が存在してもenabledがfalseの場合にfalseを返す', async () => {
      mockDbSelectGet.mockReturnValue({
        environment_id: envId,
        enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.isFilterEnabled(envId);
      expect(result).toBe(false);
    });
  });

  // ==================== applyFilter / removeFilter（mutex直列化テスト） ====================

  describe('applyFilter / removeFilter mutex（直列化）', () => {
    let mockIptablesManager: IptablesManager;

    beforeEach(() => {
      vi.clearAllMocks();

      // IptablesManagerのモック
      mockIptablesManager = {
        checkAvailability: vi.fn().mockResolvedValue(true),
        setupFilterChain: vi.fn().mockResolvedValue(undefined),
        removeFilterChain: vi.fn().mockResolvedValue(undefined),
        listActiveChains: vi.fn().mockResolvedValue([]),
        cleanupOrphanedChains: vi.fn().mockResolvedValue(undefined),
      } as unknown as IptablesManager;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('同一environmentIdで2つのapplyFilterを同時呼び出しすると直列に実行される', async () => {
      // フィルタリング設定: 有効
      mockDbSelectGet.mockReturnValue({ id: 'config-1', environment_id: envId, enabled: true });
      // ルールが1件以上必要（0件だと早期リターンしてsetupFilterChainが呼ばれない）
      mockDbSelectAll.mockReturnValue([mockRule]);

      const executionOrder: number[] = [];

      // setupFilterChainに遅延を追加して並行性を確認
      let callCount = 0;
      (mockIptablesManager.setupFilterChain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        const myOrder = ++callCount;
        executionOrder.push(myOrder * 10); // 開始
        await new Promise(r => setTimeout(r, 10));
        executionOrder.push(myOrder * 10 + 1); // 終了
      });

      const serviceWithMock = new NetworkFilterService(mockIptablesManager);

      // 同時に呼び出し
      await Promise.all([
        serviceWithMock.applyFilter(envId, '172.18.0.0/16'),
        serviceWithMock.applyFilter(envId, '172.18.0.0/16'),
      ]);

      // 直列実行されていること: [10, 11, 20, 21] の順序（1つ目が完全に終わってから2つ目が始まる）
      // 並列だと [10, 20, 11, 21] のような混在が発生する
      expect(executionOrder).toEqual([10, 11, 20, 21]);
    });

    it('同一environmentIdでremoveFilterとapplyFilterを同時呼び出しすると直列に実行される', async () => {
      // フィルタリング設定: 有効
      mockDbSelectGet.mockReturnValue({ id: 'config-1', environment_id: envId, enabled: true });
      // ルールが1件以上必要（0件だと早期リターンしてsetupFilterChainが呼ばれない）
      mockDbSelectAll.mockReturnValue([mockRule]);

      const executionOrder: string[] = [];

      (mockIptablesManager.removeFilterChain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executionOrder.push('remove:start');
        await new Promise(r => setTimeout(r, 10));
        executionOrder.push('remove:end');
      });

      (mockIptablesManager.setupFilterChain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executionOrder.push('apply:start');
        await new Promise(r => setTimeout(r, 10));
        executionOrder.push('apply:end');
      });

      const serviceWithMock = new NetworkFilterService(mockIptablesManager);

      // removeFilterとapplyFilterを同時に呼び出し
      await Promise.all([
        serviceWithMock.removeFilter(envId),
        serviceWithMock.applyFilter(envId, '172.18.0.0/16'),
      ]);

      // 直列実行されていること（removeが先）
      expect(executionOrder[0]).toBe('remove:start');
      expect(executionOrder[1]).toBe('remove:end');
      expect(executionOrder[2]).toBe('apply:start');
      expect(executionOrder[3]).toBe('apply:end');
    });

    it('異なるenvironmentIdでは並列実行される', async () => {
      const envId2 = 'env-uuid-2';

      // どちらの環境もフィルタリング有効
      mockDbSelectGet.mockReturnValue({ id: 'config-1', environment_id: envId, enabled: true });
      // ルールが1件以上必要（0件だと早期リターンしてsetupFilterChainが呼ばれない）
      mockDbSelectAll.mockReturnValue([mockRule]);

      const executionOrder: string[] = [];

      (mockIptablesManager.setupFilterChain as ReturnType<typeof vi.fn>).mockImplementation(
        async (currentEnvId: string) => {
          executionOrder.push(`${currentEnvId}:start`);
          await new Promise(r => setTimeout(r, 20));
          executionOrder.push(`${currentEnvId}:end`);
        }
      );

      const serviceWithMock = new NetworkFilterService(mockIptablesManager);

      await Promise.all([
        serviceWithMock.applyFilter(envId, '172.18.0.0/16'),
        serviceWithMock.applyFilter(envId2, '172.19.0.0/16'),
      ]);

      // 異なるenvironmentIdなので両方のstartが先に来る（並列実行）
      expect(executionOrder[0]).toContain(':start');
      expect(executionOrder[1]).toContain(':start');
      expect(executionOrder[2]).toContain(':end');
      expect(executionOrder[3]).toContain(':end');
    });

    it('applyFilter内でエラーが発生してもmutexが解放され次の操作が実行できる', async () => {
      // フィルタリング設定: 有効
      mockDbSelectGet.mockReturnValue({ id: 'config-1', environment_id: envId, enabled: true });
      // ルールが1件以上必要（0件だと早期リターンしてsetupFilterChainが呼ばれない）
      mockDbSelectAll.mockReturnValue([mockRule]);

      let callCount = 0;

      (mockIptablesManager.setupFilterChain as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('iptables error');
        }
        // 2回目は成功
      });

      const serviceWithMock = new NetworkFilterService(mockIptablesManager);

      // 1回目: エラー発生
      await expect(serviceWithMock.applyFilter(envId, '172.18.0.0/16')).rejects.toThrow(FilterApplicationError);

      // 2回目: エラー後もmutexが解放されて実行できる
      await expect(serviceWithMock.applyFilter(envId, '172.18.0.0/16')).resolves.toBeUndefined();

      expect(callCount).toBe(2);
    });
  });
});
