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

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('ws', () => ({
  default: vi.fn(),
  WebSocket: vi.fn(),
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

describe('DockerAdapter registry firewall', () => {
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

  describe('buildContainerOptions with registry firewall', () => {
    const rfHost = 'http://registry-firewall:8080';

    /** buildContainerOptionsを呼び出してcreateOptionsを返すヘルパー */
    function buildOptions(opts: Record<string, unknown>) {
      const { createOptions } = (adapter as any).buildContainerOptions('/workspace', opts);
      return createOptions;
    }

    it('registryFirewallEnabled+filterEnabled時にPIP_INDEX_URLが注入される', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain(`PIP_INDEX_URL=${rfHost}/pypi/simple/`);
    });

    it('registryFirewallEnabled+filterEnabled時にPIP_TRUSTED_HOSTが注入される', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain('PIP_TRUSTED_HOST=registry-firewall');
    });

    it('registryFirewallEnabled+filterEnabled時にGOPROXY環境変数が注入される', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
      const env = createOptions.Env as string[];
      expect(env).toContain(`GOPROXY=${rfHost}/go/,direct`);
    });

    it('registryFirewallEnabled+filterEnabled時にEntrypointにnpm config setコマンドが含まれる', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
      const cmd = createOptions.Cmd as string[];
      const env = createOptions.Env as string[];
      expect(cmd[0]).toContain('npm config set registry "$__RF_HOST/npm/"');
      expect(env).toContain(`__RF_HOST=${rfHost}`);
    });

    it('registryFirewallEnabled+filterEnabled時にEntrypointにcargo config作成コマンドが含まれる', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
      const cmd = createOptions.Cmd as string[];
      expect(cmd[0]).toContain('~/.cargo/config.toml');
    });

    it('registryFirewallEnabled+filterEnabled時にEntrypointが/bin/sh -cに変更される', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
      expect(createOptions.Entrypoint).toEqual(['/bin/sh', '-c']);
    });

    it('registryFirewallEnabled=false時にレジストリ設定が注入されない', () => {
      const createOptions = buildOptions({ registryFirewallEnabled: false });
      const env = createOptions.Env as string[];
      expect(env.some((e: string) => e.startsWith('PIP_INDEX_URL='))).toBe(false);
      expect(env.some((e: string) => e.startsWith('GOPROXY='))).toBe(false);
      expect(createOptions.Entrypoint).toEqual(['claude']);
    });

    it('filterEnabledとregistryFirewallEnabledの両方が有効な場合、HTTP_PROXYとレジストリ設定の両方が設定される', () => {
      const createOptions = buildOptions({
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
      const createOptions = buildOptions({
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
      const createOptions = buildOptions({
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
        const createOptions = buildOptions({ registryFirewallEnabled: true, filterEnabled: true });
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
});
