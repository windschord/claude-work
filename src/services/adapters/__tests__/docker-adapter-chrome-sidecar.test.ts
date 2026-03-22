import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted で変数をホイスティング
const {
  mockDockerClient,
  mockExistsSync,
  mockStartSidecar,
  mockStopSidecar,
  mockConnectClaudeContainer,
  mockIsFilterEnabled,
  mockProxyHealthCheck,
  mockDbUpdate,
  mockDbSelectGet,
} = vi.hoisted(() => {
  const mockDbUpdateRun = vi.fn();
  const mockDbUpdateWhere = vi.fn(() => ({ run: mockDbUpdateRun }));
  const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
  const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));
  Object.assign(mockDbUpdate, { set: mockDbUpdateSet, where: mockDbUpdateWhere, run: mockDbUpdateRun });

  const mockDbSelectGet = vi.fn();

  return {
    mockDockerClient: {
      inspectContainer: vi.fn(),
      getContainer: vi.fn(),
      run: vi.fn(),
      createContainer: vi.fn(),
    },
    mockExistsSync: vi.fn().mockReturnValue(false),
    mockStartSidecar: vi.fn(),
    mockStopSidecar: vi.fn(),
    mockConnectClaudeContainer: vi.fn(),
    mockIsFilterEnabled: vi.fn().mockResolvedValue(false),
    mockProxyHealthCheck: vi.fn(),
    mockDbUpdate,
    mockDbSelectGet,
  };
});

// ChromeSidecarService のモック（シングルトン対応）
vi.mock('../../chrome-sidecar-service', () => ({
  ChromeSidecarService: {
    getInstance: vi.fn(() => ({
      startSidecar: mockStartSidecar,
      stopSidecar: mockStopSidecar,
      connectClaudeContainer: mockConnectClaudeContainer,
    })),
  },
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
  syncRulesForContainer: vi.fn(),
}));

vi.mock('@/services/proxy-client', () => {
  class MockProxyClient {
    healthCheck = mockProxyHealthCheck;
    deleteRules = vi.fn().mockResolvedValue(undefined);
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
    getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
  })),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbSelectGet,
          all: vi.fn().mockReturnValue([]),
        })),
        all: vi.fn().mockReturnValue([]),
      })),
    })),
    update: mockDbUpdate,
  },
  schema: { sessions: {} },
}));

vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: vi.fn().mockImplementation(function () {
    return {
      getEffectiveSettings: vi.fn().mockResolvedValue({}),
    };
  }),
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: vi.fn().mockImplementation(function () {
    return {
      decrypt: vi.fn().mockResolvedValue('decrypted'),
    };
  }),
}));

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

vi.mock('tar-fs', () => ({
  default: {
    pack: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  },
  pack: vi.fn().mockReturnValue({ pipe: vi.fn() }),
}));

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

// scrollbackBuffer mock
vi.mock('../../scrollback-buffer', () => ({
  scrollbackBuffer: {
    append: vi.fn(),
    clear: vi.fn(),
    get: vi.fn().mockReturnValue(''),
  },
}));

// ClaudeOptionsService mock
vi.mock('../../claude-options-service', () => ({
  ClaudeOptionsService: {
    buildCliArgs: vi.fn().mockReturnValue([]),
    validateEnvVarKey: vi.fn().mockReturnValue(true),
  },
}));

import { DockerAdapter } from '../docker-adapter';

/**
 * コンテナモックを設定するヘルパー
 * DockerAdapter.createSession が内部で使用する Docker API をモック
 */
function setupContainerMock() {
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
  // waitForContainerReady用: Running=true を返す
  mockDockerClient.inspectContainer.mockResolvedValue({
    State: { Running: true },
    NetworkSettings: {
      Networks: {},
    },
  });
  mockDockerClient.getContainer.mockReturnValue({
    exec: vi.fn().mockResolvedValue(mockExec),
    stop: vi.fn().mockResolvedValue(undefined),
  });
  return mockContainer;
}

describe('DockerAdapter Chrome Sidecar - DockerAdapter統合テスト', () => {
  let adapter: DockerAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockIsFilterEnabled.mockResolvedValue(false);
    mockDbSelectGet.mockReturnValue(undefined);
    adapter = new DockerAdapter({
      environmentId: 'env-1',
      imageName: 'test-image',
      imageTag: 'latest',
    });
  });

  describe('createSession: サイドカー無効時', () => {
    it('chromeSidecarオプション未指定の場合、ChromeSidecarServiceが呼ばれないこと', async () => {
      setupContainerMock();

      await adapter.createSession('session-no-sidecar', '/workspace');

      expect(mockStartSidecar).not.toHaveBeenCalled();
      expect(mockConnectClaudeContainer).not.toHaveBeenCalled();
    });

    it('chromeSidecar.enabled=falseの場合、startSidecarが呼ばれないこと', async () => {
      setupContainerMock();

      await adapter.createSession('session-disabled', '/workspace', undefined, {
        chromeSidecar: {
          enabled: false,
          image: 'ghcr.io/windschord/claude-work-sandbox',
          tag: 'chrome-devtools',
        },
      });

      expect(mockStartSidecar).not.toHaveBeenCalled();
    });
  });

  describe('createSession: サイドカー有効・成功時', () => {
    it('startSidecar, injectBrowserUrl, connectClaudeContainer が順に呼ばれ、DB更新されること', async () => {
      setupContainerMock();

      mockStartSidecar.mockResolvedValue({
        success: true,
        containerName: 'cw-chrome-session-ok',
        networkName: 'cw-net-session-ok',
        debugPort: 49152,
        browserUrl: 'http://cw-chrome-session-ok:9222',
      });
      mockConnectClaudeContainer.mockResolvedValue(undefined);

      await adapter.createSession('session-ok', '/workspace', undefined, {
        chromeSidecar: {
          enabled: true,
          image: 'ghcr.io/windschord/claude-work-sandbox',
          tag: 'chrome-devtools',
        },
      });

      // startSidecarが正しい引数で呼ばれること
      expect(mockStartSidecar).toHaveBeenCalledWith('session-ok', {
        enabled: true,
        image: 'ghcr.io/windschord/claude-work-sandbox',
        tag: 'chrome-devtools',
      });

      // injectBrowserUrl: コンテナ作成時にブラウザURL環境変数が注入されること
      const createContainerCall = mockDockerClient.createContainer.mock.calls[0][0];
      const env = createContainerCall.Env as string[];
      expect(env.some((e: string) => e.includes('__CHROME_BROWSER_URL=http://cw-chrome-session-ok:9222'))).toBe(true);

      // Entrypointがshell経由に変換されていること
      expect(createContainerCall.Entrypoint).toEqual(['/bin/sh', '-c']);

      // connectClaudeContainerが呼ばれること（コンテナ名とネットワーク名）
      expect(mockConnectClaudeContainer).toHaveBeenCalledWith(
        expect.stringContaining('claude-env-'),
        'cw-net-session-ok'
      );

      // DB更新: chrome_container_id, chrome_debug_port
      expect(mockDbUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          chrome_container_id: 'cw-chrome-session-ok',
          chrome_debug_port: 49152,
        })
      );
    });
  });

  describe('createSession: サイドカー失敗（CDPタイムアウト）時', () => {
    it('サイドカー起動失敗時もClaude Codeセッションが作成されること（graceful degradation）', async () => {
      setupContainerMock();

      mockStartSidecar.mockResolvedValue({
        success: false,
        error: 'CDP health check timed out',
      });

      // セッション作成自体は成功する
      await expect(
        adapter.createSession('session-sidecar-fail', '/workspace', undefined, {
          chromeSidecar: {
            enabled: true,
            image: 'ghcr.io/windschord/claude-work-sandbox',
            tag: 'chrome-devtools',
          },
        })
      ).resolves.not.toThrow();

      expect(mockStartSidecar).toHaveBeenCalled();

      // サイドカー失敗のため、connectClaudeContainerは呼ばれない
      expect(mockConnectClaudeContainer).not.toHaveBeenCalled();

      // サイドカー失敗のため、ブラウザURL環境変数は注入されない
      const createContainerCall = mockDockerClient.createContainer.mock.calls[0][0];
      const env = createContainerCall.Env as string[];
      expect(env.some((e: string) => e.includes('__CHROME_BROWSER_URL'))).toBe(false);
    });
  });

  describe('createSession: サイドカー成功後のconnectClaudeContainer失敗時', () => {
    it('接続失敗時にサイドカーがクリーンアップされ、セッションは継続すること', async () => {
      setupContainerMock();

      mockStartSidecar.mockResolvedValue({
        success: true,
        containerName: 'cw-chrome-session-connect-fail',
        networkName: 'cw-net-session-connect-fail',
        debugPort: 49153,
        browserUrl: 'http://cw-chrome-session-connect-fail:9222',
      });
      mockConnectClaudeContainer.mockRejectedValue(new Error('Network connect failed'));
      mockStopSidecar.mockResolvedValue({ success: true });

      // セッション作成自体は成功する
      await expect(
        adapter.createSession('session-connect-fail', '/workspace', undefined, {
          chromeSidecar: {
            enabled: true,
            image: 'ghcr.io/windschord/claude-work-sandbox',
            tag: 'chrome-devtools',
          },
        })
      ).resolves.not.toThrow();

      // 接続失敗後にstopSidecarでクリーンアップ
      expect(mockStopSidecar).toHaveBeenCalledWith(
        'session-connect-fail',
        'cw-chrome-session-connect-fail',
        'cw-net-session-connect-fail'
      );
    });
  });

  describe('createSession: コンテナ作成失敗時のサイドカークリーンアップ', () => {
    it('コンテナ作成失敗時に起動済みサイドカーがクリーンアップされること', async () => {
      mockStartSidecar.mockResolvedValue({
        success: true,
        containerName: 'cw-chrome-session-cleanup',
        networkName: 'cw-net-session-cleanup',
        debugPort: 49154,
        browserUrl: 'http://cw-chrome-session-cleanup:9222',
      });
      mockStopSidecar.mockResolvedValue({ success: true });

      // コンテナ作成で失敗させる
      mockDockerClient.createContainer.mockRejectedValue(new Error('Docker create failed'));

      await expect(
        adapter.createSession('session-cleanup', '/workspace', undefined, {
          chromeSidecar: {
            enabled: true,
            image: 'ghcr.io/windschord/claude-work-sandbox',
            tag: 'chrome-devtools',
          },
        })
      ).rejects.toThrow('Docker create failed');

      // 失敗時にサイドカーがクリーンアップされること
      expect(mockStopSidecar).toHaveBeenCalledWith(
        'session-cleanup',
        'cw-chrome-session-cleanup',
        'cw-net-session-cleanup'
      );
    });
  });

  describe('destroySession: サイドカー停止', () => {
    it('chrome_container_idが存在する場合、stopSidecarが呼ばれること', async () => {
      setupContainerMock();

      // セッションをsessionsマップに直接設定
      const mockPty = {
        kill: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
      };
      (adapter as any).sessions.set('session-with-chrome', {
        ptyProcess: mockPty,
        workingDir: '/workspace',
        containerId: 'container-id-chrome',
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
      });

      // DB select: chrome_container_id が存在する
      mockDbSelectGet.mockReturnValue({ chrome_container_id: 'cw-chrome-session-with-chrome' });
      mockStopSidecar.mockResolvedValue({ success: true });

      await adapter.destroySession('session-with-chrome');

      expect(mockStopSidecar).toHaveBeenCalledWith(
        'session-with-chrome',
        'cw-chrome-session-with-chrome'
      );

      // 停止成功時はDB更新で chrome_container_id, chrome_debug_port をnullクリア
      expect(mockDbUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          chrome_container_id: null,
          chrome_debug_port: null,
        })
      );
    });

    it('chrome_container_idがNULLの場合、stopSidecarが呼ばれないこと', async () => {
      setupContainerMock();

      const mockPty = {
        kill: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
      };
      (adapter as any).sessions.set('session-no-chrome', {
        ptyProcess: mockPty,
        workingDir: '/workspace',
        containerId: 'container-id-no-chrome',
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
      });

      // DB select: chrome_container_id が存在しない
      mockDbSelectGet.mockReturnValue({ chrome_container_id: null });

      await adapter.destroySession('session-no-chrome');

      expect(mockStopSidecar).not.toHaveBeenCalled();
    });

    it('stopSidecar失敗時はDB参照が保持されること（孤立回収用）', async () => {
      setupContainerMock();

      const mockPty = {
        kill: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
      };
      (adapter as any).sessions.set('session-stop-fail', {
        ptyProcess: mockPty,
        workingDir: '/workspace',
        containerId: 'container-id-stop-fail',
        errorBuffer: '',
        hasReceivedOutput: false,
        shellMode: false,
      });

      // DB select: chrome_container_id が存在する
      mockDbSelectGet.mockReturnValue({ chrome_container_id: 'cw-chrome-session-stop-fail' });
      // stopSidecar が失敗を返す
      mockStopSidecar.mockResolvedValue({ success: false, error: 'Chrome stop failed' });

      await adapter.destroySession('session-stop-fail');

      expect(mockStopSidecar).toHaveBeenCalled();

      // 停止失敗時はchrome_container_id/chrome_debug_portのnullクリアが行われない
      // (container_idのnullクリアは別途行われるが、chrome関連のクリアは行われない)
      const setCalls = mockDbUpdate.set.mock.calls;
      const chromeNullClearCall = setCalls.find(
        (call: unknown[]) =>
          call[0] &&
          typeof call[0] === 'object' &&
          'chrome_container_id' in (call[0] as Record<string, unknown>) &&
          (call[0] as Record<string, unknown>).chrome_container_id === null
      );
      expect(chromeNullClearCall).toBeUndefined();
    });
  });

  describe('injectBrowserUrl: Entrypoint/Cmd変換', () => {
    it('新規Entrypoint: shell経由への変換が行われること', async () => {
      setupContainerMock();

      mockStartSidecar.mockResolvedValue({
        success: true,
        containerName: 'cw-chrome-inject',
        networkName: 'cw-net-inject',
        debugPort: 49155,
        browserUrl: 'http://cw-chrome-inject:9222',
      });
      mockConnectClaudeContainer.mockResolvedValue(undefined);

      await adapter.createSession('session-inject', '/workspace', undefined, {
        chromeSidecar: {
          enabled: true,
          image: 'ghcr.io/windschord/claude-work-sandbox',
          tag: 'chrome-devtools',
        },
      });

      const createContainerCall = mockDockerClient.createContainer.mock.calls[0][0];

      // Entrypointが /bin/sh -c に変換されていること
      expect(createContainerCall.Entrypoint).toEqual(['/bin/sh', '-c']);

      // Cmdにmcpスクリプトが含まれていること
      const cmd = createContainerCall.Cmd as string[];
      expect(cmd[0]).toContain('.mcp.json');
      expect(cmd[0]).toContain('__CHROME_BROWSER_URL');

      // 環境変数にブラウザURLが含まれること
      const env = createContainerCall.Env as string[];
      expect(env).toContain('__CHROME_BROWSER_URL=http://cw-chrome-inject:9222');
    });
  });
});
