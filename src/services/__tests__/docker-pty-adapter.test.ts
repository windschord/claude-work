import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// loggerのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mocks
const mockDockerClient = {
  createContainer: vi.fn(),
  getContainer: vi.fn(),
  inspectContainer: vi.fn(),
};

const mockContainer = {
  attach: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  kill: vi.fn(),
  inspect: vi.fn(),
  remove: vi.fn(),
};

const mockStream = new EventEmitter() as any;
mockStream.write = vi.fn();
mockStream.end = vi.fn();

// Mock DockerClient singleton
vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// Mock DockerPTYStream
let mockPTYStreamInstance: any;
const createMockPTYStream = () => {
  const instance = new EventEmitter() as any;
  instance.setStream = vi.fn();
  instance.resize = vi.fn();
  instance.write = vi.fn();
  instance.kill = vi.fn();
  instance.onData = vi.fn((cb: any) => { instance.on('data', cb); });
  instance.onExit = vi.fn((cb: any) => { instance.on('exit', cb); });
  return instance;
};

vi.mock('../docker-pty-stream', () => ({
  DockerPTYStream: class {
    constructor() {
      return mockPTYStreamInstance;
    }
  },
}));

// Mock FS
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

import { DockerPTYAdapter } from '../docker-pty-adapter';

describe('DockerPTYAdapter', () => {
  let adapter: DockerPTYAdapter;

  const savedDockerImageName = process.env.DOCKER_IMAGE_NAME;
  const savedDockerImageTag = process.env.DOCKER_IMAGE_TAG;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPTYStreamInstance = createMockPTYStream();

    // Clear env vars to ensure defaults
    delete process.env.DOCKER_IMAGE_NAME;
    delete process.env.DOCKER_IMAGE_TAG;

    // Setup default mocks
    mockDockerClient.createContainer.mockResolvedValue(mockContainer);
    mockContainer.attach.mockResolvedValue(mockStream);
    mockContainer.start.mockResolvedValue(undefined);
    mockContainer.remove.mockResolvedValue(undefined);

    adapter = new DockerPTYAdapter();
  });

  afterEach(() => {
    adapter.removeAllListeners();
    // Restore env vars
    if (savedDockerImageName !== undefined) process.env.DOCKER_IMAGE_NAME = savedDockerImageName;
    else delete process.env.DOCKER_IMAGE_NAME;
    if (savedDockerImageTag !== undefined) process.env.DOCKER_IMAGE_TAG = savedDockerImageTag;
    else delete process.env.DOCKER_IMAGE_TAG;
  });

  describe('constructor', () => {
    it('should use default image name and tag', () => {
      expect(adapter.getImageName()).toBe('ghcr.io/windschord/claude-work-sandbox');
      expect(adapter.getImageTag()).toBe('latest');
    });

    it('should accept custom config', () => {
      const customAdapter = new DockerPTYAdapter({
        imageName: 'custom-image',
        imageTag: 'v1.0',
      });
      expect(customAdapter.getImageName()).toBe('custom-image');
      expect(customAdapter.getImageTag()).toBe('v1.0');
    });

    it('should use env vars if no config provided', () => {
      const originalImageName = process.env.DOCKER_IMAGE_NAME;
      const originalImageTag = process.env.DOCKER_IMAGE_TAG;
      try {
        process.env.DOCKER_IMAGE_NAME = 'env-image';
        process.env.DOCKER_IMAGE_TAG = 'env-tag';

        const envAdapter = new DockerPTYAdapter();
        expect(envAdapter.getImageName()).toBe('env-image');
        expect(envAdapter.getImageTag()).toBe('env-tag');
      } finally {
        if (originalImageName === undefined) delete process.env.DOCKER_IMAGE_NAME;
        else process.env.DOCKER_IMAGE_NAME = originalImageName;
        if (originalImageTag === undefined) delete process.env.DOCKER_IMAGE_TAG;
        else process.env.DOCKER_IMAGE_TAG = originalImageTag;
      }
    });
  });

  describe('getFullImageName', () => {
    it('should return image:tag format', () => {
      expect(adapter.getFullImageName()).toBe('ghcr.io/windschord/claude-work-sandbox:latest');
    });

    it('should return custom image:tag format', () => {
      const custom = new DockerPTYAdapter({ imageName: 'my-img', imageTag: 'v2' });
      expect(custom.getFullImageName()).toBe('my-img:v2');
    });
  });

  describe('createSession', () => {
    it('should create container and attach stream', async () => {
      await adapter.createSession('session-1', '/workspace');

      expect(mockDockerClient.createContainer).toHaveBeenCalled();
      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];

      expect(createOptions.Image).toBe('ghcr.io/windschord/claude-work-sandbox:latest');
      expect(createOptions.Tty).toBe(true);
      expect(createOptions.OpenStdin).toBe(true);
      expect(createOptions.WorkingDir).toBe('/workspace');
      expect(createOptions.HostConfig.Binds).toContain('/workspace:/workspace');

      expect(mockContainer.attach).toHaveBeenCalledWith(expect.objectContaining({
        hijack: true,
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
      }));

      expect(mockContainer.start).toHaveBeenCalled();
      expect(mockPTYStreamInstance.setStream).toHaveBeenCalledWith(mockStream);
    });

    it('should handle custom env vars', async () => {
      await adapter.createSession('session-1', '/workspace', undefined, {
        customEnvVars: { MY_VAR: 'test' }
      });

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Env).toContain('MY_VAR=test');
    });

    it('should skip reserved env vars (TERM, COLORTERM)', async () => {
      await adapter.createSession('session-1', '/workspace', undefined, {
        customEnvVars: { TERM: 'override', COLORTERM: 'override', MY_VAR: 'test' }
      });

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      // Should have TERM and COLORTERM from defaults only
      const termEntries = createOptions.Env.filter((e: string) => e.startsWith('TERM='));
      expect(termEntries).toHaveLength(1);
      expect(termEntries[0]).toBe('TERM=xterm-256color');
      expect(createOptions.Env).toContain('MY_VAR=test');
    });

    it('should pass resume session ID', async () => {
      await adapter.createSession('session-1', '/workspace', undefined, {
        resumeSessionId: 'prev-session',
      });

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Cmd).toContain('--resume');
      expect(createOptions.Cmd).toContain('prev-session');
    });

    it('should throw for duplicate concurrent creation', async () => {
      const promise = adapter.createSession('session-1', '/workspace');
      // Second call while first is in progress
      await expect(adapter.createSession('session-1', '/workspace'))
        .rejects.toThrow('already in progress');
      await promise;
    });

    it('should throw for non-existent working directory', async () => {
      const fs = await import('fs');
      vi.mocked(fs.statSync).mockImplementationOnce(() => { throw new Error('ENOENT'); });

      await expect(adapter.createSession('session-1', '/nonexistent'))
        .rejects.toThrow('workingDir does not exist');
    });

    it('should throw for file as working directory', async () => {
      const fs = await import('fs');
      vi.mocked(fs.statSync).mockReturnValueOnce({ isDirectory: () => false } as any);

      await expect(adapter.createSession('session-1', '/some/file'))
        .rejects.toThrow('workingDir is not a directory');
    });

    it('should clean up existing session before creating new one', async () => {
      await adapter.createSession('session-1', '/workspace');
      mockPTYStreamInstance = createMockPTYStream();

      mockDockerClient.createContainer.mockResolvedValue(mockContainer);
      mockContainer.attach.mockResolvedValue(mockStream);
      mockContainer.start.mockResolvedValue(undefined);

      await adapter.createSession('session-1', '/workspace2');
      expect(adapter.hasSession('session-1')).toBe(true);
    });

    it('should emit data events from PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');

      const dataHandler = vi.fn();
      adapter.on('data', dataHandler);

      mockPTYStreamInstance.emit('data', 'output data');
      expect(dataHandler).toHaveBeenCalledWith('session-1', 'output data');
    });

    it('should emit exit events from PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');

      const exitHandler = vi.fn();
      adapter.on('exit', exitHandler);

      mockPTYStreamInstance.emit('exit', { exitCode: 0, signal: undefined });
      expect(exitHandler).toHaveBeenCalledWith('session-1', { exitCode: 0, signal: undefined });
    });

    it('should remove session from map on exit', async () => {
      await adapter.createSession('session-1', '/workspace');
      expect(adapter.hasSession('session-1')).toBe(true);

      mockPTYStreamInstance.emit('exit', { exitCode: 0 });
      expect(adapter.hasSession('session-1')).toBe(false);
    });

    it('should emit claudeSessionId when detected in output', async () => {
      await adapter.createSession('session-1', '/workspace');

      const claudeIdHandler = vi.fn();
      adapter.on('claudeSessionId', claudeIdHandler);

      mockPTYStreamInstance.emit('data', 'session: abc-123-def');
      expect(claudeIdHandler).toHaveBeenCalledWith('session-1', 'abc-123-def');
    });

    it('should extract session ID only once', async () => {
      await adapter.createSession('session-1', '/workspace');

      const claudeIdHandler = vi.fn();
      adapter.on('claudeSessionId', claudeIdHandler);

      mockPTYStreamInstance.emit('data', 'session: abc-123');
      mockPTYStreamInstance.emit('data', 'session: xyz-456');
      // Only first should be emitted
      expect(claudeIdHandler).toHaveBeenCalledTimes(1);
      expect(claudeIdHandler).toHaveBeenCalledWith('session-1', 'abc-123');
    });

    it('should buffer error output for diagnosis', async () => {
      await adapter.createSession('session-1', '/workspace');

      // Emit some error-like output, then exit with error
      mockPTYStreamInstance.emit('data', 'Unable to find image');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('exit', { exitCode: 1 });
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit error for non-zero exit without output', async () => {
      await adapter.createSession('session-1', '/workspace');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('exit', { exitCode: 1 });
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should not emit error for zero exit code', async () => {
      await adapter.createSession('session-1', '/workspace');

      // Mark that we received output
      mockPTYStreamInstance.emit('data', 'some output');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('exit', { exitCode: 0 });
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should clean up on failure', async () => {
      mockContainer.start.mockRejectedValue(new Error('start failed'));
      // Add error listener to prevent unhandled error
      adapter.on('error', () => {});

      await expect(adapter.createSession('session-1', '/workspace'))
        .rejects.toThrow('Failed to spawn Docker process');

      expect(adapter.hasSession('session-1')).toBe(false);
    });

    it('should include ANTHROPIC_API_KEY when set', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-key';

      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Env).toContain('ANTHROPIC_API_KEY=test-key');

      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should mount SSH_AUTH_SOCK when available', async () => {
      const originalSock = process.env.SSH_AUTH_SOCK;
      process.env.SSH_AUTH_SOCK = '/tmp/ssh-agent.sock';

      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.HostConfig.Binds).toContain('/tmp/ssh-agent.sock:/ssh-agent');
      expect(createOptions.Env).toContain('SSH_AUTH_SOCK=/ssh-agent');

      process.env.SSH_AUTH_SOCK = originalSock;
    });

    it('should set security options', async () => {
      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.HostConfig.CapDrop).toEqual(['ALL']);
      expect(createOptions.HostConfig.SecurityOpt).toEqual(['no-new-privileges']);
      expect(createOptions.HostConfig.AutoRemove).toBe(true);
    });

    it('should have default TERM and COLORTERM env vars', async () => {
      await adapter.createSession('session-1', '/workspace');

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Env).toContain('TERM=xterm-256color');
      expect(createOptions.Env).toContain('COLORTERM=truecolor');
    });

    it('should include claude code options in command args', async () => {
      await adapter.createSession('session-1', '/workspace', undefined, {
        claudeCodeOptions: { model: 'claude-3-opus' },
      });

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Cmd).toContain('claude');
    });

    it('should send initial prompt after delay', async () => {
      vi.useFakeTimers();

      await adapter.createSession('session-1', '/workspace', 'Hello');
      expect(mockPTYStreamInstance.write).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);
      expect(mockPTYStreamInstance.write).toHaveBeenCalledWith('Hello\n');

      vi.useRealTimers();
    });

    it('should not send initial prompt if session destroyed before delay', async () => {
      vi.useFakeTimers();

      await adapter.createSession('session-1', '/workspace', 'Hello');
      adapter.destroySession('session-1');

      vi.advanceTimersByTime(3000);
      expect(mockPTYStreamInstance.write).not.toHaveBeenCalledWith('Hello\n');

      vi.useRealTimers();
    });
  });

  describe('write', () => {
    it('should write to PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');
      adapter.write('session-1', 'input');
      expect(mockPTYStreamInstance.write).toHaveBeenCalledWith('input');
    });

    it('should not throw for non-existent session', () => {
      expect(() => adapter.write('nonexistent', 'data')).not.toThrow();
    });
  });

  describe('resize', () => {
    it('should resize PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');
      adapter.resize('session-1', 100, 30);
      expect(mockPTYStreamInstance.resize).toHaveBeenCalledWith(100, 30);
    });

    it('should not throw for non-existent session', () => {
      expect(() => adapter.resize('nonexistent', 80, 24)).not.toThrow();
    });
  });

  describe('destroySession', () => {
    it('should kill PTY stream and remove session', async () => {
      await adapter.createSession('session-1', '/workspace');
      adapter.destroySession('session-1');
      expect(mockPTYStreamInstance.kill).toHaveBeenCalled();
      expect(adapter.hasSession('session-1')).toBe(false);
    });

    it('should handle destroying non-existent session', () => {
      expect(() => adapter.destroySession('nonexistent')).not.toThrow();
    });
  });

  describe('restartSession', () => {
    it('should destroy and recreate session', async () => {
      await adapter.createSession('session-1', '/workspace');
      mockPTYStreamInstance = createMockPTYStream();

      mockDockerClient.createContainer.mockResolvedValue(mockContainer);
      mockContainer.attach.mockResolvedValue(mockStream);
      mockContainer.start.mockResolvedValue(undefined);

      await adapter.restartSession('session-1');

      // Should have called createContainer twice
      expect(mockDockerClient.createContainer).toHaveBeenCalledTimes(2);
    });

    it('should not restart non-existent session', async () => {
      await adapter.restartSession('nonexistent');
      expect(mockDockerClient.createContainer).not.toHaveBeenCalled();
    });
  });

  describe('hasSession', () => {
    it('should return true for existing session', async () => {
      await adapter.createSession('session-1', '/workspace');
      expect(adapter.hasSession('session-1')).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(adapter.hasSession('nonexistent')).toBe(false);
    });
  });

  describe('getWorkingDir', () => {
    it('should return working directory for existing session', async () => {
      await adapter.createSession('session-1', '/workspace');
      expect(adapter.getWorkingDir('session-1')).toContain('workspace');
    });

    it('should return undefined for non-existent session', () => {
      expect(adapter.getWorkingDir('nonexistent')).toBeUndefined();
    });
  });

  describe('getContainerId', () => {
    it('should return container ID for existing session', async () => {
      await adapter.createSession('session-1', '/workspace');
      expect(adapter.getContainerId('session-1')).toBeDefined();
    });

    it('should return undefined for non-existent session', () => {
      expect(adapter.getContainerId('nonexistent')).toBeUndefined();
    });
  });

  describe('getClaudeSessionId', () => {
    it('should return undefined initially', async () => {
      await adapter.createSession('session-1', '/workspace');
      expect(adapter.getClaudeSessionId('session-1')).toBeUndefined();
    });

    it('should return extracted Claude session ID', async () => {
      await adapter.createSession('session-1', '/workspace');

      mockPTYStreamInstance.emit('data', 'session: my-session-id');
      expect(adapter.getClaudeSessionId('session-1')).toBe('my-session-id');
    });

    it('should return undefined for non-existent session', () => {
      expect(adapter.getClaudeSessionId('nonexistent')).toBeUndefined();
    });
  });

  describe('parseContainerStartError', () => {
    it('should detect image not found error', async () => {
      await adapter.createSession('session-1', '/workspace');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('data', 'Unable to find image foo:latest');
      mockPTYStreamInstance.emit('exit', { exitCode: 1 });

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][1].errorType).toBe('DOCKER_IMAGE_NOT_FOUND');
    });

    it('should detect permission denied error', async () => {
      await adapter.createSession('session-1', '/workspace');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('data', 'permission denied while trying to connect');
      mockPTYStreamInstance.emit('exit', { exitCode: 1 });

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][1].errorType).toBe('DOCKER_PERMISSION_DENIED');
    });

    it('should detect daemon not running error', async () => {
      await adapter.createSession('session-1', '/workspace');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('data', 'Cannot connect to the Docker daemon');
      mockPTYStreamInstance.emit('exit', { exitCode: 1 });

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][1].errorType).toBe('DOCKER_DAEMON_NOT_RUNNING');
    });

    it('should detect port already allocated error', async () => {
      await adapter.createSession('session-1', '/workspace');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('data', 'port is already allocated');
      mockPTYStreamInstance.emit('exit', { exitCode: 1 });

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should detect volume mount error', async () => {
      await adapter.createSession('session-1', '/workspace');

      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      mockPTYStreamInstance.emit('data', 'Mounts denied: /host/path is not shared');
      mockPTYStreamInstance.emit('exit', { exitCode: 1 });

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('extractClaudeSessionId patterns', () => {
    it('should extract from "session: <id>" format', async () => {
      await adapter.createSession('session-1', '/workspace');

      const handler = vi.fn();
      adapter.on('claudeSessionId', handler);

      mockPTYStreamInstance.emit('data', 'session: abc-123-def');
      expect(handler).toHaveBeenCalledWith('session-1', 'abc-123-def');
    });

    it('should extract from "[session:<id>]" format', async () => {
      await adapter.createSession('session-1', '/workspace');

      const handler = vi.fn();
      adapter.on('claudeSessionId', handler);

      mockPTYStreamInstance.emit('data', '[session:my-session-456]');
      expect(handler).toHaveBeenCalledWith('session-1', 'my-session-456');
    });

    it('should extract from "Resuming session: <id>" format', async () => {
      await adapter.createSession('session-1', '/workspace');

      const handler = vi.fn();
      adapter.on('claudeSessionId', handler);

      mockPTYStreamInstance.emit('data', 'Resuming session: resume-id-789');
      expect(handler).toHaveBeenCalledWith('session-1', 'resume-id-789');
    });
  });
});
