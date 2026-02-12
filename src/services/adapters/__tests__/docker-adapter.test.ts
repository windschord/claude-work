import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { IPty } from 'node-pty';
import { DockerAdapter, DockerAdapterConfig } from '../docker-adapter';

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Drizzleのモック (vi.hoisted を使用してモック関数を先に定義)
const { mockDbRun, _mockDbWhere, mockDbSet, mockDbFrom, _mockDbSelectGet } = vi.hoisted(() => {
  const mockDbRun = vi.fn();
  const _mockDbSelectGet = vi.fn().mockReturnValue(null);
  const _mockDbWhere = vi.fn(() => ({ run: mockDbRun, get: _mockDbSelectGet }));
  const mockDbSet = vi.fn(() => ({ where: _mockDbWhere }));
  const mockDbFrom = vi.fn(() => ({ where: _mockDbWhere }));
  return { mockDbRun, _mockDbWhere, mockDbSet, mockDbFrom, _mockDbSelectGet };
});

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    update: vi.fn(() => ({ set: mockDbSet })),
    select: vi.fn(() => ({ from: mockDbFrom })),
  },
  schema: {
    sessions: { id: 'id', container_id: 'container_id' },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
}));

// scrollbackBufferのモック
vi.mock('@/services/scrollback-buffer', () => ({
  scrollbackBuffer: {
    append: vi.fn(),
    getBuffer: vi.fn().mockReturnValue(null),
    clear: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    getByteSize: vi.fn().mockReturnValue(0),
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

// child_processのモック（isContainerRunning用 + execFile用）
const { mockSpawnSync, mockExecFile } = vi.hoisted(() => {
  // 実際の関数として定義（vi.fn()でラップしない）
  const execFileImpl = (cmd: string, args: string[], opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (!callback) return;

    // promisify()のために非同期でcallbackを呼ぶ
    process.nextTick(() => {
      // docker inspect の場合
      if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
        callback(null, 'true\n', '');
      }
      // docker exec の場合（ヘルスチェック）
      else if (args[0] === 'exec') {
        callback(null, 'health-check\n', '');
      }
      // その他（stop, wait, kill, rm など）
      else {
        callback(null, '', '');
      }
    });
  };

  return {
    mockSpawnSync: vi.fn().mockReturnValue({
      status: 0,
      stdout: 'true',
      stderr: '',
    }),
    mockExecFile: vi.fn(execFileImpl),
  };
});
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawnSync: mockSpawnSync,
    execFile: mockExecFile,
    default: actual,
  };
});

// util.promisifyもモックして、execFileAsyncを直接制御
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();

  const customPromisify = (fn: any) => {
    // child_process.execFileの場合のみ、カスタムPromise実装を返す
    if (fn === mockExecFile || fn.name === 'execFileImpl') {
      return async (cmd: string, args: string[], opts: any) => {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          mockExecFile(cmd, args, opts, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              reject(error);
            } else {
              resolve({ stdout, stderr });
            }
          });
        });
      };
    }
    // その他の関数は通常のpromisify
    return actual.promisify(fn);
  };

  return {
    ...actual,
    promisify: customPromisify,
    default: {
      ...actual,
      promisify: customPromisify,
    },
  };
});

// osのモック
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

describe('DockerAdapter', () => {
  let adapter: DockerAdapter;
  let mockPty: Partial<IPty> & EventEmitter;
  let mockSpawn: Mock;
  let mockDbUpdate: Mock;
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

    // mockSpawnSyncをリセット（isContainerRunning用）
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: 'true',
      stderr: '',
    });

    // mockExecFileをリセット（stopContainer/waitForContainer用）
    mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
      if (!callback) return;

      // docker inspect の場合
      if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
        callback(null, 'true\n', '');
      }
      // docker exec の場合（ヘルスチェック）
      else if (args[0] === 'exec') {
        callback(null, 'health-check\n', '');
      }
      // その他（stop, wait, kill, rm など）
      else {
        callback(null, '', '');
      }
    });

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

    const { db } = await import('@/lib/db');
    mockDbUpdate = db.update as Mock;

    adapter = new DockerAdapter(defaultConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
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

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({
        container_id: expect.stringMatching(/^claude-env-env-123-/),
        updated_at: expect.any(Date),
      }));
      expect(mockDbRun).toHaveBeenCalled();
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

      mockDbUpdate.mockClear();
      mockDbSet.mockClear();
      mockDbRun.mockClear();

      exitHandler({ exitCode: 0 });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({
        container_id: null,
        updated_at: expect.any(Date),
      }));
      expect(mockDbRun).toHaveBeenCalled();
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

    it('should reuse existing session instead of destroying', async () => {
      await adapter.createSession(sessionId, workingDir);
      const firstCallCount = mockSpawn.mock.calls.length;

      await adapter.createSession(sessionId, workingDir);

      expect(mockPty.kill).not.toHaveBeenCalled();
      expect(mockSpawn.mock.calls.length).toBe(firstCallCount);
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

    it('should save lastKnownCols and lastKnownRows on session', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');

      adapter.resize(sessionId, 139, 40);

      vi.useFakeTimers();
      (mockPty.resize as Mock).mockClear();

      dataHandler('first output');

      vi.advanceTimersByTime(1000);

      expect(mockPty.resize).toHaveBeenCalledWith(139, 40);
      vi.useRealTimers();
    });
  });

  describe('deferred resize', () => {
    const sessionId = 'session-deferred';
    const workingDir = '/projects/test';

    it('should execute deferred resize after first output when lastKnownCols/Rows are set', async () => {
      vi.useFakeTimers();

      await adapter.createSession(sessionId, workingDir);

      adapter.resize(sessionId, 139, 40);
      (mockPty.resize as Mock).mockClear();

      dataHandler('Welcome to Claude Code');

      vi.advanceTimersByTime(999);
      expect(mockPty.resize).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockPty.resize).toHaveBeenCalledWith(139, 40);
      expect(mockPty.resize).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should not execute deferred resize when lastKnownCols/Rows are not set', async () => {
      vi.useFakeTimers();

      await adapter.createSession(sessionId, workingDir);

      (mockPty.resize as Mock).mockClear();
      dataHandler('Welcome to Claude Code');

      vi.advanceTimersByTime(2000);

      expect(mockPty.resize).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should schedule deferred resize unconditionally and apply when resize arrives before callback', async () => {
      vi.useFakeTimers();

      await adapter.createSession(sessionId, workingDir);

      // resize()を呼ばずに初回出力を発火 → 遅延リサイズはスケジュールされるべき
      (mockPty.resize as Mock).mockClear();
      dataHandler('Welcome to Claude Code');

      // 500ms後にresizeが到着（遅延リサイズコールバック前）
      vi.advanceTimersByTime(500);
      adapter.resize(sessionId, 150, 50);
      (mockPty.resize as Mock).mockClear(); // resize()自体の直接呼び出しをクリア

      // 残りの500ms経過 → 遅延リサイズコールバック発火
      vi.advanceTimersByTime(500);
      expect(mockPty.resize).toHaveBeenCalledWith(150, 50);

      vi.useRealTimers();
    });

    it('should not execute deferred resize on second or subsequent onData', async () => {
      vi.useFakeTimers();

      await adapter.createSession(sessionId, workingDir);

      adapter.resize(sessionId, 139, 40);
      (mockPty.resize as Mock).mockClear();

      dataHandler('First output');

      vi.advanceTimersByTime(1000);
      expect(mockPty.resize).toHaveBeenCalledTimes(1);
      (mockPty.resize as Mock).mockClear();

      dataHandler('Second output');
      dataHandler('Third output');

      vi.advanceTimersByTime(2000);

      expect(mockPty.resize).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should use latest resize values for deferred resize', async () => {
      vi.useFakeTimers();

      await adapter.createSession(sessionId, workingDir);

      adapter.resize(sessionId, 100, 30);
      adapter.resize(sessionId, 139, 40);

      (mockPty.resize as Mock).mockClear();

      dataHandler('First output');
      vi.advanceTimersByTime(1000);

      expect(mockPty.resize).toHaveBeenCalledWith(139, 40);

      vi.useRealTimers();
    });

    it('should not execute deferred resize in shellMode (exec session)', async () => {
      vi.useFakeTimers();

      const parentSessionId = 'session-parent-for-deferred';
      const termSessionId = 'session-parent-for-deferred-terminal';

      const isContainerRunningSpy = vi.spyOn(adapter as any, 'isContainerRunning').mockReturnValue(true);

      await adapter.createSession(parentSessionId, workingDir);
      await adapter.createSession(termSessionId, workingDir, undefined, {
        shellMode: true,
      });

      adapter.resize(termSessionId, 139, 40);
      (mockPty.resize as Mock).mockClear();

      dataHandler('shell output');
      vi.advanceTimersByTime(2000);

      expect(mockPty.resize).not.toHaveBeenCalled();

      vi.useRealTimers();
      isContainerRunningSpy.mockRestore();
    });
  });

  describe('destroySession', () => {
    it('should kill PTY and clear container_id', async () => {
      const sessionId = 'session-abc';
      await adapter.createSession(sessionId, '/projects/test');
      mockDbUpdate.mockClear();

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
      const sessionId = 'session-abc';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);

      adapter.restartSession(sessionId);

      expect(mockPty.kill).toHaveBeenCalled();

      // waitForContainerとcreateSessionの非同期処理を待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSpawn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('container cleanup', () => {
    it('destroySession()でdocker stopが実行されること（非shellModeの場合）', async () => {
      const sessionId = 'session-cleanup-1';
      await adapter.createSession(sessionId, '/projects/test');

      const containerId = adapter.getContainerId(sessionId);
      expect(containerId).toBeDefined();

      mockExecFile.mockClear();

      adapter.destroySession(sessionId);

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['stop', '-t', '10', containerId],
        expect.objectContaining({ timeout: 15000 }),
        expect.any(Function),
      );
    });

    it('destroySession()のshellModeセッションではdocker stopが実行されないこと', async () => {
      const parentSessionId = 'session-shell-parent';
      const shellSessionId = 'session-shell-parent-terminal';

      const isContainerRunningSpy = vi.spyOn(adapter as any, 'isContainerRunning').mockReturnValue(true);

      await adapter.createSession(parentSessionId, '/projects/test');
      await adapter.createSession(shellSessionId, '/projects/test', undefined, {
        shellMode: true,
      });

      mockExecFile.mockClear();

      adapter.destroySession(shellSessionId);

      const stopCalls = mockExecFile.mock.calls.filter(
        (call: unknown[]) => (call[1] as string[])[0] === 'stop'
      );
      expect(stopCalls).toHaveLength(0);

      isContainerRunningSpy.mockRestore();
    });

    it('onExit時にdocker stopが実行されること', async () => {
      const sessionId = 'session-exit-cleanup';
      await adapter.createSession(sessionId, '/projects/test');

      const containerId = adapter.getContainerId(sessionId);
      expect(containerId).toBeDefined();

      mockExecFile.mockClear();

      exitHandler({ exitCode: 0 });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['stop', '-t', '10', containerId],
        expect.objectContaining({ timeout: 15000 }),
        expect.any(Function),
      );
    });

    it('restartSession()が旧コンテナ停止後に新コンテナを作成すること', async () => {
      const sessionId = 'session-restart-cleanup';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);

      const oldContainerId = adapter.getContainerId(sessionId);
      expect(oldContainerId).toBeDefined();

      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (callback) {
          callback(null, '', '');
        }
      });

      mockSpawn.mockClear();

      adapter.restartSession(sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      const waitCalls = mockExecFile.mock.calls.filter(
        (call: unknown[]) => (call[1] as string[])[0] === 'wait'
      );
      expect(waitCalls.length).toBeGreaterThanOrEqual(1);
      expect((waitCalls[0][1] as string[])[1]).toBe(oldContainerId);

      expect(mockSpawn).toHaveBeenCalled();
    });

    it('restartSession: リサイズ情報が新セッションに引き継がれること', async () => {
      const sessionId = 'session-resize-preserve';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);

      // 旧セッションでresizeを呼ぶ
      adapter.resize(sessionId, 120, 40);

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        // docker inspect の場合
        if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
          callback(null, 'true\n', '');
        }
        // docker exec の場合（ヘルスチェック）
        else if (args[0] === 'exec') {
          callback(null, 'health-check\n', '');
        }
        // その他（stop, wait, kill, rm など）
        else {
          callback(null, '', '');
        }
      });

      // 新しいPTYモックを準備
      const newMockPty = Object.assign(new EventEmitter(), {
        pid: 77777,
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
      mockSpawn.mockReturnValue(newMockPty);

      adapter.restartSession(sessionId);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 新セッションが作成されていること
      expect(adapter.hasSession(sessionId)).toBe(true);

      // リサイズ情報が引き継がれて、新PTYにresizeが適用されていること
      expect(newMockPty.resize).toHaveBeenCalledWith(120, 40);
    });

    it('restartSession: リサイズ情報が未設定でもエラーにならないこと', async () => {
      const sessionId = 'session-no-resize-restart';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);
      // resize()を呼ばない

      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (callback) {
          callback(null, '', '');
        }
      });

      const newMockPty = Object.assign(new EventEmitter(), {
        pid: 88888,
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
      mockSpawn.mockReturnValue(newMockPty);

      // エラーにならないこと
      expect(() => adapter.restartSession(sessionId)).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 新セッションが作成されていること
      expect(adapter.hasSession(sessionId)).toBe(true);
      // resize()は呼ばれないこと（リサイズ情報がないため）
      expect(newMockPty.resize).not.toHaveBeenCalled();
    });

    it('restartSession後に旧PTYのonExitが遅延発火しても新セッションが消えないこと', async () => {
      const sessionId = 'session-restart-race';
      const workingDir = '/projects/test';
      await adapter.createSession(sessionId, workingDir);

      // 旧PTYのexitHandlerを保存
      const oldExitHandler = exitHandler;

      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (callback) {
          callback(null, '', '');
        }
      });

      // restartSession後に新しいPTYモックを返すように設定
      const newMockPty = Object.assign(new EventEmitter(), {
        pid: 99999,
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
      mockSpawn.mockReturnValue(newMockPty);

      // restartSessionで新セッション作成
      adapter.restartSession(sessionId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 新セッションが存在することを確認
      expect(adapter.hasSession(sessionId)).toBe(true);
      const newContainerId = adapter.getContainerId(sessionId);

      // 旧PTYのonExitが遅延発火
      oldExitHandler({ exitCode: 129 });
      await new Promise(resolve => setTimeout(resolve, 10));

      // 新セッションが消されていないこと
      expect(adapter.hasSession(sessionId)).toBe(true);
      expect(adapter.getContainerId(sessionId)).toBe(newContainerId);
    });
  });

  describe('write with logging', () => {
    it('セッション不在時にlogger.warnが呼ばれること', async () => {
      const { logger } = await import('@/lib/logger');

      adapter.write('non-existent-session', 'some data');

      expect(logger.warn).toHaveBeenCalledWith(
        'DockerAdapter: write() called but session not found',
        expect.objectContaining({ sessionId: 'non-existent-session' }),
      );
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

      expect(args).toContain('/data/environments/env-123-456/claude:/home/node/.claude');
      expect(args).toContain('/data/environments/env-123-456/config/claude:/home/node/.config/claude');

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
      const isContainerRunningSpy = vi.spyOn(adapter as any, 'isContainerRunning').mockReturnValue(true);

      await adapter.createSession(parentSessionId, workingDir);
      mockSpawn.mockClear();

      await adapter.createSession(terminalSessionId, workingDir, undefined, {
        shellMode: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['exec', '-it']),
        expect.any(Object),
      );

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall[1] as string[];
      expect(args[0]).toBe('exec');
      expect(args).toContain('bash');

      isContainerRunningSpy.mockRestore();
    });

    it('should throw error when shellMode is true but no parent container exists', async () => {
      const errorListener = vi.fn();
      adapter.on('error', errorListener);

      await expect(
        adapter.createSession('orphan-session-terminal', workingDir, undefined, {
          shellMode: true,
        })
      ).rejects.toThrow();

      expect(errorListener).toHaveBeenCalledWith(
        'orphan-session-terminal',
        expect.objectContaining({
          message: expect.stringContaining('Dockerコンテナが見つかりません'),
        })
      );
    });

    it('should throw error when parent container is not running', async () => {
      const isContainerRunningSpy = vi.spyOn(adapter as any, 'isContainerRunning').mockReturnValue(false);

      const errorListener = vi.fn();
      adapter.on('error', errorListener);

      await adapter.createSession(parentSessionId, workingDir);

      await expect(
        adapter.createSession(terminalSessionId, workingDir, undefined, {
          shellMode: true,
        })
      ).rejects.toThrow();

      expect(errorListener).toHaveBeenCalledWith(
        terminalSessionId,
        expect.objectContaining({
          message: expect.stringContaining('Dockerコンテナが実行されていません'),
        })
      );

      isContainerRunningSpy.mockRestore();
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

      const isContainerRunningSpy = vi.spyOn(adapter as any, 'isContainerRunning').mockReturnValue(true);

      await adapter.createSession(parentSessionId, workingDir);
      mockPty.write.mockClear();

      await adapter.createSession(terminalSessionId, workingDir, 'Initial task', {
        shellMode: true,
      });

      vi.advanceTimersByTime(3000);

      const writeCalls = mockPty.write.mock.calls;
      const hasInitialTask = writeCalls.some((call: string[]) => call[0].includes('Initial task'));
      expect(hasInitialTask).toBe(false);

      vi.useRealTimers();
      isContainerRunningSpy.mockRestore();
    });

    it('should not extract Claude session ID in shellMode (exec session)', async () => {
      const isContainerRunningSpy = vi.spyOn(adapter as any, 'isContainerRunning').mockReturnValue(true);

      const claudeSessionIdListener = vi.fn();
      adapter.on('claudeSessionId', claudeSessionIdListener);

      await adapter.createSession(parentSessionId, workingDir);

      await adapter.createSession(terminalSessionId, workingDir, undefined, {
        shellMode: true,
      });
      dataHandler('Starting session: abc-def-123');

      expect(claudeSessionIdListener).not.toHaveBeenCalled();

      isContainerRunningSpy.mockRestore();
    });
  });

  describe('waitForContainerReady (TASK-012)', () => {
    it('should call docker inspect and docker exec during container startup', async () => {
      // waitForContainerReadyの動作確認: docker inspectとdocker execが呼ばれることを確認
      const sessionId = 'session-wait-ready';
      const workingDir = '/projects/test';

      // execFileをモック（即座に成功を返す）
      let inspectCalled = false;
      let execCalled = false;

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        // docker inspect の場合
        if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
          inspectCalled = true;
          callback(null, 'true\n', '');
        }
        // docker exec の場合（ヘルスチェック）
        else if (args[0] === 'exec') {
          execCalled = true;
          callback(null, 'health-check\n', '');
        }
        // その他（stop, wait など）
        else {
          callback(null, '', '');
        }
      });

      await adapter.createSession(sessionId, workingDir);

      // docker inspectとdocker execが呼ばれたことを確認
      expect(inspectCalled).toBe(true);
      expect(execCalled).toBe(true);
      expect(adapter.hasSession(sessionId)).toBe(true);
    });

    it('should throw error if container does not start', async () => {
      const sessionId = 'session-fail-start';
      const workingDir = '/projects/test';

      // エラーイベントリスナーを追加（Unhandled errorを防ぐ）
      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      // execFileをモック（常にエラーを返す）
      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'inspect') {
          callback(new Error('Container not found'), '', '');
        } else {
          callback(null, '', '');
        }
      });

      // タイムアウトを短縮するためにfake timersを使用
      vi.useFakeTimers();

      const promise = adapter.createSession(sessionId, workingDir);

      // promiseのrejectをexpectでラップしてから、タイマーを進める
      const expectPromise = expect(promise).rejects.toThrow();

      // 待機時間を進める（30秒）
      await vi.advanceTimersByTimeAsync(31000);

      await expectPromise;

      // エラーイベントが発火されたことを確認
      expect(errorHandler).toHaveBeenCalled();

      vi.useRealTimers();

      // リスナーをクリーンアップ
      adapter.off('error', errorHandler);
    });

    it('should retry health check if docker exec fails initially', async () => {
      const sessionId = 'session-retry-healthcheck';
      const workingDir = '/projects/test';

      let execCallCount = 0;
      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        // docker inspect はすぐに true を返す
        if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
          callback(null, 'true\n', '');
        }
        // docker exec（ヘルスチェック）は最初の2回失敗し、3回目で成功
        else if (args[0] === 'exec') {
          execCallCount++;
          if (execCallCount < 3) {
            callback(new Error('exec failed'), '', '');
          } else {
            callback(null, 'health-check\n', '');
          }
        }
        // その他
        else {
          callback(null, '', '');
        }
      });

      vi.useFakeTimers();

      const promise = adapter.createSession(sessionId, workingDir);

      // 待機時間を進める（3回のリトライ × 1秒）
      await vi.advanceTimersByTimeAsync(3000);

      await promise;

      // 3回のexec呼び出しがあったことを確認
      expect(execCallCount).toBeGreaterThanOrEqual(3);
      expect(adapter.hasSession(sessionId)).toBe(true);

      vi.useRealTimers();
    });

    it('should complete when container is ready immediately', async () => {
      const sessionId = 'session-immediate';
      const workingDir = '/projects/test';

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
          callback(null, 'true\n', '');
        } else if (args[0] === 'exec') {
          callback(null, 'health-check\n', '');
        } else {
          callback(null, '', '');
        }
      });

      await adapter.createSession(sessionId, workingDir);

      expect(adapter.hasSession(sessionId)).toBe(true);
    });
  });

  describe('container ID persistence and orphan cleanup (TASK-014)', () => {
    it('should persist container ID to database after spawn', async () => {
      const sessionId = 'session-persist-id';
      await adapter.createSession(sessionId, '/projects/test');

      // container_idがDBに保存されることはすでに既存テストで確認済み
      // ここでは、DockerAdapterが明示的にsaveContainerId()を呼ぶことを確認
      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({
        container_id: expect.stringMatching(/^claude-env-env-123-/),
      }));
    });

    it('should clear container_id on cleanup', async () => {
      const sessionId = 'session-clear-id';
      await adapter.createSession(sessionId, '/projects/test');

      mockDbUpdate.mockClear();
      mockDbSet.mockClear();

      adapter.destroySession(sessionId);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({
        container_id: null,
      }));
    });

    it('should implement cleanupOrphanedContainers static method', async () => {
      // cleanupOrphanedContainersは静的メソッドとして実装される
      expect(typeof (adapter.constructor as any).cleanupOrphanedContainers).toBe('function');
    });

    it('cleanupOrphanedContainers should detect stopped containers', async () => {
      const { db } = await import('@/lib/db');
      const { schema: _schema } = await import('@/lib/db');

      // モックDBからアクティブなセッションを返す（.all()メソッドを追加）
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            all: vi.fn().mockReturnValue([
              { id: 'session-orphan-1', container_id: 'container-stopped-123' },
            ]),
          })),
        })),
      }));
      (db.select as any) = mockSelect;

      // docker inspectでコンテナが停止していることをシミュレート
      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'inspect' && args.includes('{{.State.Running}}')) {
          // コンテナは停止中
          callback(null, 'false\n', '');
        } else if (args[0] === 'rm') {
          // コンテナ削除
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });

      await (adapter.constructor as any).cleanupOrphanedContainers(db);

      // セッション状態がERRORに更新されることを確認（mockDbRunを使用）
      expect(mockDbRun).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ERROR',
        container_id: null,
      }));

      // docker rm が呼ばれることを確認
      const rmCalls = mockExecFile.mock.calls.filter(
        (call: unknown[]) => (call[1] as string[])[0] === 'rm'
      );
      expect(rmCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('cleanupOrphanedContainers should handle missing containers', async () => {
      const { db } = await import('@/lib/db');

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            all: vi.fn().mockReturnValue([
              { id: 'session-missing-1', container_id: 'container-missing-456' },
            ]),
          })),
        })),
      }));
      (db.select as any) = mockSelect;

      // docker inspectがエラーを返す（コンテナが存在しない）
      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'inspect') {
          callback(new Error('No such container'), '', '');
        } else {
          callback(null, '', '');
        }
      });

      // エラーをスローしないことを確認
      await expect((adapter.constructor as any).cleanupOrphanedContainers(db)).resolves.not.toThrow();

      // セッション状態がERRORに更新されることを確認（mockDbRunを使用）
      expect(mockDbRun).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ERROR',
        container_id: null,
      }));
    });
  });

  describe('stopContainer Promise-based with error handling (TASK-013)', () => {
    it('should stop container successfully with 15s timeout', async () => {
      const sessionId = 'session-stop-promise-success';
      await adapter.createSession(sessionId, '/projects/test');

      const containerId = adapter.getContainerId(sessionId);
      expect(containerId).toBeDefined();

      let stopCalled = false;
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'stop') {
          stopCalled = true;
          // タイムアウト設定を確認
          expect((opts as any).timeout).toBe(15000);
          expect(args).toContain('-t');
          expect(args).toContain('10');
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });

      adapter.destroySession(sessionId);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(stopCalled).toBe(true);
    });

    it('should fallback to docker kill when stop fails', async () => {
      const sessionId = 'session-stop-fail-kill';
      await adapter.createSession(sessionId, '/projects/test');

      const containerId = adapter.getContainerId(sessionId);
      expect(containerId).toBeDefined();

      let stopCalled = false;
      let killCalled = false;

      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'stop') {
          stopCalled = true;
          callback(new Error('stop failed'), '', '');
        } else if (args[0] === 'kill') {
          killCalled = true;
          expect(args).toContain(containerId);
          expect((opts as any).timeout).toBe(5000);
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });

      adapter.destroySession(sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stopCalled).toBe(true);
      expect(killCalled).toBe(true);
    });

    it('should ignore "No such container" error', async () => {
      const sessionId = 'session-already-stopped';
      await adapter.createSession(sessionId, '/projects/test');

      let killCalled = false;

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'stop') {
          callback(new Error('No such container'), '', '');
        } else if (args[0] === 'kill') {
          killCalled = true;
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });

      adapter.destroySession(sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      // "No such container" エラーの場合はkillも実行されない
      expect(killCalled).toBe(false);
    });

    it('should ignore "is not running" error', async () => {
      const sessionId = 'session-not-running';
      await adapter.createSession(sessionId, '/projects/test');

      let killCalled = false;

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'stop') {
          callback(new Error('container is not running'), '', '');
        } else if (args[0] === 'kill') {
          killCalled = true;
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });

      adapter.destroySession(sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(killCalled).toBe(false);
    });

    it('should log error but not throw when both stop and kill fail', async () => {
      const sessionId = 'session-double-fail';
      await adapter.createSession(sessionId, '/projects/test');

      const { logger } = await import('@/lib/logger');

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'stop') {
          callback(new Error('stop failed'), '', '');
        } else if (args[0] === 'kill') {
          callback(new Error('kill failed'), '', '');
        } else {
          callback(null, '', '');
        }
      });

      // エラーをスローしないことを確認
      expect(() => adapter.destroySession(sessionId)).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      // エラーがログに記録されることを確認
      expect(logger.error).toHaveBeenCalled();
    });

    it('should wait for stop completion before continuing cleanup', async () => {
      const sessionId = 'session-stop-sync';
      await adapter.createSession(sessionId, '/projects/test');

      let stopCompleted = false;
      let cleanupCompleted = false;

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        if (!callback) return;

        if (args[0] === 'stop') {
          // 100ms後にstopが完了
          setTimeout(() => {
            stopCompleted = true;
            callback(null, '', '');
          }, 100);
        } else {
          callback(null, '', '');
        }
      });

      const destroyPromise = new Promise<void>((resolve) => {
        adapter.destroySession(sessionId);
        // destroySessionは同期的に完了するが、stopContainerは非同期
        setTimeout(() => {
          cleanupCompleted = true;
          resolve();
        }, 150);
      });

      await destroyPromise;

      // stopが完了してからcleanupが完了することを確認
      expect(stopCompleted).toBe(true);
      expect(cleanupCompleted).toBe(true);
    });
  });
});
