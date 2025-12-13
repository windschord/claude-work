import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ProcessManager, StartOptions } from '../process-manager';
import { spawn, ChildProcess } from 'child_process';

vi.mock('child_process');

type MockChildProcess = {
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
};

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    mockChildProcess = {
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
      pid: 12345,
    };

    vi.mocked(spawn).mockReturnValue(mockChildProcess as unknown as ChildProcess);
    processManager = new ProcessManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startClaudeCode', () => {
    it('should spawn claude process with correct arguments', async () => {
      const options: StartOptions = {
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
        model: 'sonnet',
      };

      await processManager.startClaudeCode(options);

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--model', 'sonnet', '--cwd', '/path/to/worktree'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      );
    });

    it('should send initial prompt to stdin', async () => {
      const options: StartOptions = {
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      await processManager.startClaudeCode(options);

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('test prompt\n');
    });

    it('should return process info', async () => {
      const options: StartOptions = {
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      const info = await processManager.startClaudeCode(options);

      expect(info).toEqual({
        sessionId: 'test-session',
        pid: 12345,
        status: 'running',
      });
    });

    it('should reject if session already exists', async () => {
      const options: StartOptions = {
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };

      await processManager.startClaudeCode(options);

      await expect(processManager.startClaudeCode(options)).rejects.toThrow(
        'Session test-session already exists'
      );
    });
  });

  describe('sendInput', () => {
    beforeEach(async () => {
      const options: StartOptions = {
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);
      vi.clearAllMocks();
    });

    it('should write input to stdin', async () => {
      await processManager.sendInput('test-session', 'test input');

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
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);
    });

    it('should kill the process', async () => {
      await processManager.stop('test-session');

      expect(mockChildProcess.kill).toHaveBeenCalled();
    });

    it('should update status to stopped', async () => {
      await processManager.stop('test-session');

      const status = processManager.getStatus('test-session');
      expect(status?.status).toBe('stopped');
    });

    it('should not remove from map', async () => {
      await processManager.stop('test-session');

      const status = processManager.getStatus('test-session');
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
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);

      const status = processManager.getStatus('test-session');
      expect(status).toEqual({
        sessionId: 'test-session',
        pid: 12345,
        status: 'running',
      });
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      const options: StartOptions = {
        sessionId: 'test-session',
        worktreePath: '/path/to/worktree',
        prompt: 'test prompt',
      };
      await processManager.startClaudeCode(options);
    });

    it('should emit output event for normal stdout', (done) => {
      processManager.once('output', (data) => {
        expect(data).toEqual({
          sessionId: 'test-session',
          type: 'output',
          content: 'normal output',
        });
        done();
      });

      mockChildProcess.stdout.emit('data', Buffer.from('normal output\n'));
    });

    it('should emit permission event for permission request JSON', (done) => {
      const permissionRequest = {
        type: 'permission_request',
        requestId: 'req-123',
        action: 'edit_file',
        details: { path: '/path/to/file' },
      };

      processManager.once('permission', (data) => {
        expect(data).toEqual({
          sessionId: 'test-session',
          requestId: 'req-123',
          action: 'edit_file',
          details: { path: '/path/to/file' },
        });
        done();
      });

      mockChildProcess.stdout.emit('data', Buffer.from(JSON.stringify(permissionRequest) + '\n'));
    });

    it('should emit error event for stderr', (done) => {
      processManager.once('error', (data) => {
        expect(data).toEqual({
          sessionId: 'test-session',
          content: 'error message',
        });
        done();
      });

      mockChildProcess.stderr.emit('data', Buffer.from('error message\n'));
    });

    it('should emit exit event but not remove from map', (done) => {
      processManager.once('exit', (data) => {
        expect(data).toEqual({
          sessionId: 'test-session',
          exitCode: 0,
          signal: null,
        });

        // Process should not be removed from map
        const status = processManager.getStatus('test-session');
        expect(status).not.toBeNull();
        done();
      });

      mockChildProcess.emit('exit', 0, null);
    });
  });
});
