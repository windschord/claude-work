import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモック関数を先に初期化
const {
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerDebug,
  mockCheckAvailability,
  mockCleanupOrphanedChains,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockCheckAvailability: vi.fn(),
  mockCleanupOrphanedChains: vi.fn(),
}));

// ロガーのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
    error: vi.fn(),
  },
}));

// DBのモック（cleanupOrphanedRulesはDB操作不要だがモジュール解決に必要）
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({ get: vi.fn() })),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => ({ get: vi.fn() })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({ get: vi.fn() })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ run: vi.fn() })),
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
}));

// dns/promisesのモック
vi.mock('dns/promises', () => ({
  default: {
    resolve4: vi.fn().mockResolvedValue([]),
    resolve6: vi.fn().mockResolvedValue([]),
  },
}));

// IptablesManagerのモック
vi.mock('../iptables-manager', () => {
  const MockIptablesManager = vi.fn(function (this: Record<string, unknown>) {
    this.checkAvailability = mockCheckAvailability;
    this.cleanupOrphanedChains = mockCleanupOrphanedChains;
    this.setupFilterChain = vi.fn();
    this.removeFilterChain = vi.fn();
    this.listActiveChains = vi.fn();
  });
  return {
    IptablesManager: MockIptablesManager,
    iptablesManager: {
      checkAvailability: mockCheckAvailability,
      cleanupOrphanedChains: mockCleanupOrphanedChains,
    },
  };
});

import { NetworkFilterService } from '../network-filter-service';
import { IptablesManager } from '../iptables-manager';

describe('NetworkFilterService - cleanupOrphanedRules', () => {
  let service: NetworkFilterService;
  let mockIptablesManager: IptablesManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // IptablesManagerのモックインスタンスを作成
    mockIptablesManager = new IptablesManager();

    // デフォルトでiptables利用可能
    mockCheckAvailability.mockResolvedValue(true);
    mockCleanupOrphanedChains.mockResolvedValue(undefined);

    service = new NetworkFilterService(mockIptablesManager);
  });

  // テスト1: IptablesManager.cleanupOrphanedChainsを呼ぶ
  it('IptablesManager.cleanupOrphanedChainsを呼ぶ', async () => {
    await service.cleanupOrphanedRules();

    expect(mockCleanupOrphanedChains).toHaveBeenCalledOnce();
  });

  // テスト2: 有効な環境のチェインは削除しない（cleanupOrphanedChainsに委譲）
  it('クリーンアップをIptablesManagerのcleanupOrphanedChainsに委譲する', async () => {
    await service.cleanupOrphanedRules();

    // cleanupOrphanedChainsが呼ばれていることでIptablesManager側のロジックに委譲していることを確認
    expect(mockCleanupOrphanedChains).toHaveBeenCalledOnce();
    // 引数なしで呼ばれる（環境IDフィルタリングはIptablesManager側の責務）
    expect(mockCleanupOrphanedChains).toHaveBeenCalledWith();
  });

  // テスト3: クリーンアップ結果をINFOログに出力する
  it('クリーンアップ完了時にINFOログを出力する', async () => {
    await service.cleanupOrphanedRules();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('cleanup'),
      expect.anything()
    );
  });

  // テスト4: iptables利用不可時は警告ログのみ（エラーにしない）
  it('iptables利用不可時は警告ログのみでエラーにならない', async () => {
    mockCheckAvailability.mockResolvedValue(false);

    // エラーなく完了する
    await expect(service.cleanupOrphanedRules()).resolves.toBeUndefined();

    // 警告ログが出力される
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('not available'),
      expect.anything()
    );

    // cleanupOrphanedChainsは呼ばれない
    expect(mockCleanupOrphanedChains).not.toHaveBeenCalled();
  });

  // テスト5: cleanupOrphanedChains失敗時も警告ログのみ
  it('cleanupOrphanedChains失敗時も警告ログのみでエラーにならない', async () => {
    mockCleanupOrphanedChains.mockRejectedValue(new Error('iptables permission denied'));

    // エラーなく完了する
    await expect(service.cleanupOrphanedRules()).resolves.toBeUndefined();

    // 警告ログが出力される
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Failed'),
      expect.objectContaining({ error: expect.anything() })
    );
  });
});
