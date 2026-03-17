import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { IPty } from 'node-pty';

// Hoisted mocks
const { mockPtyManagerObj } = vi.hoisted(() => {
  const { EventEmitter } = require('events');
  const emitter = new EventEmitter();
  return {
    mockPtyManagerObj: Object.assign(emitter, {
      createPTY: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      hasSession: vi.fn(),
    }),
  };
});

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// pty-managerのモック（shellMode用）
vi.mock('../../pty-manager', () => ({
  ptyManager: mockPtyManagerObj,
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

import { HostAdapter } from '../host-adapter';
import { ptyManager } from '../../pty-manager';
import * as pty from 'node-pty';

const mockPtyManager = mockPtyManagerObj as any;

describe('HostAdapter', () => {
  let hostAdapter: HostAdapter;
  let mockPtyInstance: IPty;

  beforeEach(async () => {
    vi.clearAllMocks();

    // モックPTYインスタンス
    mockPtyInstance = {
      onData: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      pid: 12345,
      cols: 80,
      rows: 24,
      process: 'claude',
      handleFlowControl: false,
      clear: vi.fn(),
    } as unknown as IPty;

    vi.mocked(pty.spawn).mockReturnValue(mockPtyInstance);
    mockPtyManager.hasSession.mockReturnValue(false);

    hostAdapter = new HostAdapter();
  });

  afterEach(() => {
    hostAdapter.removeAllListeners();
  });

  describe('constructor', () => {
    it('should register data event handler on ptyManager', () => {
      // ptyManager emitter should have 'data' listener registered
      expect(mockPtyManagerObj.listenerCount('data')).toBeGreaterThan(0);
    });

    it('should register exit event handler on ptyManager', () => {
      expect(mockPtyManagerObj.listenerCount('exit')).toBeGreaterThan(0);
    });

    it('should forward ptyManager data events for shell sessions', () => {
      // Create a shell session
      hostAdapter.createSession('shell-1', '/path', undefined, { shellMode: true });

      const dataHandler = vi.fn();
      hostAdapter.on('data', dataHandler);

      // Emit data from ptyManager
      mockPtyManagerObj.emit('data', 'shell-1', 'output data');
      expect(dataHandler).toHaveBeenCalledWith('shell-1', 'output data');
    });

    it('should not forward ptyManager data events for non-shell sessions', () => {
      hostAdapter.createSession('claude-1', '/path');

      const dataHandler = vi.fn();
      hostAdapter.on('data', dataHandler);

      // Emit data from ptyManager for a different session
      mockPtyManagerObj.emit('data', 'unknown-session', 'output data');
      expect(dataHandler).not.toHaveBeenCalled();
    });

    it('should forward ptyManager exit events for shell sessions and clean up', () => {
      hostAdapter.createSession('shell-1', '/path', undefined, { shellMode: true });

      const exitHandler = vi.fn();
      hostAdapter.on('exit', exitHandler);

      mockPtyManagerObj.emit('exit', 'shell-1', { exitCode: 0 });
      expect(exitHandler).toHaveBeenCalledWith('shell-1', { exitCode: 0 });
    });
  });

  describe('createSession - Claude Code mode', () => {
    it('should call pty.spawn for Claude Code', () => {
      hostAdapter.createSession('session-1', '/path/to/work');

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          cols: 80,
          rows: 24,
          cwd: '/path/to/work',
        })
      );
    });

    it('should pass cols and rows from options', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        cols: 120,
        rows: 40,
      });

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          cols: 120,
          rows: 40,
        })
      );
    });

    it('should pass --print flag with initial prompt', () => {
      hostAdapter.createSession('session-1', '/path/to/work', 'Hello Claude');

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', 'Hello Claude'],
        expect.any(Object)
      );
    });

    it('should pass --resume flag with resumeSessionId', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        resumeSessionId: 'prev-session-id',
      });

      expect(pty.spawn).toHaveBeenCalledWith(
        'claude',
        ['--resume', 'prev-session-id'],
        expect.any(Object)
      );
    });

    it('should pass both --print and --resume flags', () => {
      hostAdapter.createSession('session-1', '/path/to/work', 'prompt', {
        resumeSessionId: 'prev-id',
      });

      const args = vi.mocked(pty.spawn).mock.calls[0][1];
      expect(args).toContain('--print');
      expect(args).toContain('prompt');
      expect(args).toContain('--resume');
      expect(args).toContain('prev-id');
    });

    it('should pass custom env vars', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        customEnvVars: { MY_VAR: 'value' },
      });

      const options = vi.mocked(pty.spawn).mock.calls[0][2];
      expect(options?.env).toEqual(
        expect.objectContaining({ MY_VAR: 'value' })
      );
    });

    it('should setup data handlers', () => {
      hostAdapter.createSession('session-1', '/path/to/work');
      expect(mockPtyInstance.onData).toHaveBeenCalled();
    });

    it('should setup exit handlers', () => {
      hostAdapter.createSession('session-1', '/path/to/work');
      expect(mockPtyInstance.onExit).toHaveBeenCalled();
    });

    it('should destroy existing session before recreating', () => {
      // First create a session
      hostAdapter.createSession('session-1', '/path/to/work');
      // Make hasSession return true for ptyInstances check
      expect(hostAdapter.hasSession('session-1')).toBe(true);

      // Create again - should destroy first
      hostAdapter.createSession('session-1', '/path/to/work2');
      expect(mockPtyInstance.kill).toHaveBeenCalled();
    });
  });

  describe('createSession - shell mode', () => {
    it('should use ptyManager when shellMode is true', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      expect(mockPtyManager.createPTY).toHaveBeenCalledWith('session-1', '/path/to/work');
      expect(pty.spawn).not.toHaveBeenCalled();
    });

    it('should use pty.spawn when shellMode is false', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: false,
      });

      expect(pty.spawn).toHaveBeenCalled();
      expect(mockPtyManager.createPTY).not.toHaveBeenCalled();
    });

    it('should resize after creating shell session', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
        cols: 100,
        rows: 50,
      });

      expect(mockPtyManager.resize).toHaveBeenCalledWith('session-1', 100, 50);
    });

    it('should use default cols/rows for shell session', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      expect(mockPtyManager.resize).toHaveBeenCalledWith('session-1', 80, 24);
    });
  });

  describe('write', () => {
    it('should delegate write to ptyManager for shell sessions', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      hostAdapter.write('session-1', 'test input');
      expect(mockPtyManager.write).toHaveBeenCalledWith('session-1', 'test input');
    });

    it('should write directly to PTY instance for Claude sessions', () => {
      hostAdapter.createSession('session-1', '/path/to/work');

      hostAdapter.write('session-1', 'test input');
      expect(mockPtyInstance.write).toHaveBeenCalledWith('test input');
    });

    it('should not throw for non-existent Claude session', () => {
      expect(() => hostAdapter.write('nonexistent', 'data')).not.toThrow();
    });
  });

  describe('resize', () => {
    it('should delegate resize to ptyManager for shell sessions', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });
      vi.clearAllMocks();

      hostAdapter.resize('session-1', 100, 50);
      expect(mockPtyManager.resize).toHaveBeenCalledWith('session-1', 100, 50);
    });

    it('should resize PTY instance for Claude sessions', () => {
      hostAdapter.createSession('session-1', '/path/to/work');

      hostAdapter.resize('session-1', 100, 50);
      expect(mockPtyInstance.resize).toHaveBeenCalledWith(100, 50);
    });

    it('should not throw for non-existent session', () => {
      expect(() => hostAdapter.resize('nonexistent', 80, 24)).not.toThrow();
    });
  });

  describe('destroySession', () => {
    it('should kill ptyManager session for shell sessions', async () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      await hostAdapter.destroySession('session-1');
      expect(mockPtyManager.kill).toHaveBeenCalledWith('session-1');
    });

    it('should kill PTY instance for Claude sessions', async () => {
      hostAdapter.createSession('session-1', '/path/to/work');

      await hostAdapter.destroySession('session-1');
      expect(mockPtyInstance.kill).toHaveBeenCalled();
    });

    it('should remove session from internal maps', async () => {
      hostAdapter.createSession('session-1', '/path/to/work');
      expect(hostAdapter.hasSession('session-1')).toBe(true);

      await hostAdapter.destroySession('session-1');
      expect(hostAdapter.hasSession('session-1')).toBe(false);
    });

    it('should handle destroying non-existent session', async () => {
      await expect(hostAdapter.destroySession('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('restartSession', () => {
    it('should throw not implemented error', () => {
      expect(() => hostAdapter.restartSession('session-1')).toThrow('restartSession not implemented');
    });
  });

  describe('hasSession', () => {
    it('should return true for Claude session', () => {
      hostAdapter.createSession('session-1', '/path/to/work');
      expect(hostAdapter.hasSession('session-1')).toBe(true);
    });

    it('should delegate to ptyManager for shell sessions', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });
      mockPtyManager.hasSession.mockReturnValue(true);

      expect(hostAdapter.hasSession('session-1')).toBe(true);
      expect(mockPtyManager.hasSession).toHaveBeenCalledWith('session-1');
    });

    it('should return false for non-existent session', () => {
      expect(hostAdapter.hasSession('nonexistent')).toBe(false);
    });
  });

  describe('getWorkingDir', () => {
    it('should return working dir for Claude session', () => {
      hostAdapter.createSession('session-1', '/path/to/work');
      expect(hostAdapter.getWorkingDir('session-1')).toBe('/path/to/work');
    });

    it('should return undefined for shell session', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });
      expect(hostAdapter.getWorkingDir('session-1')).toBeUndefined();
    });

    it('should return undefined for non-existent session', () => {
      expect(hostAdapter.getWorkingDir('nonexistent')).toBeUndefined();
    });
  });

  describe('createSession - existing session handling', () => {
    it('should log warning when session already exists', async () => {
      const { logger } = await import('@/lib/logger');
      hostAdapter.createSession('session-1', '/path/to/work');
      vi.clearAllMocks();

      hostAdapter.createSession('session-1', '/path/to/work2');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Session already exists'),
        expect.objectContaining({ sessionId: 'session-1' })
      );
    });

    it('should handle async destroySession Promise rejection', async () => {
      // Create a session
      hostAdapter.createSession('session-1', '/path/to/work');
      // Make cleanupPTY (kill) throw
      (mockPtyInstance.kill as any).mockImplementation(() => { throw new Error('kill failed'); });

      // Re-create should try to destroy first, and handle the error
      hostAdapter.createSession('session-1', '/path/to/work2');
      // Should not throw
    });
  });

  describe('createSession - shell mode details', () => {
    it('should log info when creating shell session', async () => {
      const { logger } = await import('@/lib/logger');
      hostAdapter.createSession('shell-1', '/path', undefined, {
        shellMode: true,
        cols: 120,
        rows: 40,
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating shell session'),
        expect.objectContaining({
          sessionId: 'shell-1',
          workingDir: '/path',
          cols: 120,
          rows: 40,
        })
      );
    });
  });

  describe('EnvironmentAdapter implementation', () => {
    it('should be an instance of EventEmitter', () => {
      expect(hostAdapter).toBeInstanceOf(EventEmitter);
    });

    it('should have all required EnvironmentAdapter methods', () => {
      expect(typeof hostAdapter.createSession).toBe('function');
      expect(typeof hostAdapter.write).toBe('function');
      expect(typeof hostAdapter.resize).toBe('function');
      expect(typeof hostAdapter.destroySession).toBe('function');
      expect(typeof hostAdapter.restartSession).toBe('function');
      expect(typeof hostAdapter.hasSession).toBe('function');
      expect(typeof hostAdapter.getWorkingDir).toBe('function');
    });
  });
});
