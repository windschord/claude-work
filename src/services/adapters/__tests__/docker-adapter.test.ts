import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';

// Mock DockerClient and fs.existsSync via hoisted to avoid linter issues
const { mockDockerClient, mockExistsSync, mockIsFilterEnabled, mockProxyHealthCheck, mockSyncRulesForContainer, mockProxyDeleteRules, mockRfGetHealth } = vi.hoisted(() => ({
  mockDockerClient: {
    inspectContainer: vi.fn(),
    getContainer: vi.fn(),
    run: vi.fn(),
    createContainer: vi.fn(),
  },
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockIsFilterEnabled: vi.fn(),
  mockProxyHealthCheck: vi.fn(),
  mockSyncRulesForContainer: vi.fn(),
  mockProxyDeleteRules: vi.fn(),
  mockRfGetHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
}));

vi.mock('../../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    isFilterEnabled: mockIsFilterEnabled,
    getRules: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/proxy-sync', () => ({
  syncRulesForContainer: (...args: unknown[]) => mockSyncRulesForContainer(...args),
}));

vi.mock('@/services/proxy-client', () => {
  class MockProxyClient {
    healthCheck = mockProxyHealthCheck;
    deleteRules = mockProxyDeleteRules;
  }
  class MockProxyConnectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ProxyConnectionError';
    }
  }
  return {
    ProxyClient: MockProxyClient,
    ProxyConnectionError: MockProxyConnectionError,
  };
});

vi.mock('@/services/registry-firewall-client', () => ({
  RegistryFirewallClient: vi.fn().mockImplementation(() => ({
    getHealth: mockRfGetHealth,
  })),
}));

// Mock other dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn().mockReturnValue([])
        })),
        all: vi.fn().mockReturnValue([])
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn()
        }))
      }))
    }))
  },
  schema: { sessions: {}, sshKeys: {} },
}));

vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: vi.fn().mockImplementation(function() {
    return {
      getEffectiveSettings: vi.fn().mockResolvedValue({}),
    };
  }),
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: vi.fn().mockImplementation(function() {
    return {
      decrypt: vi.fn().mockResolvedValue('decrypted'),
    };
  }),
}));

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Mock tar-fs to prevent real file streaming
vi.mock('tar-fs', () => ({
  default: {
    pack: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  },
  pack: vi.fn().mockReturnValue({ pipe: vi.fn() }),
}));

// Mock fs to prevent real filesystem operations - uses hoisted mockExistsSync
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
    writeFileSync: vi.fn(),
    createReadStream: vi.fn(),
  };
});

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
  access: vi.fn().mockResolvedValue(undefined),
}));

describe('DockerAdapter', () => {
  let adapter: DockerAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    adapter = new DockerAdapter({
      environmentId: 'env-1',
      imageName: 'test-image',
      imageTag: 'latest',
      authDirPath: '/data/environments/env-1',
    });
  });

  describe('isContainerRunning', () => {
    it('should use DockerClient.inspectContainer', async () => {
      mockDockerClient.inspectContainer.mockResolvedValue({ State: { Running: true } });
      const result = await (adapter as any).isContainerRunning('container-1');
      expect(result).toBe(true);
      expect(mockDockerClient.inspectContainer).toHaveBeenCalledWith('container-1');
    });

    it('should return false if inspect fails', async () => {
      mockDockerClient.inspectContainer.mockRejectedValue(new Error('Not found'));
      const result = await (adapter as any).isContainerRunning('container-1');
      expect(result).toBe(false);
    });
  });

  describe('stopContainer', () => {
    it('should use DockerClient.getContainer().stop() and return true on success', async () => {
      const mockContainer = { stop: vi.fn().mockResolvedValue(undefined) };
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const result = await (adapter as any).stopContainer('container-1');

      expect(mockDockerClient.getContainer).toHaveBeenCalledWith('container-1');
      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
      expect(result).toBe(true);
    });

    it('should return false when stop fails', async () => {
      const mockContainer = { stop: vi.fn().mockRejectedValue(new Error('stop failed')) };
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      const result = await (adapter as any).stopContainer('container-1');

      expect(result).toBe(false);
    });
  });

  describe('runEphemeralContainer', () => {
    it('should use DockerClient.run', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 0 });

      const result = await (adapter as any).runEphemeralContainer(['echo', 'hello'], {});

      expect(mockDockerClient.run).toHaveBeenCalled();
      expect(result.code).toBe(0);
    });
  });

  describe('getConfigVolumeNames', () => {
    it('環境IDから正しいVolume名を生成する', () => {
      const names = DockerAdapter.getConfigVolumeNames('test-env-123');
      expect(names.claudeVolume).toBe('claude-config-claude-test-env-123');
      expect(names.configClaudeVolume).toBe('claude-config-configclaude-test-env-123');
    });

    it('UUIDベースの環境IDでも正しいVolume名を生成する', () => {
      const names = DockerAdapter.getConfigVolumeNames('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(names.claudeVolume).toBe('claude-config-claude-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(names.configClaudeVolume).toBe('claude-config-configclaude-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });

  describe('constructor with optional authDirPath', () => {
    it('authDirPathがundefinedでもエラーにならない', () => {
      expect(() => new DockerAdapter({
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
      })).not.toThrow();
    });

    it('authDirPathが指定されている場合は既存のバリデーションが適用される', () => {
      expect(() => new DockerAdapter({
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: 'relative/path',
      })).toThrow('authDirPath must be an absolute path');
    });

    it('authDirPathにenvironmentIdが含まれていない場合はエラー', () => {
      expect(() => new DockerAdapter({
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: '/data/environments/other-env',
      })).toThrow('authDirPath must contain environmentId');
    });
  });

  describe('buildContainerOptions with named volumes', () => {
    it('authDirPathがundefinedの場合、名前付きVolumeをBindsに含める', () => {
      const adapterNoAuth = new DockerAdapter({
        environmentId: 'env-abc',
        imageName: 'test-image',
        imageTag: 'latest',
      });
      const { createOptions } = (adapterNoAuth as any).buildContainerOptions('/workspace');
      const binds = createOptions.HostConfig.Binds as string[];
      expect(binds).toContain('claude-config-claude-env-abc:/home/node/.claude');
      expect(binds).toContain('claude-config-configclaude-env-abc:/home/node/.config/claude');
    });

    it('authDirPathが設定されている場合はバインドマウントを使用（後方互換）', () => {
      mockExistsSync.mockReturnValue(true);

      const adapterWithAuth = new DockerAdapter({
        environmentId: 'env-1',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: '/data/environments/env-1',
      });
      const { createOptions } = (adapterWithAuth as any).buildContainerOptions('/workspace');
      const binds = createOptions.HostConfig.Binds as string[];
      expect(binds).toContain('/data/environments/env-1/claude:/home/node/.claude');
      expect(binds).toContain('/data/environments/env-1/config/claude:/home/node/.config/claude');
      // 名前付きVolumeが含まれていないことを確認
      const namedVolumeBinds = binds.filter((b) => b.startsWith('claude-config-'));
      expect(namedVolumeBinds).toHaveLength(0);

      mockExistsSync.mockReturnValue(false);
    });
  });

  describe('buildContainerOptions with network filtering', () => {
    it('フィルタリング有効時にNetworkModeがclaudework-filterに設定される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { filterEnabled: true });
      expect(createOptions.HostConfig.NetworkMode).toBe('claudework-filter');
    });

    it('フィルタリング有効時にHTTP_PROXYとHTTPS_PROXY環境変数が設定される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain('HTTP_PROXY=http://network-filter-proxy:3128');
      expect(env).toContain('HTTPS_PROXY=http://network-filter-proxy:3128');
    });

    it('フィルタリング無効時はNetworkModeが設定されない', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { filterEnabled: false });
      expect(createOptions.HostConfig.NetworkMode).toBeUndefined();
    });

    it('フィルタリング無効時にHTTP_PROXY/HTTPS_PROXY環境変数が設定されない', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { filterEnabled: false });
      const env = createOptions.Env as string[];
      expect(env).not.toContain('HTTP_PROXY=http://network-filter-proxy:3128');
      expect(env).not.toContain('HTTPS_PROXY=http://network-filter-proxy:3128');
    });

    it('PROXY_NETWORK_NAME環境変数が設定されている場合はそちらを使用する', () => {
      const originalProxyNetworkName = process.env.PROXY_NETWORK_NAME;
      process.env.PROXY_NETWORK_NAME = 'custom-filter-network';
      try {
        const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { filterEnabled: true });
        expect(createOptions.HostConfig.NetworkMode).toBe('custom-filter-network');
      } finally {
        if (originalProxyNetworkName === undefined) {
          delete process.env.PROXY_NETWORK_NAME;
        } else {
          process.env.PROXY_NETWORK_NAME = originalProxyNetworkName;
        }
      }
    });
  });

  describe('createSession with network filtering', () => {
    let originalProxyApiUrl: string | undefined;

    beforeEach(() => {
      originalProxyApiUrl = process.env.PROXY_API_URL;
      // proxy healthCheckが呼ばれるようにPROXY_API_URLを設定
      process.env.PROXY_API_URL = 'http://network-filter-proxy:8080';
    });

    afterEach(() => {
      if (originalProxyApiUrl === undefined) {
        delete process.env.PROXY_API_URL;
      } else {
        process.env.PROXY_API_URL = originalProxyApiUrl;
      }
    });

    // createSessionのテスト用ヘルパー：コンテナモックを設定する
    function setupContainerMock(containerIpAddress: string) {
      const mockExec = { start: vi.fn().mockResolvedValue(undefined) };
      const mockContainer = {
        attach: vi.fn().mockResolvedValue({
          on: vi.fn(),
          pipe: vi.fn(),
          write: vi.fn(),
        }),
        start: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        exec: vi.fn().mockResolvedValue(mockExec),
      };
      mockDockerClient.createContainer.mockResolvedValue(mockContainer);
      // waitForContainerReady用
      mockDockerClient.inspectContainer.mockResolvedValue({
        State: { Running: true },
        NetworkSettings: {
          Networks: {
            'claudework-filter': { IPAddress: containerIpAddress },
          },
        },
      });
      mockDockerClient.getContainer.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockExec),
      });
      return mockContainer;
    }

    it('フィルタリング有効時にproxyClient.healthCheckが呼ばれる', async () => {
      mockIsFilterEnabled.mockResolvedValue(true);
      mockProxyHealthCheck.mockResolvedValue({ status: 'healthy', uptime: 100, activeConnections: 0, ruleCount: 0 });
      mockSyncRulesForContainer.mockResolvedValue(undefined);
      setupContainerMock('172.20.0.5');

      await adapter.createSession('session-1', '/workspace');

      expect(mockProxyHealthCheck).toHaveBeenCalledTimes(1);
    });

    it('フィルタリング有効時にコンテナ起動後にsyncRulesForContainerが呼ばれる', async () => {
      mockIsFilterEnabled.mockResolvedValue(true);
      mockProxyHealthCheck.mockResolvedValue({ status: 'healthy', uptime: 100, activeConnections: 0, ruleCount: 0 });
      mockSyncRulesForContainer.mockResolvedValue(undefined);
      setupContainerMock('172.20.0.5');

      await adapter.createSession('session-1', '/workspace');

      expect(mockSyncRulesForContainer).toHaveBeenCalledWith(
        expect.any(Object),
        '172.20.0.5',
        'env-1',
      );
    });

    it('proxyヘルスチェック失敗時はフィルタリングなしでセッション作成が続行する（graceful degradation）', async () => {
      mockIsFilterEnabled.mockResolvedValue(true);
      mockProxyHealthCheck.mockRejectedValue(new Error('proxy unreachable'));
      setupContainerMock('172.20.0.5');

      // proxy未稼働でもセッション作成は成功する
      await expect(adapter.createSession('session-1', '/workspace')).resolves.not.toThrow();

      // proxyが利用不可のためルール同期は呼ばれない
      expect(mockSyncRulesForContainer).not.toHaveBeenCalled();

      // 回帰防止: proxy未達時はコンテナにproxy設定が注入されないことを確認
      const createContainerCall = mockDockerClient.createContainer.mock.calls[0][0];
      const env = createContainerCall.Env as string[];
      expect(env.some((e: string) => e.startsWith('HTTP_PROXY='))).toBe(false);
      expect(env.some((e: string) => e.startsWith('HTTPS_PROXY='))).toBe(false);
      expect(createContainerCall.HostConfig.NetworkMode).toBeUndefined();
    });

    it('registry-firewall未稼働時はレジストリ設定が注入されない（graceful degradation）', async () => {
      mockIsFilterEnabled.mockResolvedValue(true);
      mockProxyHealthCheck.mockResolvedValue({ status: 'healthy', uptime: 100, activeConnections: 0, ruleCount: 0 });
      mockSyncRulesForContainer.mockResolvedValue(undefined);
      mockRfGetHealth.mockResolvedValue({ status: 'stopped' });
      const originalRfUrl = process.env.REGISTRY_FIREWALL_URL;
      process.env.REGISTRY_FIREWALL_URL = 'http://registry-firewall:8080';
      setupContainerMock('172.20.0.5');

      try {
        await adapter.createSession('session-1', '/workspace', undefined, {
          registryFirewallEnabled: true,
        });

        // registry-firewall未稼働のため、レジストリ設定が注入されないことを確認
        const createContainerCall = mockDockerClient.createContainer.mock.calls[0][0];
        const env = createContainerCall.Env as string[];
        expect(env.some((e: string) => e.startsWith('PIP_INDEX_URL='))).toBe(false);
        expect(env.some((e: string) => e.startsWith('GOPROXY='))).toBe(false);
        // proxy自体は稼働しているのでフィルタリング設定は有効
        expect(env.some((e: string) => e.startsWith('HTTP_PROXY='))).toBe(true);
      } finally {
        if (originalRfUrl === undefined) {
          delete process.env.REGISTRY_FIREWALL_URL;
        } else {
          process.env.REGISTRY_FIREWALL_URL = originalRfUrl;
        }
        // モック実装をデフォルトに戻す
        mockRfGetHealth.mockResolvedValue({ status: 'healthy' });
      }
    });

    it('フィルタリング無効時はproxyClient.healthCheckが呼ばれない', async () => {
      mockIsFilterEnabled.mockResolvedValue(false);
      setupContainerMock('172.20.0.5');

      await adapter.createSession('session-1', '/workspace');

      expect(mockProxyHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('destroySession with network filtering cleanup', () => {
    it('containerIPが保存されている場合、destroySession時にproxyClient.deleteRulesが呼ばれる', async () => {
      mockProxyDeleteRules.mockResolvedValue(undefined);
      mockDockerClient.getContainer.mockReturnValue({ stop: vi.fn().mockResolvedValue(undefined) });

      // セッションにcontainerIPを直接設定してテスト
      const mockPty = {
        kill: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
      };
      (adapter as any).sessions.set('session-cleanup', {
        ptyProcess: mockPty,
        workingDir: '/workspace',
        containerId: 'container-id-1',
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
        containerIP: '172.20.0.5',
      });

      await adapter.destroySession('session-cleanup');

      expect(mockProxyDeleteRules).toHaveBeenCalledWith('172.20.0.5');
    });

    it('containerIPがない場合はproxyClient.deleteRulesが呼ばれない', async () => {
      mockDockerClient.getContainer.mockReturnValue({ stop: vi.fn().mockResolvedValue(undefined) });

      const mockPty = {
        kill: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
      };
      (adapter as any).sessions.set('session-no-ip', {
        ptyProcess: mockPty,
        workingDir: '/workspace',
        containerId: 'container-id-2',
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
        // containerIP未設定
      });

      await adapter.destroySession('session-no-ip');

      expect(mockProxyDeleteRules).not.toHaveBeenCalled();
    });

    it('deleteRules失敗時は警告のみでコンテナ停止は継続する', async () => {
      mockProxyDeleteRules.mockRejectedValue(new Error('proxy unreachable'));
      const stop = vi.fn().mockResolvedValue(undefined);
      mockDockerClient.getContainer.mockReturnValue({ stop });

      const mockPty = {
        kill: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
      };
      (adapter as any).sessions.set('session-cleanup-fail', {
        ptyProcess: mockPty,
        workingDir: '/workspace',
        containerId: 'container-id-3',
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
        containerIP: '172.20.0.6',
      });

      // エラーが伝播せず完了することを確認
      await expect(adapter.destroySession('session-cleanup-fail')).resolves.not.toThrow();
      expect(stop).toHaveBeenCalled();
    });
  });
});
