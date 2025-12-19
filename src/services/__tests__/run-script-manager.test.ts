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

import { RunScriptManager, RunOptions } from '../run-script-manager';

type MockChildProcess = {
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
};

describe('RunScriptManager', () => {
  let runScriptManager: RunScriptManager;
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    const eventHandlers: Map<string, ((...args: unknown[]) => void)[]> = new Map();

    mockChildProcess = {
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn((event, callback) => {
        const handlers = eventHandlers.get(event) || [];
        handlers.push(callback);
        eventHandlers.set(event, handlers);
        return mockChildProcess;
      }),
      emit: vi.fn((event, ...args) => {
        const handlers = eventHandlers.get(event) || [];
        handlers.forEach((handler) => handler(...args));
        return true;
      }),
      removeListener: vi.fn((event, callback) => {
        const handlers = eventHandlers.get(event) || [];
        const index = handlers.indexOf(callback);
        if (index > -1) {
          handlers.splice(index, 1);
          eventHandlers.set(event, handlers);
        }
        return mockChildProcess;
      }),
      kill: vi.fn(),
      pid: 12345,
    };

    mockSpawn.mockImplementation(() => {
      // Emit spawn event asynchronously to simulate real process behavior
      setTimeout(() => {
        const spawnHandlers = eventHandlers.get('spawn') || [];
        spawnHandlers.forEach((handler) => handler());
      }, 0);
      return mockChildProcess as unknown as ChildProcess;
    });
    runScriptManager = RunScriptManager.getInstance();
  });

  afterEach(async () => {
    // Clean up any running processes
    vi.clearAllMocks();
  });

  describe('runScript', () => {
    it('should execute script and return run_id', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const runId = await runScriptManager.runScript(options);

      expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockSpawn).toHaveBeenCalledWith(
        'npm test',
        expect.objectContaining({
          cwd: '/path/to/worktree',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        })
      );
    });

    it('should spawn process with shell for complex commands', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm run build && npm run test',
      };

      await runScriptManager.runScript(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm run build && npm run test',
        expect.objectContaining({
          cwd: '/path/to/worktree',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        })
      );
    });

    it('should allow multiple scripts to run in parallel', async () => {
      const options1: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const options2: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm run lint',
      };

      const runId1 = await runScriptManager.runScript(options1);
      const runId2 = await runScriptManager.runScript(options2);

      expect(runId1).not.toBe(runId2);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop running process', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const runId = await runScriptManager.runScript(options);
      await runScriptManager.stop(runId);

      expect(mockChildProcess.kill).toHaveBeenCalled();
    });

    it('should throw error if run_id not found', async () => {
      await expect(runScriptManager.stop('non-existent-run-id')).rejects.toThrow(
        'Run script non-existent-run-id not found'
      );
    });
  });

  describe('getStatus', () => {
    it('should return null if run_id not found', () => {
      const status = runScriptManager.getStatus('non-existent-run-id');
      expect(status).toBeNull();
    });

    it('should return process info if run exists', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const runId = await runScriptManager.runScript(options);
      const status = runScriptManager.getStatus(runId);

      expect(status).toMatchObject({
        runId,
        sessionId: 'test-session',
        command: 'npm test',
        pid: 12345,
        status: 'running',
      });
    });
  });

  describe('events', () => {
    it('should emit output event for stdout', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const runId = await runScriptManager.runScript(options);

      return new Promise<void>((resolve) => {
        runScriptManager.once('output', (data) => {
          expect(data).toMatchObject({
            runId,
            sessionId: 'test-session',
            type: 'stdout',
            content: 'test output',
          });
          resolve();
        });

        mockChildProcess.stdout.emit('data', Buffer.from('test output\n'));
      });
    });

    it('should emit error event for stderr', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const runId = await runScriptManager.runScript(options);

      return new Promise<void>((resolve) => {
        runScriptManager.once('error', (data) => {
          expect(data).toMatchObject({
            runId,
            sessionId: 'test-session',
            content: 'error message',
          });
          resolve();
        });

        mockChildProcess.stderr.emit('data', Buffer.from('error message\n'));
      });
    });

    it('should emit exit event with exit code and execution time', async () => {
      const options: RunOptions = {
        sessionId: 'test-session',
        workingDirectory: '/path/to/worktree',
        command: 'npm test',
      };

      const runId = await runScriptManager.runScript(options);

      return new Promise<void>((resolve) => {
        runScriptManager.once('exit', (data) => {
          expect(data).toMatchObject({
            runId,
            sessionId: 'test-session',
            exitCode: 0,
            signal: null,
          });
          expect(data.executionTime).toBeGreaterThanOrEqual(0);
          resolve();
        });

        mockChildProcess.emit('exit', 0, null);
      });
    });
  });
});
