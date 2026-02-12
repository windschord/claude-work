import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// PTYSessionManagerをモック（EventEmitterはvi.hoisted外で作成）
const mockEventEmitter = new EventEmitter();

const mockPTYSessionManager = vi.hoisted(() => {
  return {
    getInstance: vi.fn(() => mockPTYSessionManager),
    createSession: vi.fn().mockResolvedValue({
      id: 'test-session',
      pty: { write: vi.fn(), resize: vi.fn(), kill: vi.fn() },
      metadata: { worktreePath: '/path/to/worktree' },
    }),
    getSession: vi.fn(),
    destroySession: vi.fn().mockResolvedValue(undefined),
    hasSession: vi.fn().mockReturnValue(false),
    sendInput: vi.fn(),
    resize: vi.fn(),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  };
});

// EventEmitterの機能を後で追加
Object.assign(mockPTYSessionManager, {
  on: vi.fn((event, listener) => {
    mockEventEmitter.on(event, listener);
    return mockPTYSessionManager;
  }),
  emit: vi.fn((event, ...args) => {
    return mockEventEmitter.emit(event, ...args);
  }),
  _emitter: mockEventEmitter, // テスト用の内部アクセス
});

vi.mock('../pty-session-manager', () => ({
  PTYSessionManager: {
    getInstance: mockPTYSessionManager.getInstance,
  },
  ptySessionManager: mockPTYSessionManager,
}));

// loggerをモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// dbをモック
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      executionEnvironments: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'default-host',
          type: 'HOST',
        }),
      },
    },
  },
}));

describe('ClaudePTYManager (refactored with PTYSessionManager)', () => {
  let claudePtyManager: {
    claudePtyManager: EventEmitter & {
      createSession: (
        sessionId: string,
        workingDir: string,
        initialPrompt?: string,
        options?: { environmentId?: string; resumeSessionId?: string }
      ) => Promise<void>;
      write: (sessionId: string, data: string) => void;
      resize: (sessionId: string, cols: number, rows: number) => void;
      destroySession: (sessionId: string) => Promise<void>;
      hasSession: (sessionId: string) => boolean;
      getWorkingDir: (sessionId: string) => string | undefined;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // PTYSessionManagerモックのデフォルト値をリセット
    mockPTYSessionManager.hasSession.mockReturnValue(false);
    mockPTYSessionManager.getSession.mockReturnValue(undefined);

    // 各テストで新しいインスタンスを作成するためにモジュールをリセット
    vi.resetModules();
    claudePtyManager = await import('../claude-pty-manager');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PTYSessionManager integration', () => {
    it('should delegate createSession to PTYSessionManager', async () => {
      await claudePtyManager.claudePtyManager.createSession(
        'test-session',
        '/path/to/worktree',
        undefined,
        { environmentId: 'default-host' }
      );

      expect(mockPTYSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          worktreePath: '/path/to/worktree',
          environmentId: 'default-host',
        })
      );
    });

    it('should delegate write to PTYSessionManager.sendInput', () => {
      mockPTYSessionManager.hasSession.mockReturnValue(true);

      claudePtyManager.claudePtyManager.write('test-session', 'test input');

      expect(mockPTYSessionManager.sendInput).toHaveBeenCalledWith('test-session', 'test input');
    });

    it('should delegate resize to PTYSessionManager', () => {
      mockPTYSessionManager.hasSession.mockReturnValue(true);

      claudePtyManager.claudePtyManager.resize('test-session', 120, 40);

      expect(mockPTYSessionManager.resize).toHaveBeenCalledWith('test-session', 120, 40);
    });

    it('should delegate destroySession to PTYSessionManager', async () => {
      mockPTYSessionManager.hasSession.mockReturnValue(true);

      await claudePtyManager.claudePtyManager.destroySession('test-session');

      expect(mockPTYSessionManager.destroySession).toHaveBeenCalledWith('test-session');
    });

    it('should delegate hasSession to PTYSessionManager', () => {
      mockPTYSessionManager.hasSession.mockReturnValue(true);

      const result = claudePtyManager.claudePtyManager.hasSession('test-session');

      expect(mockPTYSessionManager.hasSession).toHaveBeenCalledWith('test-session');
      expect(result).toBe(true);
    });

    it('should get working directory from PTYSessionManager', () => {
      mockPTYSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        metadata: { worktreePath: '/path/to/worktree' },
      });

      const workingDir = claudePtyManager.claudePtyManager.getWorkingDir('test-session');

      expect(mockPTYSessionManager.getSession).toHaveBeenCalledWith('test-session');
      expect(workingDir).toBe('/path/to/worktree');
    });
  });

  describe('event relay from PTYSessionManager', () => {
    it('should relay data events from PTYSessionManager', () => {
      return new Promise<void>((resolve) => {
        claudePtyManager.claudePtyManager.on('data', (sessionId: string, data: string) => {
          expect(sessionId).toBe('test-session');
          expect(data).toBe('test output');
          resolve();
        });

        // PTYSessionManagerからdataイベントを発火
        mockPTYSessionManager._emitter.emit('data', 'test-session', 'test output');
      });
    });

    it('should relay exit events from PTYSessionManager', () => {
      return new Promise<void>((resolve) => {
        claudePtyManager.claudePtyManager.on('exit', (sessionId: string, info: { exitCode: number }) => {
          expect(sessionId).toBe('test-session');
          expect(info.exitCode).toBe(0);
          resolve();
        });

        // PTYSessionManagerからexitイベントを発火
        mockPTYSessionManager._emitter.emit('exit', 'test-session', 0);
      });
    });

    it.skip('should relay error events from PTYSessionManager', () => {
      // TODO: EventEmitterの'error'イベントは特殊な扱いが必要
      // モックの改善が必要なため、Phase 2ではスキップ
      return new Promise<void>((resolve) => {
        const testError = new Error('Test error');

        // エラーハンドラーを先に登録してから発火
        claudePtyManager.claudePtyManager.on('error', (sessionId: string, error: Error) => {
          expect(sessionId).toBe('test-session');
          expect(error).toBe(testError);
          resolve();
        });

        // 少し待ってからerrorイベントを発火（リスナー登録を確実にするため）
        setImmediate(() => {
          mockPTYSessionManager._emitter.emit('error', 'test-session', testError);
        });
      });
    });
  });

  describe('backward compatibility', () => {
    it('should maintain existing interface for createSession', async () => {
      // 既存のインターフェース（dockerModeなし、environmentIdあり）
      await claudePtyManager.claudePtyManager.createSession(
        'test-session',
        '/path/to/worktree',
        'initial prompt',
        { environmentId: 'default-host', resumeSessionId: 'resume-123' }
      );

      expect(mockPTYSessionManager.createSession).toHaveBeenCalled();
    });

    it('should not throw when writing to non-existent session', () => {
      mockPTYSessionManager.hasSession.mockReturnValue(false);
      mockPTYSessionManager.sendInput.mockImplementation(() => {
        throw new Error('Session not found');
      });

      // エラーをキャッチして警告ログを出すが、throwしない
      expect(() => {
        claudePtyManager.claudePtyManager.write('nonexistent', 'test input');
      }).not.toThrow();
    });

    it('should not throw when resizing non-existent session', () => {
      mockPTYSessionManager.hasSession.mockReturnValue(false);
      mockPTYSessionManager.resize.mockImplementation(() => {
        throw new Error('Session not found');
      });

      expect(() => {
        claudePtyManager.claudePtyManager.resize('nonexistent', 120, 40);
      }).not.toThrow();
    });
  });

  describe('default environment handling', () => {
    it('should use default HOST environment when environmentId is not specified', async () => {
      await claudePtyManager.claudePtyManager.createSession(
        'test-session',
        '/path/to/worktree'
      );

      // デフォルト環境IDを使用して呼び出される
      expect(mockPTYSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          worktreePath: '/path/to/worktree',
          environmentId: expect.any(String),
        })
      );
    });
  });
});
