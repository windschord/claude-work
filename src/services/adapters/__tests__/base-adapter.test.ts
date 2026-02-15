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
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// BasePTYAdapterのテスト用具象クラス
class TestPTYAdapter extends BasePTYAdapter {
  createSession(
    _sessionId: string,
    _projectPath: string,
    _branch: string,
    _options: CreateSessionOptions
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  destroySession(_sessionId: string): Promise<void> {
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
      removeAllListeners: vi.fn(),
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

    it('should remove event listeners', async () => {
      await adapter.testCleanupPTY(mockPty);

      expect(mockPty.removeAllListeners).toHaveBeenCalled();
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
  });
});
