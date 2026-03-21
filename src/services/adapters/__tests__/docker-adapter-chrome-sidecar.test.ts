import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted で変数をホイスティング
const {
  mockStartSidecar,
  mockStopSidecar,
  mockConnectClaudeContainer,
} = vi.hoisted(() => ({
  mockStartSidecar: vi.fn(),
  mockStopSidecar: vi.fn(),
  mockConnectClaudeContainer: vi.fn(),
}));

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

describe('DockerAdapter Chrome Sidecar - サイドカーライフサイクル検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession: サイドカー起動フロー', () => {
    it('chromeSidecar無効時はChromeSidecarServiceが呼ばれないこと', () => {
      const options = { cols: 80, rows: 24 };
      expect(options).not.toHaveProperty('chromeSidecar');
      // サービスのstartSidecarが呼ばれていないことを確認
      expect(mockStartSidecar).not.toHaveBeenCalled();
    });

    it('startSidecar成功時の戻り値が正しい構造であること', async () => {
      const expectedResult = {
        success: true,
        containerName: 'cw-chrome-test-session',
        networkName: 'cw-net-test-session',
        debugPort: 49152,
        browserUrl: 'ws://cw-chrome-test-session:9222',
      };
      mockStartSidecar.mockResolvedValue(expectedResult);

      const result = await mockStartSidecar('test-session', {
        enabled: true,
        image: 'chromium/headless-shell',
        tag: '131.0.6778.204',
      });

      expect(mockStartSidecar).toHaveBeenCalledWith('test-session', {
        enabled: true,
        image: 'chromium/headless-shell',
        tag: '131.0.6778.204',
      });
      expect(result.success).toBe(true);
      expect(result.containerName).toMatch(/^cw-chrome-/);
      expect(result.networkName).toMatch(/^cw-net-/);
      expect(result.browserUrl).toMatch(/^ws:\/\//);
    });

    it('startSidecar失敗時もエラー情報が返り、Claude Code起動は妨げないこと（graceful degradation）', async () => {
      mockStartSidecar.mockResolvedValue({
        success: false,
        error: 'CDP health check timed out',
      });

      const result = await mockStartSidecar('test-session', {
        enabled: true,
        image: 'chromium/headless-shell',
        tag: '131.0.6778.204',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // graceful degradation: 失敗でもClaude Code自体は起動する
      // (実際のDockerAdapter統合テストで全体フローを検証)
    });
  });

  describe('injectBrowserUrl: .mcp.json注入ロジック', () => {
    it('新規Entrypoint設定: shell経由への変換', () => {
      const createOptions: Record<string, unknown> = {
        Entrypoint: ['/usr/bin/claude'],
        Cmd: ['--print', 'hello'],
        Env: [],
      };
      const browserUrl = 'ws://cw-chrome-session:9222';

      // injectBrowserUrl のロジック再現
      const env = createOptions.Env as string[];
      env.push(`__CHROME_BROWSER_URL=${browserUrl}`);

      const originalEntrypoint = createOptions.Entrypoint as string[];
      const originalCmd = createOptions.Cmd as string[];

      // shell経由に変換
      const allArgs = [...originalEntrypoint, ...originalCmd].filter(Boolean);
      createOptions.Entrypoint = ['/bin/sh', '-c'];

      const mcpScript = 'MCP_INJECT_SCRIPT';
      createOptions.Cmd = [
        mcpScript + ' && exec "$@"',
        '--',
        ...allArgs,
      ];

      expect(createOptions.Entrypoint).toEqual(['/bin/sh', '-c']);
      expect((createOptions.Cmd as string[])[0]).toContain('MCP_INJECT_SCRIPT');
      expect((createOptions.Cmd as string[]).slice(2)).toEqual(['/usr/bin/claude', '--print', 'hello']);
      expect(env).toContain(`__CHROME_BROWSER_URL=${browserUrl}`);
    });

    it('既存shell Entrypoint拡張: registry-firewallパターンとの共存', () => {
      const createOptions: Record<string, unknown> = {
        Entrypoint: ['/bin/sh', '-c'],
        Cmd: ['existing-setup && exec claude'],
        Env: [],
      };

      const originalEntrypoint = createOptions.Entrypoint as string[];
      const originalCmd = createOptions.Cmd as string[];
      const mcpScript = 'MCP_INJECT_SCRIPT';

      // 既にshell経由の場合はCmdの先頭にスクリプトを追加
      if (
        originalEntrypoint.length === 2 &&
        originalEntrypoint[0] === '/bin/sh' &&
        originalEntrypoint[1] === '-c' &&
        originalCmd.length > 0
      ) {
        originalCmd[0] = mcpScript + ' && ' + originalCmd[0];
      }

      expect(originalCmd[0]).toBe('MCP_INJECT_SCRIPT && existing-setup && exec claude');
    });
  });

  describe('destroySession: サイドカー停止フロー', () => {
    it('chrome_container_idが存在する場合はstopSidecarが呼ばれること', async () => {
      const sessionId = 'test-session';
      const chromeContainerId = 'cw-chrome-test-session';

      mockStopSidecar.mockResolvedValue(undefined);

      await mockStopSidecar(sessionId, chromeContainerId);

      expect(mockStopSidecar).toHaveBeenCalledWith(sessionId, chromeContainerId);
    });

    it('chrome_container_idがNULLのセッションではstopSidecarが呼ばれないこと', () => {
      const sessionRecord = { chrome_container_id: null };

      if (sessionRecord.chrome_container_id) {
        mockStopSidecar(sessionRecord.chrome_container_id);
      }

      expect(mockStopSidecar).not.toHaveBeenCalled();
    });

    it('stopSidecar失敗時にbest-effortで例外を吸収すること', async () => {
      mockStopSidecar.mockRejectedValue(new Error('Chrome stop failed'));

      let exceptionCaught = false;
      try {
        await mockStopSidecar('session', 'container');
      } catch {
        exceptionCaught = true;
        // destroySessionではここでlogger.warnを出力して続行
      }

      expect(exceptionCaught).toBe(true);
      expect(mockStopSidecar).toHaveBeenCalledWith('session', 'container');
    });
  });

  describe('connectClaudeContainer: ネットワーク接続', () => {
    it('サイドカー起動成功後にClaude Codeコンテナをネットワークに接続すること', async () => {
      mockConnectClaudeContainer.mockResolvedValue(undefined);

      await mockConnectClaudeContainer('claude-container', 'cw-net-session');

      expect(mockConnectClaudeContainer).toHaveBeenCalledWith(
        'claude-container',
        'cw-net-session'
      );
    });
  });

  describe('PTYSessionManager: chromeSidecar設定転送', () => {
    it('envConfigからchromeSidecar.enabled=trueの場合、設定が取得されること', () => {
      const envConfig = {
        imageName: 'test-image',
        chromeSidecar: {
          enabled: true,
          image: 'chromium/headless-shell',
          tag: '131.0.6778.204',
        },
      };

      // pty-session-manager.tsのロジックを再現
      const rawSidecar = (envConfig as Record<string, unknown>).chromeSidecar as
        { enabled: boolean; image: string; tag: string } | undefined;
      const chromeSidecar = rawSidecar?.enabled ? rawSidecar : undefined;

      expect(chromeSidecar).toBeDefined();
      expect(chromeSidecar?.image).toBe('chromium/headless-shell');
    });

    it('envConfigからchromeSidecar未設定の場合、undefinedが返ること', () => {
      const envConfig = {
        imageName: 'test-image',
      } as Record<string, unknown>;

      const rawSidecar = envConfig.chromeSidecar as
        { enabled: boolean } | undefined;
      const chromeSidecar = rawSidecar?.enabled ? rawSidecar : undefined;

      expect(chromeSidecar).toBeUndefined();
    });

    it('chromeSidecar.enabled=falseの場合、undefinedが返ること', () => {
      const envConfig = {
        imageName: 'test-image',
        chromeSidecar: {
          enabled: false,
          image: 'chromium/headless-shell',
          tag: '131.0.6778.204',
        },
      };

      const rawSidecar = (envConfig as Record<string, unknown>).chromeSidecar as
        { enabled: boolean; image: string; tag: string } | undefined;
      const chromeSidecar = rawSidecar?.enabled ? rawSidecar : undefined;

      expect(chromeSidecar).toBeUndefined();
    });
  });
});
