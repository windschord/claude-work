import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted で変数をホイスティング
const {
  mockCreateContainer,
  mockGetContainer,
  mockListContainers,
  mockCreateNetwork,
  mockGetNetwork,
  mockDbRun,
  mockDbAll,
  mockDbGet,
} = vi.hoisted(() => ({
  mockCreateContainer: vi.fn(),
  mockGetContainer: vi.fn(),
  mockListContainers: vi.fn(),
  mockCreateNetwork: vi.fn(),
  mockGetNetwork: vi.fn(),
  mockDbRun: vi.fn(),
  mockDbAll: vi.fn().mockReturnValue([]),
  mockDbGet: vi.fn(),
}));

// Mock DockerClient
vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => ({
      createContainer: mockCreateContainer,
      getContainer: mockGetContainer,
      listContainers: mockListContainers,
      getDockerInstance: () => ({
        createNetwork: mockCreateNetwork,
        getNetwork: mockGetNetwork,
        listNetworks: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: mockDbAll,
          get: mockDbGet,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: mockDbRun,
        }),
      }),
    }),
  },
  schema: {
    sessions: {
      id: 'id',
      chrome_container_id: 'chrome_container_id',
      chrome_debug_port: 'chrome_debug_port',
    },
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  isNotNull: vi.fn(),
}));

import { ChromeSidecarService } from '../chrome-sidecar-service';
import type { ChromeSidecarConfig } from '@/types/environment';

describe('ChromeSidecarService', () => {
  let service: ChromeSidecarService;
  const testSessionId = 'test-session-123';
  const testConfig: ChromeSidecarConfig = {
    enabled: true,
    image: 'chromium/headless-shell',
    tag: '131.0.6778.204',
  };

  // Mock container object
  const mockContainer = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '9222/tcp': [{ HostIp: '127.0.0.1', HostPort: '49152' }],
        },
      },
    }),
  };

  // Mock network object
  const mockNetwork = {
    remove: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ Containers: {} }),
  };

  // Mock fetch for CDP health check
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChromeSidecarService();
    mockCreateContainer.mockResolvedValue(mockContainer);
    mockGetContainer.mockReturnValue(mockContainer);
    mockCreateNetwork.mockResolvedValue(mockNetwork);
    mockGetNetwork.mockReturnValue(mockNetwork);
    mockListContainers.mockResolvedValue([]);
    mockDbAll.mockReturnValue([]);

    // CDPヘルスチェック用のfetchモック
    mockFetch.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getInstance', () => {
    it('シングルトンインスタンスを返すこと', () => {
      const instance1 = ChromeSidecarService.getInstance();
      const instance2 = ChromeSidecarService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('startSidecar', () => {
    it('正常系: サイドカー起動成功 - ネットワーク作成 -> コンテナ作成 -> 起動 -> ポート取得 -> CDPヘルスチェック成功', async () => {
      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(true);
      expect(result.containerName).toBe(`cw-chrome-${testSessionId}`);
      expect(result.networkName).toBe(`cw-net-${testSessionId}`);
      expect(result.debugPort).toBe(49152);
      expect(result.browserUrl).toBe(`ws://cw-chrome-${testSessionId}:9222`);

      // ネットワーク作成が先に呼ばれること
      expect(mockCreateNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: `cw-net-${testSessionId}`,
          Driver: 'bridge',
        })
      );

      // コンテナ作成が呼ばれること
      expect(mockCreateContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `cw-chrome-${testSessionId}`,
          Image: `${testConfig.image}:${testConfig.tag}`,
        })
      );

      // コンテナ起動が呼ばれること
      expect(mockContainer.start).toHaveBeenCalled();

      // CDPヘルスチェックがHTTP GETで行われること
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:49152/json/version',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('正常系: コンテナ作成オプションに正しいセキュリティ設定が含まれること', async () => {
      await service.startSidecar(testSessionId, testConfig);

      expect(mockCreateContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            CapDrop: ['ALL'],
            SecurityOpt: ['no-new-privileges'],
            Memory: 512 * 1024 * 1024,
            AutoRemove: true,
          }),
          Labels: expect.objectContaining({
            'claude-work.session-id': testSessionId,
            'claude-work.chrome-sidecar': 'true',
            'claude-work.managed-by': 'claude-work',
          }),
        })
      );
    });

    it('正常系: ポートマッピングからdebugPort取得', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: {
          Ports: {
            '9222/tcp': [{ HostIp: '127.0.0.1', HostPort: '55555' }],
          },
        },
      });

      const result = await service.startSidecar(testSessionId, testConfig);
      expect(result.debugPort).toBe(55555);
      expect(result.browserUrl).toBe(`ws://cw-chrome-${testSessionId}:9222`);
    });

    it('異常系: ネットワーク作成失敗', async () => {
      mockCreateNetwork.mockRejectedValueOnce(new Error('Network creation failed'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network creation failed');
      // コンテナ作成が呼ばれないこと
      expect(mockCreateContainer).not.toHaveBeenCalled();
    });

    it('異常系: CDPヘルスチェックタイムアウト（fetchが常に失敗）', async () => {
      // ポート取得は成功するが、CDPのHTTP GETが常に失敗
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    }, 10000);

    it('異常系: ポートマッピング取得失敗時はCDPヘルスチェックも失敗すること', async () => {
      // ポートが取得できない
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: { Ports: {} },
      });

      const result = await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      // debugPortがundefined -> waitForCDPがfalseを返す
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    }, 10000);

    it('異常系: コンテナ起動失敗時にコンテナ削除とネットワーク削除が行われること', async () => {
      mockContainer.start.mockRejectedValueOnce(new Error('Container start failed'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container start failed');
      // コンテナ強制削除が呼ばれること（AutoRemoveは未起動コンテナには効かない）
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
      // ネットワーク削除が呼ばれること（ロールバック）
      expect(mockNetwork.remove).toHaveBeenCalled();
    });
  });

  describe('stopSidecar', () => {
    it('正常系: サイドカー停止成功', async () => {
      await service.stopSidecar(
        testSessionId,
        `cw-chrome-${testSessionId}`
      );

      // コンテナ停止
      expect(mockContainer.stop).toHaveBeenCalled();
      // ネットワーク削除
      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it('異常系: コンテナ停止失敗時に例外がスローされないこと', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('Container stop failed'));

      await expect(
        service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`)
      ).resolves.not.toThrow();
    });

    it('異常系: ネットワーク削除失敗時に例外がスローされないこと', async () => {
      mockNetwork.remove.mockRejectedValueOnce(new Error('Network remove failed'));

      await expect(
        service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`)
      ).resolves.not.toThrow();
    });
  });

  describe('connectClaudeContainer', () => {
    it('正常系: Claude Codeコンテナをネットワークに接続', async () => {
      const claudeContainerName = 'cw-session-test';
      const networkName = `cw-net-${testSessionId}`;

      await service.connectClaudeContainer(claudeContainerName, networkName);

      expect(mockNetwork.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          Container: claudeContainerName,
        })
      );
    });

    it('異常系: 接続失敗時に例外がスローされること', async () => {
      mockNetwork.connect.mockRejectedValueOnce(new Error('Connect failed'));

      await expect(
        service.connectClaudeContainer('container', 'network')
      ).rejects.toThrow('Connect failed');
    });
  });

  describe('cleanupOrphaned', () => {
    it('Phase 1: DBベースのクリーンアップ - 停止済みコンテナ', async () => {
      mockDbAll.mockReturnValueOnce([
        { id: 'session-1', chrome_container_id: 'cw-chrome-session-1' },
      ]);

      // コンテナは存在しない（既にAutoRemoveで削除済み）
      const deadContainer = {
        inspect: vi.fn().mockRejectedValue(new Error('Not found')),
        stop: vi.fn(),
      };
      mockGetContainer.mockReturnValueOnce(deadContainer);

      await service.cleanupOrphaned();

      // DB更新が呼ばれること
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('Phase 1: 実行中コンテナはスキップすること', async () => {
      mockDbAll.mockReturnValueOnce([
        { id: 'session-1', chrome_container_id: 'cw-chrome-session-1' },
      ]);

      const runningContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
        }),
        stop: vi.fn(),
      };
      mockGetContainer.mockReturnValueOnce(runningContainer);

      await service.cleanupOrphaned();

      // DB更新が呼ばれないこと
      expect(mockDbRun).not.toHaveBeenCalled();
    });

    it('Phase 2: ラベルベースのクリーンアップ - コンテナ停止とネットワーク削除', async () => {
      // Phase 1: DBには何もない
      mockDbAll.mockReturnValueOnce([]);

      // Phase 2: ラベル付きのorphanedコンテナが存在
      mockListContainers.mockResolvedValueOnce([
        {
          Id: 'orphan-container-id',
          Names: ['/cw-chrome-orphan'],
          Labels: {
            'claude-work.session-id': 'non-existent-session',
            'claude-work.chrome-sidecar': 'true',
          },
        },
      ]);

      // DBにセッションが存在しない
      mockDbGet.mockReturnValueOnce(undefined);

      const orphanContainer = {
        stop: vi.fn().mockResolvedValue(undefined),
      };
      mockGetContainer.mockReturnValueOnce(orphanContainer);

      await service.cleanupOrphaned();

      // コンテナ停止が呼ばれること
      expect(orphanContainer.stop).toHaveBeenCalled();
      // ネットワーク削除も呼ばれること
      expect(mockNetwork.remove).toHaveBeenCalled();
    });
  });

  describe('getActiveSidecarCount', () => {
    it('アクティブサイドカー数取得', async () => {
      mockListContainers.mockResolvedValueOnce([
        { Id: 'container-1', Labels: { 'claude-work.chrome-sidecar': 'true' } },
        { Id: 'container-2', Labels: { 'claude-work.chrome-sidecar': 'true' } },
      ]);

      const count = await service.getActiveSidecarCount();
      expect(count).toBe(2);

      expect(mockListContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.any(String),
        })
      );
    });
  });
});
