import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { IPty } from 'node-pty';
import { DockerAdapter, DockerAdapterConfig } from '../docker-adapter';

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Prismaのモック
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

// loggerのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// fsのモック
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// osのモック
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

describe('DockerAdapter', () => {
  let adapter: DockerAdapter;
  let mockPty: Partial<IPty> & EventEmitter;
  let mockSpawn: Mock;
  let mockPrismaUpdate: Mock;
  let dataHandler: (data: string) => void;
  let exitHandler: (info: { exitCode: number; signal?: number }) => void;

  const defaultConfig: DockerAdapterConfig = {
    environmentId: 'env-123-456',
    imageName: 'claude-code-env',
    imageTag: 'v1.0',
    authDirPath: '/data/environments/env-123-456',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // PTYモックの設定
    mockPty = Object.assign(new EventEmitter(), {
      pid: 12345,
      cols: 80,
      rows: 24,
      process: 'docker',
      handleFlowControl: false,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      clear: vi.fn(),
      onData: vi.fn((handler: (data: string) => void) => {
        dataHandler = handler;
        return { dispose: vi.fn() };
      }),
      onExit: vi.fn((handler: (info: { exitCode: number; signal?: number }) => void) => {
        exitHandler = handler;
        return { dispose: vi.fn() };
      }),
    });

    const pty = await import('node-pty');
    mockSpawn = pty.spawn as Mock;
    mockSpawn.mockReturnValue(mockPty);

    const { prisma } = await import('@/lib/db');
    mockPrismaUpdate = prisma.session.update as Mock;

    adapter = new DockerAdapter(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(adapter).toBeInstanceOf(EventEmitter);
    });
  });

  describe('createSession', () => {
    const sessionId = 'session-abc-123';
    const workingDir = '/projects/my-project';

    it('should spawn docker process with correct arguments', async () => {
      await adapter.createSession(sessionId, workingDir);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run', '-it', '--rm',
          '--name', expect.stringMatching(/^claude-env-env-123-/),
          '--cap-drop', 'ALL',
          '--security-opt', 'no-new-privileges',
          '-v', `${workingDir}:/workspace`,
          '-v', '/data/environments/env-123-456/claude:/home/node/.claude',
          '-v', '/data/environments/env-123-456/config/claude:/home/node/.config/claude',
          '--entrypoint', 'claude',
          'claude-code-env:v1.0',
        ]),
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
        }),
      );
    });

    it('should update Session.container_id in database', async () => {
      await adapter.createSession(sessionId, workingDir);

      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { container_id: expect.stringMatching(/^claude-env-env-123-/) },
      });
    });

    it('should emit data events from PTY', async () => {
      const dataPromise = new Promise<{ sid: string; data: string }>((resolve) => {
        adapter.on('data', (sid, data) => resolve({ sid, data }));
      });

      await adapter.createSession(sessionId, workingDir);
      dataHandler('Hello from Claude');

      const result = await dataPromise;
      expect(result.sid).toBe(sessionId);
      expect(result.data).toBe('Hello from Claude');
    });

    it('should emit exit events when PTY exits', async () => {
      const exitPromise = new Promise<{ sid: string; info: { exitCode: number } }>((resolve) => {
        adapter.on('exit', (sid, info) => resolve({ sid, info }));
      });

      await adapter.createSession(sessionId, workingDir);
      exitHandler({ exitCode: 0 });

      const result = await exitPromise;
      expect(result.sid).toBe(sessionId);
      expect(result.info.exitCode).toBe(0);
    });

    it('should clear container_id on exit', async () => {
      await adapter.createSession(sessionId, workingDir);

      // リセットしてexit時の呼び出しを確認
      mockPrismaUpdate.mockClear();

      exitHandler({ exitCode: 0 });

      // 非同期処理を待つ
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { container_id: null },
      });
    });

    it('should add --resume flag when resumeSessionId is provided', async () => {
      await adapter.createSession(sessionId, workingDir, undefined, {
        resumeSessionId: 'previous-session-id',
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['--resume', 'previous-session-id']),
        expect.any(Object),
      );
    });

    it('should destroy existing session before creating new one', async () => {
      // 最初のセッションを作成
      await adapter.createSession(sessionId, workingDir);

      // 2回目のセッション作成
      await adapter.createSession(sessionId, workingDir);

      // killが呼ばれていることを確認
      expect(mockPty.kill).toHaveBeenCalled();
    });

    it('should send initial prompt after delay', async () => {
      vi.useFakeTimers();

      await adapter.createSession(sessionId, workingDir, 'Initial task');

      expect(mockPty.write).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);

      expect(mockPty.write).toHaveBeenCalledWith('Initial task\n');

      vi.useRealTimers();
    });

    it('should extract Claude session ID from output', async () => {
      const claudeSessionIdPromise = new Promise<{ sid: string; claudeSessionId: string }>((resolve) => {
        adapter.on('claudeSessionId', (sid, claudeSessionId) => resolve({ sid, claudeSessionId }));
      });

      await adapter.createSession(sessionId, workingDir);
      dataHandler('Starting session: abc-def-123');

      const result = await claudeSessionIdPromise;
      expect(result.sid).toBe(sessionId);
      expect(result.claudeSessionId).toBe('abc-def-123');
    });
  });

  describe('write', () => {
    it('should write data to PTY', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');

      adapter.write(sessionId, 'some input');

      expect(mockPty.write).toHaveBeenCalledWith('some input');
    });

    it('should do nothing for non-existent session', () => {
      expect(() => adapter.write('non-existent', 'data')).not.toThrow();
    });
  });

  describe('resize', () => {
    it('should resize PTY', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');

      adapter.resize(sessionId, 120, 40);

      expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
    });

    it('should do nothing for non-existent session', () => {
      expect(() => adapter.resize('non-existent', 120, 40)).not.toThrow();
    });
  });

  describe('destroySession', () => {
    it('should kill PTY and clear container_id', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');
      mockPrismaUpdate.mockClear();

      adapter.destroySession(sessionId);

      expect(mockPty.kill).toHaveBeenCalled();
      expect(adapter.hasSession(sessionId)).toBe(false);
    });

    it('should do nothing for non-existent session', () => {
      expect(() => adapter.destroySession('non-existent')).not.toThrow();
    });
  });

  describe('restartSession', () => {
    it('should destroy and recreate session', async () => {
      vi.useFakeTimers();

      const sessionId = 'session-abc';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);

      adapter.restartSession(sessionId);

      expect(mockPty.kill).toHaveBeenCalled();

      // mockSpawnをリセット
      mockSpawn.mockClear();

      vi.advanceTimersByTime(500);

      expect(mockSpawn).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('hasSession', () => {
    it('should return true for existing session', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');

      expect(adapter.hasSession(sessionId)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(adapter.hasSession('non-existent')).toBe(false);
    });
  });

  describe('getWorkingDir', () => {
    it('should return working directory for existing session', async () => {
      const sessionId = 'session-abc';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);

      expect(adapter.getWorkingDir(sessionId)).toBe(workingDir);
    });

    it('should return undefined for non-existent session', () => {
      expect(adapter.getWorkingDir('non-existent')).toBeUndefined();
    });
  });

  describe('getContainerId', () => {
    it('should return container ID for existing session', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');

      const containerId = adapter.getContainerId(sessionId);
      expect(containerId).toMatch(/^claude-env-env-123-/);
    });

    it('should return undefined for non-existent session', () => {
      expect(adapter.getContainerId('non-existent')).toBeUndefined();
    });
  });

  describe('environment-specific auth directory mounting', () => {
    it('should mount environment-specific auth directories instead of host directories', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall[1] as string[];

      // 環境専用ディレクトリがマウントされている
      expect(args).toContain('/data/environments/env-123-456/claude:/home/node/.claude');
      expect(args).toContain('/data/environments/env-123-456/config/claude:/home/node/.config/claude');

      // ホストの認証ディレクトリはマウントされていない
      expect(args).not.toContain('/home/testuser/.claude:/home/node/.claude');
      expect(args).not.toContain('/home/testuser/.config/claude:/home/node/.config/claude');
    });
  });

  describe('EnvironmentAdapter interface compliance', () => {
    it('should implement all required methods', () => {
      expect(typeof adapter.createSession).toBe('function');
      expect(typeof adapter.write).toBe('function');
      expect(typeof adapter.resize).toBe('function');
      expect(typeof adapter.destroySession).toBe('function');
      expect(typeof adapter.restartSession).toBe('function');
      expect(typeof adapter.hasSession).toBe('function');
      expect(typeof adapter.getWorkingDir).toBe('function');
    });

    it('should extend EventEmitter', () => {
      expect(adapter).toBeInstanceOf(EventEmitter);
      expect(typeof adapter.on).toBe('function');
      expect(typeof adapter.emit).toBe('function');
    });
  });

  describe('shellMode', () => {
    const parentSessionId = 'session-parent-123';
    const terminalSessionId = 'session-parent-123-terminal';
    const workingDir = '/projects/my-project';

    it('should use docker exec to attach to existing container when shellMode is true', async () => {
      // 親セッション（Claude）を作成
      await adapter.createSession(parentSessionId, workingDir);
      mockSpawn.mockClear();

      // シェルセッション（-terminal サフィックス付き）を作成
      await adapter.createSession(terminalSessionId, workingDir, undefined, {
        shellMode: true,
      });

      // docker exec が呼ばれることを確認
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['exec', '-it']),
        expect.any(Object),
      );

      // docker run ではなく exec が使われている
      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall[1] as string[];
      expect(args[0]).toBe('exec');
      expect(args).toContain('bash');
    });

    it('should throw error when shellMode is true but no parent container exists', async () => {
      const errorListener = vi.fn();
      adapter.on('error', errorListener);

      // 親セッションなしでシェルセッションを作成
      await expect(
        adapter.createSession('orphan-session-terminal', workingDir, undefined, {
          shellMode: true,
        })
      ).rejects.toThrow();

      // エラーイベントが発行されることを確認
      expect(errorListener).toHaveBeenCalledWith(
        'orphan-session-terminal',
        expect.objectContaining({
          message: expect.stringContaining('No parent container found'),
        })
      );
    });

    it('should use --entrypoint claude when shellMode is false', async () => {
      await adapter.createSession(parentSessionId, workingDir, undefined, {
        shellMode: false,
      });

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall[1] as string[];
      const entrypointIndex = args.indexOf('--entrypoint');
      expect(args[entrypointIndex + 1]).toBe('claude');
    });

    it('should use --entrypoint claude when shellMode is not specified', async () => {
      await adapter.createSession(parentSessionId, workingDir);

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall[1] as string[];
      const entrypointIndex = args.indexOf('--entrypoint');
      expect(args[entrypointIndex + 1]).toBe('claude');
    });

    it('should not send initial prompt in shellMode (exec session)', async () => {
      vi.useFakeTimers();

      // 親セッションを作成
      await adapter.createSession(parentSessionId, workingDir);
      mockPty.write.mockClear();

      // シェルセッションを作成
      await adapter.createSession(terminalSessionId, workingDir, 'Initial task', {
        shellMode: true,
      });

      vi.advanceTimersByTime(3000);

      // shellModeでは初期プロンプトを送信しない（cd /workspace のみ）
      const writeCalls = mockPty.write.mock.calls;
      const hasInitialTask = writeCalls.some((call: string[]) => call[0].includes('Initial task'));
      expect(hasInitialTask).toBe(false);

      vi.useRealTimers();
    });

    it('should not extract Claude session ID in shellMode (exec session)', async () => {
      const claudeSessionIdListener = vi.fn();
      adapter.on('claudeSessionId', claudeSessionIdListener);

      // 親セッションを作成
      await adapter.createSession(parentSessionId, workingDir);

      // シェルセッションを作成
      await adapter.createSession(terminalSessionId, workingDir, undefined, {
        shellMode: true,
      });
      dataHandler('Starting session: abc-def-123');

      // shellModeではClaudeセッションID抽出をスキップ
      expect(claudeSessionIdListener).not.toHaveBeenCalled();
    });
  });
});
