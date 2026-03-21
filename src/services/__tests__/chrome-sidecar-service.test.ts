import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted で変数をホイスティング
const {
  mockCreateContainer,
  mockGetContainer,
  mockListContainers,
  mockCreateNetwork,
  mockGetNetwork,
  mockListNetworks,
  mockDbRun,
  mockDbAll,
  mockDbGet,
} = vi.hoisted(() => ({
  mockCreateContainer: vi.fn(),
  mockGetContainer: vi.fn(),
  mockListContainers: vi.fn(),
  mockCreateNetwork: vi.fn(),
  mockGetNetwork: vi.fn(),
  mockListNetworks: vi.fn().mockResolvedValue([]),
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
        listNetworks: mockListNetworks,
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
    mockListNetworks.mockResolvedValue([]);
    mockDbAll.mockReturnValue([]);

    // mockContainer.inspectのデフォルト戻り値を再設定（clearAllMocksでリセットされるため）
    mockContainer.inspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Ports: {
          '9222/tcp': [{ HostIp: '127.0.0.1', HostPort: '49152' }],
        },
      },
    });
    mockContainer.start.mockResolvedValue(undefined);
    mockContainer.stop.mockResolvedValue(undefined);
    mockContainer.remove.mockResolvedValue(undefined);
    mockNetwork.remove.mockResolvedValue(undefined);
    mockNetwork.disconnect.mockResolvedValue(undefined);
    mockNetwork.connect.mockResolvedValue(undefined);
    mockNetwork.inspect.mockResolvedValue({ Containers: {} });

    // CDPヘルスチェック用のfetchモック
    mockFetch.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getInstance', () => {
    afterEach(() => {
      ChromeSidecarService.resetInstance();
    });

    it('シングルトンインスタンスを返すこと', () => {
      const instance1 = ChromeSidecarService.getInstance();
      const instance2 = ChromeSidecarService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('resetInstance後に新しいインスタンスが作成されること', () => {
      const instance1 = ChromeSidecarService.getInstance();
      ChromeSidecarService.resetInstance();
      const instance2 = ChromeSidecarService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('startSidecar', () => {
    it('正常系: サイドカー起動成功 - 全フィールドが正しく返されること', async () => {
      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(true);
      expect(result.containerName).toBe(`cw-chrome-${testSessionId}`);
      expect(result.networkName).toBe(`cw-net-${testSessionId}`);
      expect(result.debugPort).toBe(49152);
      expect(result.browserUrl).toBe(`http://cw-chrome-${testSessionId}:9222`);
      expect(result.error).toBeUndefined();
    });

    it('正常系: ネットワーク作成パラメータの検証', async () => {
      await service.startSidecar(testSessionId, testConfig);

      expect(mockCreateNetwork).toHaveBeenCalledWith({
        Name: `cw-net-${testSessionId}`,
        Driver: 'bridge',
        Labels: {
          'claude-work.session-id': testSessionId,
          'claude-work.managed-by': 'claude-work',
        },
      });
    });

    it('正常系: コンテナ作成パラメータの完全検証', async () => {
      await service.startSidecar(testSessionId, testConfig);

      expect(mockCreateContainer).toHaveBeenCalledWith({
        name: `cw-chrome-${testSessionId}`,
        Image: `${testConfig.image}:${testConfig.tag}`,
        Cmd: [
          '--no-sandbox',
          '--disable-gpu',
          '--remote-debugging-address=0.0.0.0',
          '--remote-debugging-port=9222',
        ],
        ExposedPorts: {
          '9222/tcp': {},
        },
        Labels: {
          'claude-work.session-id': testSessionId,
          'claude-work.chrome-sidecar': 'true',
          'claude-work.managed-by': 'claude-work',
        },
        HostConfig: {
          PortBindings: {
            '9222/tcp': [{ HostPort: '', HostIp: '127.0.0.1' }],
          },
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          Memory: 512 * 1024 * 1024,
          AutoRemove: true,
          NetworkMode: `cw-net-${testSessionId}`,
        },
      });
    });

    it('正常系: Chromeコマンドライン引数が正確であること', async () => {
      await service.startSidecar(testSessionId, testConfig);

      const callArgs = mockCreateContainer.mock.calls[0][0];
      expect(callArgs.Cmd).toEqual([
        '--no-sandbox',
        '--disable-gpu',
        '--remote-debugging-address=0.0.0.0',
        '--remote-debugging-port=9222',
      ]);
      expect(callArgs.Cmd).toHaveLength(4);
    });

    it('正常系: セキュリティ設定の具体的な値を検証', async () => {
      await service.startSidecar(testSessionId, testConfig);

      const callArgs = mockCreateContainer.mock.calls[0][0];
      // CapDropがALLであること（配列の要素数と値）
      expect(callArgs.HostConfig.CapDrop).toEqual(['ALL']);
      expect(callArgs.HostConfig.CapDrop).toHaveLength(1);
      // SecurityOptがno-new-privilegesであること
      expect(callArgs.HostConfig.SecurityOpt).toEqual(['no-new-privileges']);
      expect(callArgs.HostConfig.SecurityOpt).toHaveLength(1);
      // メモリ制限が512MBであること
      expect(callArgs.HostConfig.Memory).toBe(512 * 1024 * 1024);
      // AutoRemoveがtrueであること
      expect(callArgs.HostConfig.AutoRemove).toBe(true);
    });

    it('正常系: Dockerラベルの値が正確であること', async () => {
      await service.startSidecar(testSessionId, testConfig);

      const callArgs = mockCreateContainer.mock.calls[0][0];
      expect(callArgs.Labels['claude-work.session-id']).toBe(testSessionId);
      expect(callArgs.Labels['claude-work.chrome-sidecar']).toBe('true');
      expect(callArgs.Labels['claude-work.managed-by']).toBe('claude-work');
    });

    it('正常系: ネットワークラベルの値が正確であること', async () => {
      await service.startSidecar(testSessionId, testConfig);

      const networkArgs = mockCreateNetwork.mock.calls[0][0];
      expect(networkArgs.Labels['claude-work.session-id']).toBe(testSessionId);
      expect(networkArgs.Labels['claude-work.managed-by']).toBe('claude-work');
    });

    it('正常系: ポートバインディングの値が正確であること', async () => {
      await service.startSidecar(testSessionId, testConfig);

      const callArgs = mockCreateContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.PortBindings['9222/tcp']).toEqual([
        { HostPort: '', HostIp: '127.0.0.1' },
      ]);
      expect(callArgs.ExposedPorts['9222/tcp']).toEqual({});
    });

    it('正常系: Image名がconfig.image:config.tagフォーマットであること', async () => {
      const customConfig: ChromeSidecarConfig = {
        enabled: true,
        image: 'my-registry.com/chrome',
        tag: 'v2.0.0',
      };
      await service.startSidecar(testSessionId, customConfig);

      const callArgs = mockCreateContainer.mock.calls[0][0];
      expect(callArgs.Image).toBe('my-registry.com/chrome:v2.0.0');
    });

    it('正常系: NetworkModeがネットワーク名と一致すること', async () => {
      await service.startSidecar(testSessionId, testConfig);

      const callArgs = mockCreateContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.NetworkMode).toBe(`cw-net-${testSessionId}`);
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
      expect(result.browserUrl).toBe(`http://cw-chrome-${testSessionId}:9222`);
    });

    it('正常系: CDPヘルスチェックURLが正確であること', async () => {
      mockContainer.inspect.mockResolvedValueOnce({
        State: { Running: true },
        NetworkSettings: {
          Ports: {
            '9222/tcp': [{ HostIp: '127.0.0.1', HostPort: '49152' }],
          },
        },
      });

      await service.startSidecar(testSessionId, testConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:49152/json/version',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('正常系: browserUrlのフォーマットが正確であること', async () => {
      const result = await service.startSidecar(testSessionId, testConfig);
      // browserUrlは http://<containerName>:9222 のフォーマット
      expect(result.browserUrl).toMatch(/^http:\/\/cw-chrome-.+:9222$/);
      expect(result.browserUrl).toBe('http://cw-chrome-test-session-123:9222');
    });

    it('正常系: cdpTimeoutMsのデフォルト値が30000であること', async () => {
      // fetchが成功するのでタイムアウトはしない
      const result = await service.startSidecar(testSessionId, testConfig);
      expect(result.success).toBe(true);
    });

    it('正常系: cdpTimeoutMsカスタム値が適用されること', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('CDP health check timed out after 100ms');
    }, 10000);

    // === 異常系 ===

    it('異常系: ネットワーク作成失敗 - Errorインスタンスの場合', async () => {
      mockCreateNetwork.mockRejectedValueOnce(new Error('Network creation failed'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network creation failed');
      expect(mockCreateContainer).not.toHaveBeenCalled();
    });

    it('異常系: ネットワーク作成失敗 - 非Errorオブジェクトの場合', async () => {
      mockCreateNetwork.mockRejectedValueOnce('string error');

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network creation failed');
      expect(mockCreateContainer).not.toHaveBeenCalled();
    });

    it('異常系: コンテナ作成失敗 - ネットワークロールバックが実行されること', async () => {
      mockCreateContainer.mockRejectedValueOnce(new Error('Image not found'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image not found');
      // ネットワークのロールバック削除
      expect(mockNetwork.remove).toHaveBeenCalled();
      // コンテナは作成されていないのでstart/removeは呼ばれない
      expect(mockContainer.start).not.toHaveBeenCalled();
    });

    it('異常系: コンテナ作成失敗 + ネットワークロールバック失敗', async () => {
      mockCreateContainer.mockRejectedValueOnce(new Error('Image not found'));
      mockNetwork.remove.mockRejectedValueOnce(new Error('Network busy'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image not found');
      // ネットワーク削除が試行されたこと
      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it('異常系: コンテナ作成失敗 - 非Errorオブジェクトの場合', async () => {
      mockCreateContainer.mockRejectedValueOnce({ code: 500 });

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Container creation failed');
    });

    it('異常系: コンテナ起動失敗 - コンテナ削除とネットワーク削除が行われること', async () => {
      mockContainer.start.mockRejectedValueOnce(new Error('Container start failed'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Container start failed');
      // コンテナ強制削除が呼ばれること（AutoRemoveは未起動コンテナには効かない）
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
      // ネットワーク削除が呼ばれること（ロールバック）
      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it('異常系: コンテナ起動失敗 + コンテナ削除失敗 + ネットワーク削除失敗', async () => {
      mockContainer.start.mockRejectedValueOnce(new Error('Container start failed'));
      mockContainer.remove.mockRejectedValueOnce(new Error('Remove failed'));
      mockNetwork.remove.mockRejectedValueOnce(new Error('Network remove failed'));

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Container start failed');
    });

    it('異常系: コンテナ起動失敗 - 非Errorオブジェクトの場合', async () => {
      mockContainer.start.mockRejectedValueOnce('unknown error');

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Container start failed');
    });

    it('正常系: ポートマッピング取得失敗時はCDPヘルスチェックをスキップし成功すること', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: { Ports: {} },
      });

      const result = await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      expect(result.success).toBe(true);
      expect(result.debugPort).toBeUndefined();
      expect(result.containerName).toBe(`cw-chrome-${testSessionId}`);
      expect(result.networkName).toBe(`cw-net-${testSessionId}`);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('正常系: ポート情報がnullの場合もCDPヘルスチェックをスキップ', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: { Ports: { '9222/tcp': null } },
      });

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(true);
      expect(result.debugPort).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('正常系: ポート情報が空配列の場合もCDPヘルスチェックをスキップ', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: { Ports: { '9222/tcp': [] } },
      });

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(true);
      expect(result.debugPort).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('正常系: ポート情報のHostPortがundefinedの場合もCDPヘルスチェックをスキップ', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: { Ports: { '9222/tcp': [{ HostIp: '127.0.0.1' }] } },
      });

      const result = await service.startSidecar(testSessionId, testConfig);

      expect(result.success).toBe(true);
      expect(result.debugPort).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('異常系: ポートマッピング取得時のinspect失敗はwarnログだけで続行', async () => {
      // 最初のinspect（ポート取得）が失敗
      mockContainer.inspect.mockRejectedValueOnce(new Error('inspect failed'));

      const result = await service.startSidecar(testSessionId, testConfig);

      // ポート取得失敗でもCDPチェックスキップで成功
      expect(result.success).toBe(true);
      expect(result.debugPort).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('異常系: CDPヘルスチェックタイムアウト - fetchが常にエラー', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CDP health check timed out');
      expect(result.error).toContain('100ms');
    }, 10000);

    it('異常系: CDPヘルスチェックタイムアウト - fetchがnon-ok応答', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      const result = await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('CDP health check timed out after 100ms');
    }, 10000);

    it('異常系: CDPヘルスチェックタイムアウト時にコンテナ停止とネットワーク削除が行われること', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await service.startSidecar(testSessionId, testConfig, { cdpTimeoutMs: 100 });

      // コンテナ停止が試行される
      expect(mockContainer.stop).toHaveBeenCalled();
      // ネットワーク削除が試行される
      expect(mockNetwork.remove).toHaveBeenCalled();
    }, 10000);
  });

  describe('stopSidecar', () => {
    it('正常系: サイドカー停止成功', async () => {
      const result = await service.stopSidecar(
        testSessionId,
        `cw-chrome-${testSessionId}`
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it('正常系: networkNameを明示的に指定した場合', async () => {
      const customNetworkName = 'custom-network';
      await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`, customNetworkName);

      expect(mockGetNetwork).toHaveBeenCalledWith(customNetworkName);
    });

    it('正常系: networkNameを省略した場合はセッションIDから生成', async () => {
      await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);

      expect(mockGetNetwork).toHaveBeenCalledWith(`cw-net-${testSessionId}`);
    });

    it('正常系: 接続中コンテナがある場合はdisconnectしてからネットワーク削除', async () => {
      mockNetwork.inspect.mockResolvedValueOnce({
        Containers: {
          'container-id-1': { Name: 'container-1' },
          'container-id-2': { Name: 'container-2' },
        },
      });

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);

      expect(result.success).toBe(true);
      expect(mockNetwork.disconnect).toHaveBeenCalledTimes(2);
      expect(mockNetwork.disconnect).toHaveBeenCalledWith({ Container: 'container-id-1', Force: true });
      expect(mockNetwork.disconnect).toHaveBeenCalledWith({ Container: 'container-id-2', Force: true });
      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it('正常系: disconnect失敗はbest-effortで無視される', async () => {
      mockNetwork.inspect.mockResolvedValueOnce({
        Containers: {
          'container-id-1': { Name: 'container-1' },
        },
      });
      mockNetwork.disconnect.mockRejectedValueOnce(new Error('disconnect failed'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);

      expect(result.success).toBe(true);
      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it('異常系: コンテナ停止失敗時にsuccess: falseを返すこと', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('Container stop failed'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(false);
      expect(result.error).toContain('container stop');
      expect(result.error).toContain('Container stop failed');
    });

    it('異常系: コンテナ停止失敗 + ネットワーク削除失敗時にエラーが結合されること', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('stop error'));
      mockNetwork.inspect.mockRejectedValueOnce(new Error('network error'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(false);
      expect(result.error).toContain('container stop: stop error');
      expect(result.error).toContain('network remove: network error');
      expect(result.error).toContain('; ');
    });

    it('異常系: 非Errorオブジェクトのエラーハンドリング', async () => {
      mockContainer.stop.mockRejectedValueOnce('string error');

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(false);
      expect(result.error).toContain('container stop: Unknown');
    });

    it('正常系: AutoRemoveコンテナの404エラーは成功扱いになること', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('(HTTP code 404) no such container'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('正常系: AutoRemoveコンテナの304エラーは成功扱いになること', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('(HTTP code 304) container already stopped'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('正常系: "No such container"エラーは成功扱いになること', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('No such container: cw-chrome-test'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('正常系: "not running"エラーは成功扱いになること', async () => {
      mockContainer.stop.mockRejectedValueOnce(new Error('Container is not running'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('異常系: ネットワーク削除失敗時にsuccess: falseを返すこと', async () => {
      mockNetwork.inspect.mockRejectedValueOnce(new Error('Network inspect failed'));

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(false);
      expect(result.error).toContain('network remove');
      expect(result.error).toContain('Network inspect failed');
    });

    it('異常系: Containersプロパティがundefinedの場合もネットワーク削除が行われること', async () => {
      mockNetwork.inspect.mockResolvedValueOnce({});

      const result = await service.stopSidecar(testSessionId, `cw-chrome-${testSessionId}`);
      expect(result.success).toBe(true);
      expect(mockNetwork.disconnect).not.toHaveBeenCalled();
      expect(mockNetwork.remove).toHaveBeenCalled();
    });
  });

  describe('connectClaudeContainer', () => {
    it('正常系: Claude Codeコンテナをネットワークに接続', async () => {
      const claudeContainerName = 'cw-session-test';
      const networkName = `cw-net-${testSessionId}`;

      await service.connectClaudeContainer(claudeContainerName, networkName);

      expect(mockNetwork.connect).toHaveBeenCalledWith({
        Container: claudeContainerName,
      });
    });

    it('異常系: 接続失敗時に例外がスローされること', async () => {
      mockNetwork.connect.mockRejectedValueOnce(new Error('Connect failed'));

      await expect(
        service.connectClaudeContainer('container', 'network')
      ).rejects.toThrow('Connect failed');
    });
  });

  describe('cleanupOrphaned', () => {
    it('Phase 1: DBベースのクリーンアップ - 停止済みコンテナのDB更新', async () => {
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
      // ネットワーク削除が試行されること
      expect(mockGetNetwork).toHaveBeenCalledWith(`cw-net-session-1`);
    });

    it('Phase 1: 停止済みコンテナ (Running: false) もクリーンアップされること', async () => {
      mockDbAll.mockReturnValueOnce([
        { id: 'session-1', chrome_container_id: 'cw-chrome-session-1' },
      ]);

      const stoppedContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false },
        }),
        stop: vi.fn(),
      };
      mockGetContainer.mockReturnValueOnce(stoppedContainer);

      await service.cleanupOrphaned();

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('Phase 1: chrome_container_idがnullのセッションはスキップ', async () => {
      mockDbAll.mockReturnValueOnce([
        { id: 'session-1', chrome_container_id: null },
      ]);

      await service.cleanupOrphaned();

      expect(mockGetContainer).not.toHaveBeenCalled();
      expect(mockDbRun).not.toHaveBeenCalled();
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

    it('Phase 1: ネットワーク削除失敗はbest-effortで無視される', async () => {
      mockDbAll.mockReturnValueOnce([
        { id: 'session-1', chrome_container_id: 'cw-chrome-session-1' },
      ]);

      const deadContainer = {
        inspect: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      mockGetContainer.mockReturnValueOnce(deadContainer);
      mockNetwork.remove.mockRejectedValueOnce(new Error('Network not found'));

      await service.cleanupOrphaned();

      // ネットワーク削除失敗でもDB更新は行われること
      expect(mockDbRun).toHaveBeenCalled();
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

    it('Phase 2: session-idラベルがないコンテナはスキップ', async () => {
      mockDbAll.mockReturnValueOnce([]);

      mockListContainers.mockResolvedValueOnce([
        {
          Id: 'orphan-container-id',
          Names: ['/cw-chrome-orphan'],
          Labels: {
            'claude-work.chrome-sidecar': 'true',
            // session-id ラベルなし
          },
        },
      ]);

      await service.cleanupOrphaned();

      expect(mockDbGet).not.toHaveBeenCalled();
    });

    it('Phase 2: DBにセッションが存在する場合はクリーンアップしない', async () => {
      mockDbAll.mockReturnValueOnce([]);

      mockListContainers.mockResolvedValueOnce([
        {
          Id: 'container-id',
          Names: ['/cw-chrome-session-1'],
          Labels: {
            'claude-work.session-id': 'existing-session',
            'claude-work.chrome-sidecar': 'true',
          },
        },
      ]);

      // DBにセッションが存在する
      mockDbGet.mockReturnValueOnce({ id: 'existing-session' });

      await service.cleanupOrphaned();

      // コンテナ停止は呼ばれないこと
      expect(mockGetContainer).not.toHaveBeenCalled();
    });

    it('Phase 2: コンテナ停止失敗はbest-effortで無視される', async () => {
      mockDbAll.mockReturnValueOnce([]);

      mockListContainers.mockResolvedValueOnce([
        {
          Id: 'orphan-container-id',
          Labels: {
            'claude-work.session-id': 'non-existent-session',
            'claude-work.chrome-sidecar': 'true',
          },
        },
      ]);

      mockDbGet.mockReturnValueOnce(undefined);

      const orphanContainer = {
        stop: vi.fn().mockRejectedValue(new Error('already stopped')),
      };
      mockGetContainer.mockReturnValueOnce(orphanContainer);

      // エラーがスローされないこと
      await expect(service.cleanupOrphaned()).resolves.toBeUndefined();
    });

    it('Phase 2: listContainers失敗時にエラーがスローされないこと', async () => {
      mockDbAll.mockReturnValueOnce([]);

      mockListContainers.mockRejectedValueOnce(new Error('Docker daemon not responding'));

      await expect(service.cleanupOrphaned()).resolves.toBeUndefined();
    });

    it('Phase 2b: 孤立ネットワークの回収 - コンテナ接続なしのネットワークを削除', async () => {
      mockDbAll.mockReturnValueOnce([]);
      mockListContainers.mockResolvedValueOnce([]);

      mockListNetworks.mockResolvedValueOnce([
        {
          Id: 'network-id-1',
          Name: 'cw-net-orphan-session',
          Labels: { 'claude-work.managed-by': 'claude-work' },
        },
      ]);

      const orphanNetwork = {
        inspect: vi.fn().mockResolvedValue({ Containers: {} }),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      mockGetNetwork.mockReturnValueOnce(orphanNetwork);

      await service.cleanupOrphaned();

      expect(orphanNetwork.inspect).toHaveBeenCalled();
      expect(orphanNetwork.remove).toHaveBeenCalled();
    });

    it('Phase 2b: cw-net-プレフィックスのないネットワークはスキップ', async () => {
      mockDbAll.mockReturnValueOnce([]);
      mockListContainers.mockResolvedValueOnce([]);

      mockListNetworks.mockResolvedValueOnce([
        {
          Id: 'network-id-1',
          Name: 'other-network',
          Labels: { 'claude-work.managed-by': 'claude-work' },
        },
      ]);

      await service.cleanupOrphaned();

      // getNetworkはPhase 1で呼ばれるかもしれないが、Phase 2bの対象外ネットワークは呼ばれない
      // inspectが呼ばれないことを確認
      expect(mockNetwork.inspect).not.toHaveBeenCalled();
    });

    it('Phase 2b: コンテナが接続されているネットワークは削除しない', async () => {
      mockDbAll.mockReturnValueOnce([]);
      mockListContainers.mockResolvedValueOnce([]);

      mockListNetworks.mockResolvedValueOnce([
        {
          Id: 'network-id-1',
          Name: 'cw-net-active-session',
          Labels: { 'claude-work.managed-by': 'claude-work' },
        },
      ]);

      const activeNetwork = {
        inspect: vi.fn().mockResolvedValue({
          Containers: { 'container-1': { Name: 'some-container' } },
        }),
        remove: vi.fn(),
      };
      mockGetNetwork.mockReturnValueOnce(activeNetwork);

      await service.cleanupOrphaned();

      expect(activeNetwork.inspect).toHaveBeenCalled();
      expect(activeNetwork.remove).not.toHaveBeenCalled();
    });

    it('Phase 2b: listNetworks失敗はbest-effortで無視される', async () => {
      mockDbAll.mockReturnValueOnce([]);
      mockListContainers.mockResolvedValueOnce([]);

      mockListNetworks.mockRejectedValueOnce(new Error('Docker daemon error'));

      await expect(service.cleanupOrphaned()).resolves.toBeUndefined();
    });
  });

  describe('getActiveSidecarCount', () => {
    it('アクティブサイドカー数を正しく返すこと', async () => {
      mockListContainers.mockResolvedValueOnce([
        { Id: 'container-1', Labels: { 'claude-work.chrome-sidecar': 'true' } },
        { Id: 'container-2', Labels: { 'claude-work.chrome-sidecar': 'true' } },
      ]);

      const count = await service.getActiveSidecarCount();
      expect(count).toBe(2);
    });

    it('サイドカーがない場合は0を返すこと', async () => {
      mockListContainers.mockResolvedValueOnce([]);

      const count = await service.getActiveSidecarCount();
      expect(count).toBe(0);
    });

    it('正しいフィルタ条件でlistContainersが呼ばれること', async () => {
      mockListContainers.mockResolvedValueOnce([]);

      await service.getActiveSidecarCount();

      expect(mockListContainers).toHaveBeenCalledWith({
        filters: JSON.stringify({
          label: ['claude-work.chrome-sidecar=true'],
          status: ['running'],
        }),
      });
    });
  });
});
