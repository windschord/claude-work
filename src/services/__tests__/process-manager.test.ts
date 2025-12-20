import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Create hoisted mock
const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

// Mock child_process module
vi.mock('child_process', async () => {
  const { EventEmitter } = await import('events');
  const mockExports = {
    spawn: mockSpawn,
    ChildProcess: class extends EventEmitter {},
    exec: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

import { ProcessManager, StartOptions } from '../process-manager';

type MockChildProcess = {
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  on: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
};

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let mockChildProcess: MockChildProcess;
  let eventHandlers: { [key: string]: (...args: unknown[]) => void } = {};

  beforeEach(() => {
    eventHandlers = {};

    mockChildProcess = {
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn((event, callback) => {
        eventHandlers[event] = callback;
        if (event === 'exit') {
          setTimeout(() => callback(0, null), 0);
        }
        return mockChildProcess;
      }),
      kill: vi.fn(),
      pid: 12345,
    };

    mockSpawn.mockImplementation(() => {
      // Spawn イベントを非同期で発火する
      setTimeout(() => {
        const spawnHandler = eventHandlers['spawn'];
        if (spawnHandler) {
          spawnHandler();
        }
      }, 0);
      return mockChildProcess as unknown as ChildProcess;
    });
    processManager = ProcessManager.getInstance();
  });

  afterEach(async () => {
    // Reset ProcessManager singleton and clear all processes
    ProcessManager.resetForTesting();
    vi.clearAllMocks();
  });

  describe('startClaudeCode', () => {
    it('should NOT include --cwd option in spawn arguments', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-no-cwd-arg',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      await processManager.startClaudeCode(options);

      // --cwdオプションが引数に含まれていないことを確認
      const spawnCall = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
      const args = spawnCall[1] as string[];
      expect(args).not.toContain('--cwd');
      expect(args).not.toContain('/path/to/worktree');
    });

    it('should set cwd option in spawn options', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-cwd-option',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      await processManager.startClaudeCode(options);

      // spawn()のオプションにcwd: worktreePathが設定されていることを確認
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: '/path/to/worktree',
        })
      );
    });

    it('should successfully spawn Claude Code process with worktree path', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-spawn-success',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      const info = await processManager.startClaudeCode(options);

      // プロセスが正常に起動することを確認
      expect(info).toEqual({
        sessionId: 'test-session-spawn-success',
        pid: 12345,
        status: 'running',
      });
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--model', 'sonnet'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: '/path/to/worktree',
        })
      );
    });

    it('should use CLAUDE_CODE_PATH environment variable when set', async () => {
      const originalPath = process.env.CLAUDE_CODE_PATH;
      process.env.CLAUDE_CODE_PATH = '/custom/path/to/claude';

      const options: StartOptions = {
        sessionId: 'test-session-custom-path',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      await processManager.startClaudeCode(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        '/custom/path/to/claude',
        ['--print', '--model', 'sonnet'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: '/path/to/worktree',
        })
      );

      // Restore original value
      if (originalPath !== undefined) {
        process.env.CLAUDE_CODE_PATH = originalPath;
      } else {
        delete process.env.CLAUDE_CODE_PATH;
      }
    });

    it('should use default "claude" command when CLAUDE_CODE_PATH is not set', async () => {
      const originalPath = process.env.CLAUDE_CODE_PATH;
      delete process.env.CLAUDE_CODE_PATH;

      const options: StartOptions = {
        sessionId: 'test-session-default-cmd',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      await processManager.startClaudeCode(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--model', 'sonnet'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: '/path/to/worktree',
        })
      );

      // Restore original value
      if (originalPath !== undefined) {
        process.env.CLAUDE_CODE_PATH = originalPath;
      }
    });

    it('should throw Japanese error message when spawn fails with ENOENT', async () => {
      const mockError = new Error('spawn claude ENOENT') as NodeJS.ErrnoException;
      mockError.code = 'ENOENT';

      const eventHandlers: { [key: string]: (...args: unknown[]) => void } = {};
      const mockFailedProcess = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn((event, callback) => {
          eventHandlers[event] = callback;
          return mockFailedProcess;
        }),
        kill: vi.fn(),
        pid: undefined,
      };

      mockSpawn.mockImplementation(() => {
        // error イベントを非同期で発火する
        setTimeout(() => {
          const errorHandler = eventHandlers['error'];
          if (errorHandler) {
            errorHandler(mockError);
          }
        }, 0);
        return mockFailedProcess as unknown as ChildProcess;
      });

      const options: StartOptions = {
        sessionId: 'test-session-enoent',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      await expect(processManager.startClaudeCode(options)).rejects.toThrow(
        'Claude Codeが見つかりません。環境変数CLAUDE_CODE_PATHを確認してください。'
      );
    });

    it('should spawn claude process with correct arguments', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-correct-args',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      await processManager.startClaudeCode(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--model', 'sonnet'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: '/path/to/worktree',
        })
      );
    });

    it('should send initial prompt to stdin', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-stdin',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      await processManager.startClaudeCode(options);

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('test prompt\n');
    });

    it('should return process info', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-return-info',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      const info = await processManager.startClaudeCode(options);

      expect(info).toEqual({
        sessionId: 'test-session-return-info',
        pid: 12345,
        status: 'running',
      });
    });

    it('should reject if session already exists', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-duplicate',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      await processManager.startClaudeCode(options);

      await expect(processManager.startClaudeCode(options)).rejects.toThrow(
        'Session test-session-duplicate already exists'
      );
    });
  });

  describe('sendInput', () => {
    beforeEach(async () => {
      const options: StartOptions = {
        sessionId: 'test-session-send-input',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);
      vi.clearAllMocks();
    });

    it('should write input to stdin', async () => {
      await processManager.sendInput('test-session-send-input', 'test input');

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('test input\n');
    });

    it('should reject if session not found', async () => {
      await expect(
        processManager.sendInput('non-existent', 'test input')
      ).rejects.toThrow('Session non-existent not found');
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      const options: StartOptions = {
        sessionId: 'test-session-stop',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);
    });

    it('should kill the process', async () => {
      await processManager.stop('test-session-stop');

      expect(mockChildProcess.kill).toHaveBeenCalled();
    });

    it('should update status to stopped', async () => {
      await processManager.stop('test-session-stop');

      const status = processManager.getStatus('test-session-stop');
      expect(status?.status).toBe('stopped');
    });

    it('should not remove from map', async () => {
      await processManager.stop('test-session-stop');

      const status = processManager.getStatus('test-session-stop');
      expect(status).not.toBeNull();
    });

    it('should reject if session not found', async () => {
      await expect(processManager.stop('non-existent')).rejects.toThrow(
        'Session non-existent not found'
      );
    });
  });

  describe('getStatus', () => {
    it('should return null if session not found', () => {
      const status = processManager.getStatus('non-existent');
      expect(status).toBeNull();
    });

    it('should return process info if session exists', async () => {
      const options: StartOptions = {
        sessionId: 'test-session-get-status',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);

      const status = processManager.getStatus('test-session-get-status');
      expect(status).toEqual({
        sessionId: 'test-session-get-status',
        pid: 12345,
        status: 'running',
      });
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      const options: StartOptions = {
        sessionId: 'test-session-events',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);
    });

    it('should emit output event for normal stdout', async () => {
      const outputPromise = new Promise((resolve) => {
        processManager.once('output', (data) => {
          expect(data).toEqual({
            sessionId: 'test-session-events',
            type: 'output',
            content: 'normal output',
          });
          resolve(undefined);
        });
      });

      mockChildProcess.stdout.emit('data', Buffer.from('normal output\n'));
      await outputPromise;
    });

    it('should emit permission event for permission request JSON', async () => {
      const permissionRequest = {
        type: 'permission_request',
        requestId: 'req-123',
        action: 'edit_file',
        details: { path: '/path/to/file' },
      };

      const permissionPromise = new Promise((resolve) => {
        processManager.once('permission', (data) => {
          expect(data).toEqual({
            sessionId: 'test-session-events',
            requestId: 'req-123',
            action: 'edit_file',
            details: { path: '/path/to/file' },
          });
          resolve(undefined);
        });
      });

      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify(permissionRequest) + '\n'));
      await permissionPromise;
    });

    it('should emit error event for stderr', async () => {
      const errorPromise = new Promise((resolve) => {
        processManager.once('error', (data) => {
          expect(data).toEqual({
            sessionId: 'test-session-events',
            content: 'error message',
          });
          resolve(undefined);
        });
      });

      mockChildProcess.stderr.emit('data', Buffer.from('error message\n'));
      await errorPromise;
    });

    it('should emit exit event but not remove from map', async () => {
      const exitPromise = new Promise((resolve) => {
        processManager.once('exit', (data) => {
          expect(data).toEqual({
            sessionId: 'test-session-events',
            exitCode: 0,
            signal: null,
          });

          // Process should be removed from map when exit
          const status = processManager.getStatus('test-session-events');
          expect(status).toBeNull();
          resolve(undefined);
        });
      });

      // Trigger exit event by calling the registered handler
      const exitHandler = eventHandlers['exit'];
      if (exitHandler) {
        exitHandler(0, null);
      }
      await exitPromise;
    });
  });
});
