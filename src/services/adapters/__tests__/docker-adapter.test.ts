import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';

// Mock DockerClient and fs.existsSync via hoisted to avoid linter issues
const { mockDockerClient, mockExistsSync, mockIsFilterEnabled, mockProxyHealthCheck, mockSyncRulesForContainer, mockProxyDeleteRules } = vi.hoisted(() => ({
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
      process.env.PROXY_NETWORK_NAME = 'custom-filter-network';
      try {
        const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { filterEnabled: true });
        expect(createOptions.HostConfig.NetworkMode).toBe('custom-filter-network');
      } finally {
        delete process.env.PROXY_NETWORK_NAME;
      }
    });
  });

  describe('createSession with network filtering', () => {
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

    it('proxyヘルスチェック失敗時はセッション作成がエラーになる（フェイルセーフ）', async () => {
      mockIsFilterEnabled.mockResolvedValue(true);
      mockProxyHealthCheck.mockRejectedValue(new Error('proxy unreachable'));
      setupContainerMock('172.20.0.5');

      await expect(adapter.createSession('session-1', '/workspace')).rejects.toThrow();
    });

    it('フィルタリング無効時はproxyClient.healthCheckが呼ばれない', async () => {
      mockIsFilterEnabled.mockResolvedValue(false);
      setupContainerMock('172.20.0.5');

      await adapter.createSession('session-1', '/workspace');

      expect(mockProxyHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('buildContainerOptions with registry firewall', () => {
    const rfHost = 'http://registry-firewall:8080';

    it('registryFirewallEnabled+filterEnabled時にPIP_INDEX_URLが注入される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain(`PIP_INDEX_URL=${rfHost}/pypi/simple/`);
    });

    it('registryFirewallEnabled+filterEnabled時にPIP_TRUSTED_HOSTが注入される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain('PIP_TRUSTED_HOST=registry-firewall');
    });

    it('registryFirewallEnabled+filterEnabled時にGOPROXY環境変数が注入される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain(`GOPROXY=${rfHost}/go/,direct`);
    });

    it('registryFirewallEnabled+filterEnabled時にEntrypointにnpm config setコマンドが含まれる', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
      const cmd = createOptions.Cmd as string[];
      expect(cmd[0]).toContain(`npm config set registry '${rfHost}/npm/'`);
    });

    it('registryFirewallEnabled+filterEnabled時にEntrypointにcargo config作成コマンドが含まれる', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
      const cmd = createOptions.Cmd as string[];
      expect(cmd[0]).toContain('~/.cargo/config.toml');
    });

    it('registryFirewallEnabled+filterEnabled時にEntrypointが/bin/sh -cに変更される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
      expect(createOptions.Entrypoint).toEqual(['/bin/sh', '-c']);
    });

    it('registryFirewallEnabled=false時にレジストリ設定が注入されない', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: false });
      const env = createOptions.Env as string[];
      expect(env.some((e: string) => e.startsWith('PIP_INDEX_URL='))).toBe(false);
      expect(env.some((e: string) => e.startsWith('GOPROXY='))).toBe(false);
      expect(createOptions.Entrypoint).toEqual(['claude']);
    });

    it('filterEnabledとregistryFirewallEnabledの両方が有効な場合、HTTP_PROXYとレジストリ設定の両方が設定される', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', {
        filterEnabled: true,
        registryFirewallEnabled: true,
      });
      const env = createOptions.Env as string[];
      expect(env).toContain('HTTP_PROXY=http://network-filter-proxy:3128');
      expect(env).toContain('HTTPS_PROXY=http://network-filter-proxy:3128');
      expect(env).toContain(`PIP_INDEX_URL=${rfHost}/pypi/simple/`);
      expect(env).toContain(`GOPROXY=${rfHost}/go/,direct`);
      // registry-firewallホストはNO_PROXYに追加される
      expect(env.some((e: string) => e.startsWith('NO_PROXY='))).toBe(true);
      expect(env.some((e: string) => e.startsWith('no_proxy='))).toBe(true);
      // filterEnabled+registryFirewallEnabledの場合はNetworkModeがclaudework-filterに設定される
      expect(createOptions.HostConfig.NetworkMode).toBe('claudework-filter');
    });

    it('registryFirewallEnabled単独（filterEnabled=false）の場合、レジストリ設定が注入されない', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', {
        filterEnabled: false,
        registryFirewallEnabled: true,
      });
      const env = createOptions.Env as string[];
      // filterEnabledがfalseの場合、claudework-filterネットワーク経由でregistry-firewallに到達できないため
      // レジストリ設定は注入されない
      expect(env.some((e: string) => e.startsWith('PIP_INDEX_URL='))).toBe(false);
      expect(env.some((e: string) => e.startsWith('GOPROXY='))).toBe(false);
      expect(createOptions.HostConfig.NetworkMode).toBeUndefined();
    });

    it('shellMode時にレジストリ設定を注入しない', () => {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', {
        registryFirewallEnabled: true,
        filterEnabled: true,
        shellMode: true,
      });
      const env = createOptions.Env as string[];
      expect(env.some((e: string) => e.startsWith('PIP_INDEX_URL='))).toBe(false);
      expect(createOptions.Entrypoint).toEqual(['/bin/sh']);
    });

    it('REGISTRY_FIREWALL_URL環境変数が設定されている場合はそちらを使用する', () => {
      const original = process.env.REGISTRY_FIREWALL_URL;
      process.env.REGISTRY_FIREWALL_URL = 'http://custom-firewall:9090';
      try {
        const { createOptions } = (adapter as any).buildContainerOptions('/workspace', { registryFirewallEnabled: true, filterEnabled: true });
        const env = createOptions.Env as string[];
        expect(env).toContain('PIP_INDEX_URL=http://custom-firewall:9090/pypi/simple/');
      } finally {
        if (original === undefined) {
          delete process.env.REGISTRY_FIREWALL_URL;
        } else {
          process.env.REGISTRY_FIREWALL_URL = original;
        }
      }
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
      mockDockerClient.getContainer.mockReturnValue({ stop: vi.fn().mockResolvedValue(undefined) });

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
    });
  });
});
