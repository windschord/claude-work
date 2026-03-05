import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';
import { EventEmitter } from 'events';

// Mock networkFilterService
vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    applyFilter: vi.fn().mockResolvedValue(undefined),
    removeFilter: vi.fn().mockResolvedValue(undefined),
    isFilterEnabled: vi.fn().mockResolvedValue(false),
  },
}));

// Mock node-pty (native module)
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((col) => ({ isNull: col })),
  isNotNull: vi.fn((col) => ({ isNotNull: col })),
}));

// Mock scrollback-buffer
vi.mock('@/services/scrollback-buffer', () => ({
  scrollbackBuffer: {
    append: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock logger
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
  inspectContainer: vi.fn(), // Added
};

const mockContainer = {
  attach: vi.fn(),
  start: vi.fn(),
  exec: vi.fn(),
  inspect: vi.fn(),
  stop: vi.fn(),
  kill: vi.fn(),
  wait: vi.fn(),
};

const mockExec = {
  start: vi.fn(),
  resize: vi.fn(),
  inspect: vi.fn(),
};

const mockStream = new EventEmitter() as any;
mockStream.write = vi.fn();
mockStream.end = vi.fn();

// Mock DockerClient singleton
vi.mock('../../docker-client', () => ({
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

vi.mock('../../docker-pty-stream', () => ({
  DockerPTYStream: class {
    constructor() {
      return mockPTYStreamInstance;
    }
  },
}));

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn().mockReturnValue([]),
        })),
        all: vi.fn().mockReturnValue([]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(),
        })),
      })),
    })),
  },
  schema: { sessions: {}, sshKeys: {} },
}));

// Mock other services
vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: class {
    getEffectiveSettings = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: class {
    decrypt = vi.fn().mockResolvedValue('decrypted');
  },
}));

// Mock FS
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe('DockerAdapter Sessions', () => {
  let adapter: DockerAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockDockerClient.createContainer.mockResolvedValue(mockContainer);
    mockDockerClient.getContainer.mockReturnValue(mockContainer);
    mockDockerClient.inspectContainer.mockResolvedValue({ State: { Running: true } }); // Added
    mockContainer.attach.mockResolvedValue(mockStream);
    mockContainer.start.mockResolvedValue(undefined);
    // container.inspect() はサブネット取得にも使用される
    mockContainer.inspect.mockResolvedValue({
      State: { Running: true },
      NetworkSettings: {
        Networks: {
          bridge: {
            IPAddress: '172.17.0.2',
            IPPrefixLen: 16,
          },
        },
      },
    });
    mockContainer.exec.mockResolvedValue(mockExec);
    mockExec.start.mockResolvedValue(mockStream);
    
    adapter = new DockerAdapter({
      environmentId: 'env-1',
      imageName: 'test-image',
      imageTag: 'latest',
      authDirPath: '/data/environments/env-1',
    });
  });

  describe('createSession', () => {
    it('should create container and attach PTY stream', async () => {
      await adapter.createSession('session-1', '/workspace');

      expect(mockDockerClient.createContainer).toHaveBeenCalled();
      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Image).toBe('test-image:latest');
      expect(createOptions.Tty).toBe(true);
      
      expect(mockContainer.attach).toHaveBeenCalledWith(expect.objectContaining({
        hijack: true,
        stream: true,
      }));
      
      expect(mockContainer.start).toHaveBeenCalled();
      
      expect(mockPTYStreamInstance.setStream).toHaveBeenCalledWith(mockStream);
    });

    it('should handle custom env vars', async () => {
      await adapter.createSession('session-1', '/workspace', undefined, {
        customEnvVars: { TEST_VAR: 'value' }
      });

      const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
      expect(createOptions.Env).toContain('TEST_VAR=value');
    });
  });

  describe('createExecSession (Shell Mode)', () => {
    it('should attach to existing container in shell mode', async () => {
      // Create parent session first (getParentContainerName checks sessions map)
      await adapter.createSession('parent-session', '/workspace');

      // Create exec session (must end with -terminal to be linked to parent-session)
      await adapter.createSession('parent-session-terminal', '/workspace', undefined, { shellMode: true });

      expect(mockContainer.exec).toHaveBeenCalledWith(expect.objectContaining({
        Cmd: ['bash'],
        Tty: true,
      }));

      expect(mockExec.start).toHaveBeenCalledWith(expect.objectContaining({
        hijack: true,
        Tty: true,
      }));
    });

    it('should throw error when parent container not found in shell mode', async () => {
      // No parent session created - orphan terminal should fail
      await expect(
        adapter.createSession('orphan-terminal', '/workspace', undefined, { shellMode: true })
      ).rejects.toThrow(/Dockerコンテナが見つかりません/);
    });
  });
});
