import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted でモック関数を先に初期化
const {
  mockIsFilterEnabled,
  mockGetRules,
  mockSetRules,
  mockGetActiveContainerIPs,
  mockGetDockerAdapterForEnvironment,
  mockLoggerWarn,
  mockLoggerInfo,
} = vi.hoisted(() => {
  return {
    mockIsFilterEnabled: vi.fn(),
    mockGetRules: vi.fn(),
    mockSetRules: vi.fn(),
    mockGetActiveContainerIPs: vi.fn(),
    mockGetDockerAdapterForEnvironment: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerInfo: vi.fn(),
  };
});

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    isFilterEnabled: (environmentId: string) => mockIsFilterEnabled(environmentId),
    getRules: (environmentId: string) => mockGetRules(environmentId),
  },
}));

vi.mock('@/services/proxy-client', () => {
  const ProxyClient = vi.fn(function (this: unknown) {
    (this as any).setRules = mockSetRules;
  });
  return { ProxyClient };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/services/adapter-factory', () => ({
  AdapterFactory: {
    getDockerAdapterForEnvironment: (environmentId: string) =>
      mockGetDockerAdapterForEnvironment(environmentId),
  },
}));

import { syncProxyRulesIfNeeded, syncRulesForContainer } from '../proxy-sync';
import { ProxyClient } from '@/services/proxy-client';

describe('syncRulesForContainer', () => {
  let client: InstanceType<typeof ProxyClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ProxyClient();
    mockSetRules.mockResolvedValue(undefined);
  });

  it('DBのルールをproxy形式に変換してsetRulesで送信する', async () => {
    const sourceIP = '172.20.0.3';
    const environmentId = 'env-001';

    mockGetRules.mockResolvedValueOnce([
      {
        id: 'rule-1',
        environment_id: environmentId,
        target: 'api.anthropic.com',
        port: 443,
        description: 'Claude API',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'rule-2',
        environment_id: environmentId,
        target: '*.github.com',
        port: 443,
        description: 'GitHub',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await syncRulesForContainer(client, sourceIP, environmentId);

    expect(mockGetRules).toHaveBeenCalledWith(environmentId);
    expect(mockSetRules).toHaveBeenCalledWith(sourceIP, [
      { host: 'api.anthropic.com', port: 443 },
      { host: '*.github.com', port: 443 },
    ]);
  });

  it('port=undefinedのルールもproxy形式でportを省略する', async () => {
    mockGetRules.mockResolvedValueOnce([
      {
        id: 'rule-1',
        environment_id: 'env-001',
        target: 'api.example.com',
        port: undefined,
        description: 'Example API',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await syncRulesForContainer(client, '172.20.0.3', 'env-001');

    expect(mockSetRules).toHaveBeenCalledWith('172.20.0.3', [
      { host: 'api.example.com' },
    ]);
  });

  it('同期時にログメッセージが出力される', async () => {
    mockGetRules.mockResolvedValueOnce([
      {
        id: 'rule-1',
        environment_id: 'env-001',
        target: 'api.example.com',
        port: 443,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await syncRulesForContainer(client, '172.20.0.3', 'env-001');

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('同期中'),
      expect.objectContaining({ sourceIP: '172.20.0.3', environmentId: 'env-001' })
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('完了'),
      expect.objectContaining({ sourceIP: '172.20.0.3', environmentId: 'env-001' })
    );
  });

  it('port=nullのルールはproxy形式でportを省略する', async () => {
    mockGetRules.mockResolvedValueOnce([
      {
        id: 'rule-1',
        environment_id: 'env-001',
        target: 'api.anthropic.com',
        port: null,
        description: 'Claude API',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await syncRulesForContainer(client, '172.20.0.3', 'env-001');

    expect(mockSetRules).toHaveBeenCalledWith('172.20.0.3', [
      { host: 'api.anthropic.com' },
    ]);
  });

  it('enabled=falseのルールはproxy同期から除外する', async () => {
    mockGetRules.mockResolvedValueOnce([
      {
        id: 'rule-1',
        environment_id: 'env-001',
        target: 'api.anthropic.com',
        port: 443,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'rule-2',
        environment_id: 'env-001',
        target: 'blocked.example.com',
        port: 80,
        enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await syncRulesForContainer(client, '172.20.0.3', 'env-001');

    expect(mockSetRules).toHaveBeenCalledWith('172.20.0.3', [
      { host: 'api.anthropic.com', port: 443 },
    ]);
  });
});

describe('syncProxyRulesIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: DockerAdapterはgetActiveContainerIPsを持つアダプターを返す
    mockGetDockerAdapterForEnvironment.mockImplementation(() => ({
      getActiveContainerIPs: () => mockGetActiveContainerIPs(),
    }));
    mockSetRules.mockResolvedValue(undefined);
    mockGetRules.mockResolvedValue([]);
  });

  it('フィルタリング有効かつアクティブセッションありの場合、setRulesが呼ばれる', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue(['192.168.1.10', '192.168.1.11']);
    mockGetRules.mockResolvedValue([
      { id: 'r1', target: 'example.com', port: 443, enabled: true },
    ]);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockIsFilterEnabled).toHaveBeenCalledWith('env-uuid');
    expect(mockSetRules).toHaveBeenCalledTimes(2);
    // 各コンテナの同期成功ログが出力される
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('synced'),
      expect.objectContaining({ environmentId: 'env-uuid', containerIP: '192.168.1.10' })
    );
  });

  it('フィルタリング無効の場合、setRulesが呼ばれない', async () => {
    // フィルタ無効化時は即returnする設計。
    // 既存コンテナのproxyルールはそのまま残るが、internalネットワーク+proxy環境で
    // 起動済みのコンテナにはルール削除よりも維持が安全（削除するとproxy側デフォルト拒否で通信不能になる）。
    // 新規コンテナはフィルタ無効のためdefaultネットワークで起動される。
    mockIsFilterEnabled.mockResolvedValue(false);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockIsFilterEnabled).toHaveBeenCalledWith('env-uuid');
    expect(mockSetRules).not.toHaveBeenCalled();
  });

  it('アクティブセッションなし（containerIPなし）の場合、setRulesが呼ばれない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue([]);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockIsFilterEnabled).toHaveBeenCalledWith('env-uuid');
    expect(mockSetRules).not.toHaveBeenCalled();
  });

  it('containerIPsがnullの場合、setRulesが呼ばれない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue(null);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockSetRules).not.toHaveBeenCalled();
  });

  it('DockerAdapterが取得できない場合、setRulesが呼ばれない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetDockerAdapterForEnvironment.mockReturnValue(null);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockSetRules).not.toHaveBeenCalled();
  });

  it('同期失敗時はログ出力のみでエラーを伝播しない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue(['192.168.1.10']);
    mockGetRules.mockRejectedValue(new Error('DB error'));

    // エラーが伝播しないことを確認（reject されない）
    await expect(syncProxyRulesIfNeeded('env-uuid')).resolves.toBeUndefined();

    // 警告ログが出力されること
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Failed to sync proxy rules for container',
      expect.objectContaining({
        environmentId: 'env-uuid',
        containerIP: '192.168.1.10',
      })
    );
  });

  it('isFilterEnabled自体が失敗した場合はログ出力のみでエラーを伝播しない', async () => {
    mockIsFilterEnabled.mockRejectedValue(new Error('DB error'));

    await expect(syncProxyRulesIfNeeded('env-uuid')).resolves.toBeUndefined();

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Failed to sync proxy rules',
      expect.objectContaining({
        environmentId: 'env-uuid',
        error: 'DB error',
      })
    );
    expect(mockSetRules).not.toHaveBeenCalled();
  });
});
