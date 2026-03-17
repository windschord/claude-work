import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPty } from 'node-pty';
import type { CreateSessionOptions } from '../environment-adapter';
import * as pty from 'node-pty';
import { BasePTYAdapter } from '../base-adapter';

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// loggerのモック
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// BasePTYAdapterのテスト用具象クラス
class TestPTYAdapter extends BasePTYAdapter {
  createSession(
    _sessionId: string,
    _workingDir: string,
    _initialPrompt?: string,
    _options?: CreateSessionOptions
  ): void | Promise<void> {
    throw new Error('Not implemented');
  }

  destroySession(_sessionId: string): void | Promise<void> {
    throw new Error('Not implemented');
  }

  // テスト用のpublicメソッド
  public testSpawnPTY(command: string, args: string[], options: any): IPty {
    return this.spawnPTY(command, args, options);
  }

  public testSetupDataHandlers(pty: IPty, sessionId: string): void {
    this.setupDataHandlers(pty, sessionId);
  }

  public testSetupErrorHandlers(pty: IPty, sessionId: string): void {
    this.setupErrorHandlers(pty, sessionId);
  }

  public async testCleanupPTY(pty: IPty): Promise<void> {
    await this.cleanupPTY(pty);
  }

  public testExtractClaudeSessionId(data: string): string | null {
    return this.extractClaudeSessionId(data);
  }
}

describe('BasePTYAdapter', () => {
  let adapter: TestPTYAdapter;
  let mockPty: IPty;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TestPTYAdapter();

    // モックPTYインスタンス
    mockPty = {
      onData: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      pid: 12345,
      cols: 80,
      rows: 24,
      process: 'test',
      handleFlowControl: false,
      clear: vi.fn(),
    } as unknown as IPty;

    vi.mocked(pty.spawn).mockReturnValue(mockPty);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('spawnPTY', () => {
    it('should set default cols/rows to 80x24', () => {
      adapter.testSpawnPTY('claude', [], {});

      expect(vi.mocked(pty.spawn)).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          cols: 80,
          rows: 24,
        })
      );
    });

    it('should use provided cols/rows when specified', () => {
      adapter.testSpawnPTY('claude', [], { cols: 120, rows: 30 });

      expect(vi.mocked(pty.spawn)).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          cols: 120,
          rows: 30,
        })
      );
    });

    it('should set TERM and COLORTERM environment variables', () => {
      adapter.testSpawnPTY('claude', [], { cwd: '/test' });

      expect(vi.mocked(pty.spawn)).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          }),
        })
      );
    });

    it('should call pty.spawn with correct arguments', () => {
      const command = 'docker';
      const args = ['exec', '-it', 'container', 'bash'];
      const cwd = '/workspace';

      adapter.testSpawnPTY(command, args, { cwd, cols: 100, rows: 40 });

      expect(vi.mocked(pty.spawn)).toHaveBeenCalledWith(
        command,
        args,
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 100,
          rows: 40,
          cwd: '/workspace',
        })
      );
    });
  });

  describe('setupDataHandlers', () => {
    it('should register pty.onData listener', () => {
      adapter.testSetupDataHandlers(mockPty, 'test-session');

      expect(mockPty.onData).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should emit data event when PTY outputs data', () => {
      const dataListener = vi.fn();
      adapter.on('data', dataListener);

      adapter.testSetupDataHandlers(mockPty, 'test-session');

      // onDataコールバックを取得して実行
      const onDataCallback = (mockPty.onData as ReturnType<typeof vi.fn>).mock.calls[0][0];
      onDataCallback('test data');

      expect(dataListener).toHaveBeenCalledWith('test-session', 'test data');
    });

    it('should emit claudeSessionId event when Session ID is detected', () => {
      const sessionIdListener = vi.fn();
      adapter.on('claudeSessionId', sessionIdListener);

      adapter.testSetupDataHandlers(mockPty, 'test-session');

      // onDataコールバックを取得して実行
      const onDataCallback = (mockPty.onData as ReturnType<typeof vi.fn>).mock.calls[0][0];
      onDataCallback('Session ID: 12345678-1234-1234-1234-123456789abc');

      expect(sessionIdListener).toHaveBeenCalledWith(
        'test-session',
        '12345678-1234-1234-1234-123456789abc'
      );
    });
  });

  describe('setupErrorHandlers', () => {
    it('should register pty.onExit listener', () => {
      adapter.testSetupErrorHandlers(mockPty, 'test-session');

      expect(mockPty.onExit).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should emit exit event when PTY exits', () => {
      const exitListener = vi.fn();
      adapter.on('exit', exitListener);

      adapter.testSetupErrorHandlers(mockPty, 'test-session');

      // onExitコールバックを取得して実行
      const onExitCallback = (mockPty.onExit as ReturnType<typeof vi.fn>).mock.calls[0][0];
      onExitCallback({ exitCode: 0, signal: undefined });

      expect(exitListener).toHaveBeenCalledWith('test-session', {
        exitCode: 0,
        signal: undefined,
      });
    });
  });

  describe('cleanupPTY', () => {
    it('should call pty.kill()', async () => {
      await adapter.testCleanupPTY(mockPty);

      expect(mockPty.kill).toHaveBeenCalled();
    });
  });

  describe('extractClaudeSessionId', () => {
    it('should extract session ID from data when pattern matches', () => {
      const data = 'Some text\nSession ID: abcdef12-3456-7890-abcd-ef1234567890\nMore text';
      const result = adapter.testExtractClaudeSessionId(data);

      expect(result).toBe('abcdef12-3456-7890-abcd-ef1234567890');
    });

    it('should return null when pattern does not match', () => {
      const data = 'Some text without session ID';
      const result = adapter.testExtractClaudeSessionId(data);

      expect(result).toBeNull();
    });

    it('should extract from session: format', () => {
      const data = 'session: abc123-def456';
      const result = adapter.testExtractClaudeSessionId(data);

      expect(result).toBe('abc123-def456');
    });

    it('should extract from bracket format [session:id]', () => {
      const data = 'output [session:my-session-id] more';
      const result = adapter.testExtractClaudeSessionId(data);

      expect(result).toBe('my-session-id');
    });

    it('should not emit claudeSessionId for data without session ID', () => {
      const sessionIdListener = vi.fn();
      adapter.on('claudeSessionId', sessionIdListener);

      adapter.testSetupDataHandlers(mockPty, 'test-session');

      const onDataCallback = (mockPty.onData as ReturnType<typeof vi.fn>).mock.calls[0][0];
      onDataCallback('normal output without session id');

      expect(sessionIdListener).not.toHaveBeenCalled();
    });
  });

  describe('spawnPTY args sanitization', () => {
    it('should redact flag values with = sign', () => {
      adapter.testSpawnPTY('claude', ['--token=secret123'], {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Spawning PTY process with args',
        expect.objectContaining({
          args: ['--token=REDACTED'],
        })
      );
    });

    it('should keep flags without values', () => {
      adapter.testSpawnPTY('claude', ['--verbose'], {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Spawning PTY process with args',
        expect.objectContaining({
          args: ['--verbose'],
        })
      );
    });

    it('should redact positional arguments', () => {
      adapter.testSpawnPTY('claude', ['my-secret-prompt'], {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Spawning PTY process with args',
        expect.objectContaining({
          args: ['REDACTED'],
        })
      );
    });

    it('should handle flags with empty value after =', () => {
      adapter.testSpawnPTY('claude', ['--key='], {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Spawning PTY process with args',
        expect.objectContaining({
          args: ['--key'],
        })
      );
    });

    it('should log info with command and dimensions', () => {
      adapter.testSpawnPTY('claude', [], { cols: 100, rows: 40, cwd: '/test' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Spawning PTY process',
        expect.objectContaining({
          command: 'claude',
          cols: 100,
          rows: 40,
          cwd: '/test',
        })
      );
    });
  });

  describe('spawnPTY environment', () => {
    it('should merge custom env vars with inherited env', () => {
      adapter.testSpawnPTY('claude', [], { env: { MY_VAR: 'value' } });

      expect(vi.mocked(pty.spawn)).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            MY_VAR: 'value',
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          }),
        })
      );
    });

    it('should exclude CLAUDECODE from environment', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, CLAUDECODE: 'should-be-excluded' };

      adapter.testSpawnPTY('claude', [], {});

      const spawnCall = vi.mocked(pty.spawn).mock.calls[0];
      const envArg = spawnCall[2].env;
      expect(envArg).not.toHaveProperty('CLAUDECODE');

      process.env = originalEnv;
    });
  });

  describe('setupErrorHandlers logging', () => {
    it('should log exit info with sessionId, exitCode and signal', () => {
      adapter.testSetupErrorHandlers(mockPty, 'test-session');

      const onExitCallback = (mockPty.onExit as ReturnType<typeof vi.fn>).mock.calls[0][0];
      onExitCallback({ exitCode: 1, signal: 15 });

      expect(mockLogger.info).toHaveBeenCalledWith('PTY process exited', {
        sessionId: 'test-session',
        exitCode: 1,
        signal: 15,
      });
    });
  });

  describe('cleanupPTY logging', () => {
    it('should log cleanup info', async () => {
      await adapter.testCleanupPTY(mockPty);

      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up PTY process');
    });
  });

  describe('default interface methods', () => {
    it('write() should throw with error message', () => {
      expect(() => adapter.write('session', 'data')).toThrow(
        'write() must be implemented in subclass'
      );
    });

    it('resize() should throw with error message', () => {
      expect(() => adapter.resize('session', 80, 24)).toThrow(
        'resize() must be implemented in subclass'
      );
    });

    it('restartSession() should throw with error message', () => {
      expect(() => adapter.restartSession('session')).toThrow(
        'restartSession() must be implemented in subclass'
      );
    });

    it('hasSession() should throw with error message', () => {
      expect(() => adapter.hasSession('session')).toThrow(
        'hasSession() must be implemented in subclass'
      );
    });

    it('getWorkingDir() should throw with error message', () => {
      expect(() => adapter.getWorkingDir('session')).toThrow(
        'getWorkingDir() must be implemented in subclass'
      );
    });
  });

  describe('setupDataHandlers with session ID logging', () => {
    it('should log when Claude session ID is extracted', () => {
      adapter.testSetupDataHandlers(mockPty, 'test-session');

      const onDataCallback = (mockPty.onData as ReturnType<typeof vi.fn>).mock.calls[0][0];
      onDataCallback('Session ID: 12345678-1234-1234-1234-123456789abc');

      expect(mockLogger.info).toHaveBeenCalledWith('Claude session ID extracted', {
        sessionId: 'test-session',
        claudeSessionId: '12345678-1234-1234-1234-123456789abc',
      });
    });
  });
});
