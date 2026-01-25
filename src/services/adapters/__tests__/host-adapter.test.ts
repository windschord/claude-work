import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { PTYExitInfo } from '../../environment-adapter';

// claude-pty-managerのモック
vi.mock('../../claude-pty-manager', () => ({
  claudePtyManager: {
    createSession: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    destroySession: vi.fn(),
    restartSession: vi.fn(),
    hasSession: vi.fn(),
    getWorkingDir: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
  },
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
import { claudePtyManager } from '../../claude-pty-manager';
import { ptyManager } from '../../pty-manager';

// モックの型
interface MockClaudePtyManager {
  createSession: Mock;
  write: Mock;
  resize: Mock;
  destroySession: Mock;
  restartSession: Mock;
  hasSession: Mock;
  getWorkingDir: Mock;
  on: Mock;
  emit: Mock;
  removeListener: Mock;
}

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

const mockClaudePtyManager = claudePtyManager as unknown as MockClaudePtyManager;
const mockPtyManager = ptyManager as unknown as MockPtyManager;

describe('HostAdapter', () => {
  let hostAdapter: HostAdapter;
  let eventCallbacks: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // イベントコールバックをキャプチャ
    eventCallbacks = new Map();
    mockClaudePtyManager.on.mockImplementation((event: string, callback: (...args: unknown[]) => void) => {
      eventCallbacks.set(event, callback);
      return mockClaudePtyManager;
    });

    hostAdapter = new HostAdapter();
  });

  afterEach(() => {
    hostAdapter.removeAllListeners();
  });

  describe('constructor', () => {
    it('should register event listeners on claudePtyManager', () => {
      expect(mockClaudePtyManager.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockClaudePtyManager.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockClaudePtyManager.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClaudePtyManager.on).toHaveBeenCalledWith('claudeSessionId', expect.any(Function));
    });
  });

  describe('event forwarding', () => {
    it('should forward data events from claudePtyManager', () => {
      const dataListener = vi.fn();
      hostAdapter.on('data', dataListener);

      // claudePtyManagerからのdataイベントをシミュレート
      const dataCallback = eventCallbacks.get('data');
      expect(dataCallback).toBeDefined();
      dataCallback!('session-1', 'test output');

      expect(dataListener).toHaveBeenCalledWith('session-1', 'test output');
    });

    it('should forward exit events from claudePtyManager', () => {
      const exitListener = vi.fn();
      hostAdapter.on('exit', exitListener);

      const exitInfo: PTYExitInfo = { exitCode: 0, signal: undefined };
      const exitCallback = eventCallbacks.get('exit');
      expect(exitCallback).toBeDefined();
      exitCallback!('session-1', exitInfo);

      expect(exitListener).toHaveBeenCalledWith('session-1', exitInfo);
    });

    it('should forward error events from claudePtyManager', () => {
      const errorListener = vi.fn();
      hostAdapter.on('error', errorListener);

      const error = new Error('test error');
      const errorCallback = eventCallbacks.get('error');
      expect(errorCallback).toBeDefined();
      errorCallback!('session-1', error);

      expect(errorListener).toHaveBeenCalledWith('session-1', error);
    });

    it('should forward claudeSessionId events from claudePtyManager', () => {
      const sessionIdListener = vi.fn();
      hostAdapter.on('claudeSessionId', sessionIdListener);

      const sessionIdCallback = eventCallbacks.get('claudeSessionId');
      expect(sessionIdCallback).toBeDefined();
      sessionIdCallback!('session-1', 'claude-session-123');

      expect(sessionIdListener).toHaveBeenCalledWith('session-1', 'claude-session-123');
    });
  });

  describe('createSession', () => {
    it('should call claudePtyManager.createSession with dockerMode: false', () => {
      hostAdapter.createSession('session-1', '/path/to/work');

      expect(mockClaudePtyManager.createSession).toHaveBeenCalledWith(
        'session-1',
        '/path/to/work',
        undefined,
        {
          resumeSessionId: undefined,
          dockerMode: false,
        }
      );
    });

    it('should pass initialPrompt to claudePtyManager.createSession', () => {
      hostAdapter.createSession('session-1', '/path/to/work', 'initial prompt');

      expect(mockClaudePtyManager.createSession).toHaveBeenCalledWith(
        'session-1',
        '/path/to/work',
        'initial prompt',
        {
          resumeSessionId: undefined,
          dockerMode: false,
        }
      );
    });

    it('should pass resumeSessionId option to claudePtyManager.createSession', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        resumeSessionId: 'resume-123',
      });

      expect(mockClaudePtyManager.createSession).toHaveBeenCalledWith(
        'session-1',
        '/path/to/work',
        undefined,
        {
          resumeSessionId: 'resume-123',
          dockerMode: false,
        }
      );
    });

    it('should always set dockerMode to false regardless of any input', () => {
      // optionsが渡されても dockerMode: false が固定される
      hostAdapter.createSession('session-1', '/path/to/work', 'prompt', {
        resumeSessionId: 'resume-456',
      });

      expect(mockClaudePtyManager.createSession).toHaveBeenCalledWith(
        'session-1',
        '/path/to/work',
        'prompt',
        expect.objectContaining({
          dockerMode: false,
        })
      );
    });
  });

  describe('write', () => {
    it('should delegate to claudePtyManager.write', () => {
      hostAdapter.write('session-1', 'test input');

      expect(mockClaudePtyManager.write).toHaveBeenCalledWith('session-1', 'test input');
    });
  });

  describe('resize', () => {
    it('should delegate to claudePtyManager.resize', () => {
      hostAdapter.resize('session-1', 120, 40);

      expect(mockClaudePtyManager.resize).toHaveBeenCalledWith('session-1', 120, 40);
    });
  });

  describe('destroySession', () => {
    it('should delegate to claudePtyManager.destroySession', () => {
      hostAdapter.destroySession('session-1');

      expect(mockClaudePtyManager.destroySession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('restartSession', () => {
    it('should delegate to claudePtyManager.restartSession', () => {
      hostAdapter.restartSession('session-1');

      expect(mockClaudePtyManager.restartSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('hasSession', () => {
    it('should delegate to claudePtyManager.hasSession and return true', () => {
      mockClaudePtyManager.hasSession.mockReturnValue(true);

      const result = hostAdapter.hasSession('session-1');

      expect(mockClaudePtyManager.hasSession).toHaveBeenCalledWith('session-1');
      expect(result).toBe(true);
    });

    it('should delegate to claudePtyManager.hasSession and return false', () => {
      mockClaudePtyManager.hasSession.mockReturnValue(false);

      const result = hostAdapter.hasSession('session-1');

      expect(mockClaudePtyManager.hasSession).toHaveBeenCalledWith('session-1');
      expect(result).toBe(false);
    });
  });

  describe('getWorkingDir', () => {
    it('should delegate to claudePtyManager.getWorkingDir and return the path', () => {
      mockClaudePtyManager.getWorkingDir.mockReturnValue('/path/to/work');

      const result = hostAdapter.getWorkingDir('session-1');

      expect(mockClaudePtyManager.getWorkingDir).toHaveBeenCalledWith('session-1');
      expect(result).toBe('/path/to/work');
    });

    it('should delegate to claudePtyManager.getWorkingDir and return undefined', () => {
      mockClaudePtyManager.getWorkingDir.mockReturnValue(undefined);

      const result = hostAdapter.getWorkingDir('session-1');

      expect(mockClaudePtyManager.getWorkingDir).toHaveBeenCalledWith('session-1');
      expect(result).toBeUndefined();
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
    beforeEach(() => {
      // ptyManagerのモックをリセット
      mockPtyManager.on.mockImplementation(() => mockPtyManager);
      mockPtyManager.hasSession.mockReturnValue(false);
    });

    it('should use ptyManager when shellMode is true', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      // ptyManager.createPTYが呼ばれる
      expect(mockPtyManager.createPTY).toHaveBeenCalledWith('session-1', '/path/to/work');
      // claudePtyManagerは呼ばれない
      expect(mockClaudePtyManager.createSession).not.toHaveBeenCalled();
    });

    it('should use claudePtyManager when shellMode is false', () => {
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: false,
      });

      // claudePtyManagerが呼ばれる
      expect(mockClaudePtyManager.createSession).toHaveBeenCalled();
      // ptyManagerは呼ばれない
      expect(mockPtyManager.createPTY).not.toHaveBeenCalled();
    });

    it('should use claudePtyManager when shellMode is not specified', () => {
      hostAdapter.createSession('session-1', '/path/to/work');

      // claudePtyManagerが呼ばれる
      expect(mockClaudePtyManager.createSession).toHaveBeenCalled();
      // ptyManagerは呼ばれない
      expect(mockPtyManager.createPTY).not.toHaveBeenCalled();
    });

    it('should delegate write to ptyManager for shell sessions', () => {
      // shellModeでセッション作成
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      hostAdapter.write('session-1', 'test input');

      expect(mockPtyManager.write).toHaveBeenCalledWith('session-1', 'test input');
    });

    it('should delegate resize to ptyManager for shell sessions', () => {
      // shellModeでセッション作成
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      hostAdapter.resize('session-1', 120, 40);

      expect(mockPtyManager.resize).toHaveBeenCalledWith('session-1', 120, 40);
    });

    it('should delegate destroySession to ptyManager.kill for shell sessions', () => {
      // shellModeでセッション作成
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });

      hostAdapter.destroySession('session-1');

      expect(mockPtyManager.kill).toHaveBeenCalledWith('session-1');
    });

    it('should check ptyManager for shell session existence', () => {
      // shellModeでセッション作成
      hostAdapter.createSession('session-1', '/path/to/work', undefined, {
        shellMode: true,
      });
      mockPtyManager.hasSession.mockReturnValue(true);

      const result = hostAdapter.hasSession('session-1');

      expect(mockPtyManager.hasSession).toHaveBeenCalledWith('session-1');
      expect(result).toBe(true);
    });
  });
});
