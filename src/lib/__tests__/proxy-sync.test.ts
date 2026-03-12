import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted でモック関数を先に初期化
const { mockIsFilterEnabled, mockSyncRules, mockGetActiveContainerIPs, mockGetDockerAdapterForEnvironment, mockLoggerWarn, mockLoggerInfo } =
  vi.hoisted(() => {
    return {
      mockIsFilterEnabled: vi.fn(),
      mockSyncRules: vi.fn(),
      mockGetActiveContainerIPs: vi.fn(),
      mockGetDockerAdapterForEnvironment: vi.fn(),
      mockLoggerWarn: vi.fn(),
      mockLoggerInfo: vi.fn(),
    };
  });

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    isFilterEnabled: (environmentId: string) => mockIsFilterEnabled(environmentId),
  },
}));

vi.mock('@/services/proxy-client', () => {
  const ProxyClient = vi.fn(function (this: unknown) {
    (this as any).syncRules = mockSyncRules;
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

import { syncProxyRulesIfNeeded } from '../proxy-sync';

describe('syncProxyRulesIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: DockerAdapterはgetActiveContainerIPsを持つアダプターを返す
    mockGetDockerAdapterForEnvironment.mockImplementation(() => ({
      getActiveContainerIPs: () => mockGetActiveContainerIPs(),
    }));
  });

  it('フィルタリング有効かつアクティブセッションありの場合、syncRulesが呼ばれる', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue(['192.168.1.10', '192.168.1.11']);
    mockSyncRules.mockResolvedValue(undefined);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockIsFilterEnabled).toHaveBeenCalledWith('env-uuid');
    expect(mockSyncRules).toHaveBeenCalledTimes(2);
    expect(mockSyncRules).toHaveBeenCalledWith('192.168.1.10', 'env-uuid');
    expect(mockSyncRules).toHaveBeenCalledWith('192.168.1.11', 'env-uuid');
  });

  it('フィルタリング無効の場合、syncRulesが呼ばれない', async () => {
    mockIsFilterEnabled.mockResolvedValue(false);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockIsFilterEnabled).toHaveBeenCalledWith('env-uuid');
    expect(mockSyncRules).not.toHaveBeenCalled();
  });

  it('アクティブセッションなし（containerIPなし）の場合、syncRulesが呼ばれない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue([]);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockIsFilterEnabled).toHaveBeenCalledWith('env-uuid');
    expect(mockSyncRules).not.toHaveBeenCalled();
  });

  it('DockerAdapterが取得できない場合、syncRulesが呼ばれない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetDockerAdapterForEnvironment.mockReturnValue(null);

    await syncProxyRulesIfNeeded('env-uuid');

    expect(mockSyncRules).not.toHaveBeenCalled();
  });

  it('同期失敗時はログ出力のみでエラーを伝播しない', async () => {
    mockIsFilterEnabled.mockResolvedValue(true);
    mockGetActiveContainerIPs.mockReturnValue(['192.168.1.10']);
    mockSyncRules.mockRejectedValue(new Error('Connection refused'));

    // エラーが伝播しないことを確認（reject されない）
    await expect(syncProxyRulesIfNeeded('env-uuid')).resolves.toBeUndefined();

    // 警告ログが出力されること
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Failed to sync proxy rules for container',
      expect.objectContaining({
        environmentId: 'env-uuid',
        containerIP: '192.168.1.10',
        error: 'Connection refused',
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
    expect(mockSyncRules).not.toHaveBeenCalled();
  });
});
