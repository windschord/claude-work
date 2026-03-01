import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { DockerPTYAdapter } from '../docker-pty-adapter';

// Mocks
const mockDockerClient = {
  createContainer: vi.fn(),
  getContainer: vi.fn(),
};

const mockContainer = {
  attach: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  kill: vi.fn(),
  inspect: vi.fn(),
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
const mockPTYStreamInstance = new EventEmitter() as any;
mockPTYStreamInstance.setStream = vi.fn();
mockPTYStreamInstance.resize = vi.fn();
mockPTYStreamInstance.write = vi.fn();
mockPTYStreamInstance.kill = vi.fn();
mockPTYStreamInstance.onData = vi.fn((cb) => mockPTYStreamInstance.on('data', cb));
mockPTYStreamInstance.onExit = vi.fn((cb) => mockPTYStreamInstance.on('exit', cb));

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

describe('DockerPTYAdapter', () => {
  let adapter: DockerPTYAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockDockerClient.createContainer.mockResolvedValue(mockContainer);
    mockContainer.attach.mockResolvedValue(mockStream);
    mockContainer.start.mockResolvedValue(undefined);
    
    adapter = new DockerPTYAdapter();
  });

  describe('constructor', () => {
    it('defaults', () => {
      expect(adapter.getImageName()).toBe('ghcr.io/windschord/claude-work-sandbox');
      expect(adapter.getImageTag()).toBe('latest');
    });

    it('custom config', () => {
      const customAdapter = new DockerPTYAdapter({
        imageName: 'custom-image',
        imageTag: 'v1.0',
      });
      expect(customAdapter.getImageName()).toBe('custom-image');
      expect(customAdapter.getImageTag()).toBe('v1.0');
    });
  });

  describe('createSession', () => {
    it('creates container and attaches stream', async () => {
      await adapter.createSession('session-1', '/workspace');

      expect(mockDockerClient.createContainer).toHaveBeenCalled();
      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      
      expect(createOptions.Image).toBe('ghcr.io/windschord/claude-work-sandbox:latest');
      expect(createOptions.Tty).toBe(true);
      expect(createOptions.HostConfig.Binds).toContain('/workspace:/workspace');
      
      expect(mockContainer.attach).toHaveBeenCalledWith(expect.objectContaining({
        hijack: true,
        stream: true,
      }));
      
      expect(mockContainer.start).toHaveBeenCalled();
      expect(mockPTYStreamInstance.setStream).toHaveBeenCalledWith(mockStream);
    });

    it('handles custom env vars', async () => {
      await adapter.createSession('session-1', '/workspace', undefined, {
        customEnvVars: { MY_VAR: 'test' }
      });
      
      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Env).toContain('MY_VAR=test');
    });
  });

  describe('write', () => {
    it('writes to PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');
      adapter.write('session-1', 'input');
      expect(mockPTYStreamInstance.write).toHaveBeenCalledWith('input');
    });
  });

  describe('resize', () => {
    it('resizes PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');
      adapter.resize('session-1', 100, 30);
      expect(mockPTYStreamInstance.resize).toHaveBeenCalledWith(100, 30);
    });
  });

  describe('destroySession', () => {
    it('kills PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');
      adapter.destroySession('session-1');
      expect(mockPTYStreamInstance.kill).toHaveBeenCalled();
      expect(adapter.hasSession('session-1')).toBe(false);
    });
  });
});
