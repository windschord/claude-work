import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { IPty } from 'node-pty';

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// pty-managerのモック（shellMode用）
vi.mock('../../pty-manager', () => ({
  ptyManager: {
    createPTY: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    hasSession: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
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

import { HostAdapter } from '../host-adapter';
import { ptyManager } from '../../pty-manager';
import * as pty from 'node-pty';

// モックの型
interface MockPtyManager {
  createPTY: Mock;
  write: Mock;
  resize: Mock;
  kill: Mock;
  hasSession: Mock;
  on: Mock;
  off: Mock;
  emit: Mock;
  removeListener: Mock;
}

const mockPtyManager = ptyManager as unknown as MockPtyManager;

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
      removeAllListeners: vi.fn(),
      pid: 12345,
      cols: 80,
      rows: 24,
      process: 'claude',
      handleFlowControl: false,
      clear: vi.fn(),
    } as unknown as IPty;

    vi.mocked(pty.spawn).mockReturnValue(mockPtyInstance);

    // ptyManagerのモックをリセット
    mockPtyManager.on.mockImplementation(() => mockPtyManager);
    mockPtyManager.hasSession.mockReturnValue(false);

    hostAdapter = new HostAdapter();
  });

  afterEach(() => {
    hostAdapter.removeAllListeners();
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

    it('should have EventEmitter methods', () => {
      expect(typeof hostAdapter.on).toBe('function');
      expect(typeof hostAdapter.emit).toBe('function');
      expect(typeof hostAdapter.removeListener).toBe('function');
      expect(typeof hostAdapter.removeAllListeners).toBe('function');
    });
  });

  describe('shellMode', () => {
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

    it('should delegate write to ptyManager for shell sessions', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      hostAdapter.write('session-1', 'test input');

      expect(mockPtyManager.write).toHaveBeenCalledWith('session-1', 'test input');
    });
  });
});
