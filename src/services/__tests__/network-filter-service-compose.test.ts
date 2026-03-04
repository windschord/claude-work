import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoistedでモック関数を先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
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

// dns/promisesモック
vi.mock('dns/promises', () => ({
  default: {
    resolve4: vi.fn().mockResolvedValue([]),
    resolve6: vi.fn().mockResolvedValue([]),
  },
}));

// IptablesManagerをモック
vi.mock('../iptables-manager', () => {
  const MockIptablesManager = vi.fn(function (this: Record<string, unknown>) {
    this.checkAvailability = vi.fn().mockResolvedValue(true);
    this.setupFilterChain = vi.fn().mockResolvedValue(undefined);
    this.removeFilterChain = vi.fn().mockResolvedValue(undefined);
  });
  return {
    IptablesManager: MockIptablesManager,
    iptablesManager: {
      checkAvailability: vi.fn().mockResolvedValue(true),
      setupFilterChain: vi.fn().mockResolvedValue(undefined),
      removeFilterChain: vi.fn().mockResolvedValue(undefined),
    },
  };
});

import { NetworkFilterService } from '../network-filter-service';

describe('NetworkFilterService - Docker Compose環境対応', () => {
  let service: NetworkFilterService;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をリセット
    process.env = { ...originalEnv };
    delete process.env.COMPOSE_PROJECT;
    service = new NetworkFilterService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // テストケース1: COMPOSE_PROJECT環境変数が設定されている場合true
  describe('isDockerComposeEnvironment()', () => {
    it('COMPOSE_PROJECT環境変数が設定されている場合はtrueを返す', () => {
      process.env.COMPOSE_PROJECT = 'claudework';

      const result = service.isDockerComposeEnvironment();

      expect(result).toBe(true);
    });

    // テストケース2: 環境変数がない場合false
    it('COMPOSE_PROJECT環境変数が設定されていない場合はfalseを返す', () => {
      delete process.env.COMPOSE_PROJECT;

      const result = service.isDockerComposeEnvironment();

      expect(result).toBe(false);
    });

    it('COMPOSE_PROJECTが空文字の場合はfalseを返す', () => {
      process.env.COMPOSE_PROJECT = '';

      const result = service.isDockerComposeEnvironment();

      expect(result).toBe(false);
    });
  });

  // テストケース4: フィルタリング用ネットワーク名がclaudework-filter-プレフィックスを持つ
  describe('getFilterNetworkName()', () => {
    it('claudework-filter-プレフィックスを持つネットワーク名を返す', () => {
      const environmentId = 'abcdef12-5678-90ab-cdef-123456789012';

      const result = service.getFilterNetworkName(environmentId);

      expect(result).toMatch(/^claudework-filter-/);
    });

    it('環境IDの先頭8文字を使ったネットワーク名を返す', () => {
      const environmentId = 'abcdef12-5678-90ab-cdef-123456789012';

      const result = service.getFilterNetworkName(environmentId);

      expect(result).toBe('claudework-filter-abcdef12');
    });

    it('異なる環境IDに対して異なるネットワーク名を返す', () => {
      const envId1 = 'aaaaaaaa-0000-0000-0000-000000000000';
      const envId2 = 'bbbbbbbb-0000-0000-0000-000000000000';

      const name1 = service.getFilterNetworkName(envId1);
      const name2 = service.getFilterNetworkName(envId2);

      expect(name1).not.toBe(name2);
    });
  });

  // テストケース3: Docker Compose環境でのフィルタリング: サンドボックスコンテナにのみ適用される
  describe('Docker Compose環境でのフィルタリング適用', () => {
    it('Docker Compose環境でもフィルタリングはサンドボックスコンテナの環境IDを対象とする', () => {
      process.env.COMPOSE_PROJECT = 'claudework';
      // getFilterNetworkName はサンドボックスコンテナの環境IDを使って名前を生成する
      const sandboxEnvironmentId = 'sandbox-env-id-1234';
      const mainAppEnvironmentId = 'mainapp-env-id-5678';

      const sandboxNetworkName = service.getFilterNetworkName(sandboxEnvironmentId);
      const mainAppNetworkName = service.getFilterNetworkName(mainAppEnvironmentId);

      // サンドボックスとメインアプリは異なるネットワーク名になる（ID別管理）
      // environmentIdの先頭8文字が使われる
      expect(sandboxNetworkName).toBe('claudework-filter-sandbox-');
      expect(mainAppNetworkName).toBe('claudework-filter-mainapp-');
      // どちらもclaudework-filter-プレフィックスを持つ（環境ごとに独立した名前空間）
      expect(sandboxNetworkName).toMatch(/^claudework-filter-/);
      expect(mainAppNetworkName).toMatch(/^claudework-filter-/);
      // 異なる環境IDは異なるネットワーク名になる
      expect(sandboxNetworkName).not.toBe(mainAppNetworkName);
    });
  });

  // テストケース5: Compose環境検出失敗時: スタンドアロンDockerと同じ方式にフォールバック
  describe('Compose環境検出失敗時のフォールバック', () => {
    it('COMPOSE_PROJECTが未設定の場合はisDockerComposeEnvironmentがfalseを返し、スタンドアロンモードで動作する', () => {
      // COMPOSE_PROJECT未設定
      delete process.env.COMPOSE_PROJECT;

      const isCompose = service.isDockerComposeEnvironment();

      // Compose環境でないと判定される（スタンドアロンDockerにフォールバック）
      expect(isCompose).toBe(false);
    });

    it('Compose環境でない場合もgetFilterNetworkNameは正常に動作する', () => {
      delete process.env.COMPOSE_PROJECT;
      const environmentId = 'standalone-env-abcdef12';

      const networkName = service.getFilterNetworkName(environmentId);

      // フォールバック時も同じ命名規則が使われる
      expect(networkName).toMatch(/^claudework-filter-/);
      expect(networkName).toBe('claudework-filter-standalo');
    });
  });
});
