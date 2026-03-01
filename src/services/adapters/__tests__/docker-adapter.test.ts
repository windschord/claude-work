import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';

// Mock DockerClient and fs.existsSync via hoisted to avoid linter issues
const { mockDockerClient, mockExistsSync } = vi.hoisted(() => ({
  mockDockerClient: {
    inspectContainer: vi.fn(),
    getContainer: vi.fn(),
    run: vi.fn(),
  },
  mockExistsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('../../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// Mock other dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn().mockReturnValue([])
        })),
        all: vi.fn().mockReturnValue([])
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn()
        }))
      }))
    }))
  },
  schema: { sessions: {}, sshKeys: {} },
}));

vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: vi.fn().mockImplementation(function() {
    return {
      getEffectiveSettings: vi.fn().mockResolvedValue({}),
    };
  }),
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: vi.fn().mockImplementation(function() {
    return {
      decrypt: vi.fn().mockResolvedValue('decrypted'),
    };
  }),
}));

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Mock tar-fs to prevent real file streaming
vi.mock('tar-fs', () => ({
  default: {
    pack: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  },
  pack: vi.fn().mockReturnValue({ pipe: vi.fn() }),
}));

// Mock fs to prevent real filesystem operations - uses hoisted mockExistsSync
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
    writeFileSync: vi.fn(),
    createReadStream: vi.fn(),
  };
});

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
  access: vi.fn().mockResolvedValue(undefined),
}));

describe('DockerAdapter', () => {
  let adapter: DockerAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    adapter = new DockerAdapter({
      environmentId: 'env-1',
      imageName: 'test-image',
      imageTag: 'latest',
      authDirPath: '/data/environments/env-1',
    });
  });

  describe('isContainerRunning', () => {
    it('should use DockerClient.inspectContainer', async () => {
      mockDockerClient.inspectContainer.mockResolvedValue({ State: { Running: true } });
      const result = await (adapter as any).isContainerRunning('container-1');
      expect(result).toBe(true);
      expect(mockDockerClient.inspectContainer).toHaveBeenCalledWith('container-1');
    });

    it('should return false if inspect fails', async () => {
      mockDockerClient.inspectContainer.mockRejectedValue(new Error('Not found'));
      const result = await (adapter as any).isContainerRunning('container-1');
      expect(result).toBe(false);
    });
  });

  describe('stopContainer', () => {
    it('should use DockerClient.getContainer().stop()', async () => {
      const mockContainer = { stop: vi.fn().mockResolvedValue(undefined) };
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      await (adapter as any).stopContainer('container-1');

      expect(mockDockerClient.getContainer).toHaveBeenCalledWith('container-1');
      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
    });
  });

  describe('runEphemeralContainer', () => {
    it('should use DockerClient.run', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 0 });

      const result = await (adapter as any).runEphemeralContainer(['echo', 'hello'], {});

      expect(mockDockerClient.run).toHaveBeenCalled();
      expect(result.code).toBe(0);
    });
  });

  describe('getConfigVolumeNames', () => {
    it('環境IDから正しいVolume名を生成する', () => {
      const names = DockerAdapter.getConfigVolumeNames('test-env-123');
      expect(names.claudeVolume).toBe('claude-config-claude-test-env-123');
      expect(names.configClaudeVolume).toBe('claude-config-configclaude-test-env-123');
    });

    it('UUIDベースの環境IDでも正しいVolume名を生成する', () => {
      const names = DockerAdapter.getConfigVolumeNames('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(names.claudeVolume).toBe('claude-config-claude-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(names.configClaudeVolume).toBe('claude-config-configclaude-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });

  describe('constructor with optional authDirPath', () => {
    it('authDirPathがundefinedでもエラーにならない', () => {
      expect(() => new DockerAdapter({
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
      })).not.toThrow();
    });

    it('authDirPathが指定されている場合は既存のバリデーションが適用される', () => {
      expect(() => new DockerAdapter({
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: 'relative/path',
      })).toThrow('authDirPath must be an absolute path');
    });

    it('authDirPathにenvironmentIdが含まれていない場合はエラー', () => {
      expect(() => new DockerAdapter({
        environmentId: 'test-env',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: '/data/environments/other-env',
      })).toThrow('authDirPath must contain environmentId');
    });
  });

  describe('buildContainerOptions with named volumes', () => {
    it('authDirPathがundefinedの場合、名前付きVolumeをBindsに含める', () => {
      const adapterNoAuth = new DockerAdapter({
        environmentId: 'env-abc',
        imageName: 'test-image',
        imageTag: 'latest',
      });
      const { createOptions } = (adapterNoAuth as any).buildContainerOptions('/workspace');
      const binds = createOptions.HostConfig.Binds as string[];
      expect(binds).toContain('claude-config-claude-env-abc:/home/node/.claude');
      expect(binds).toContain('claude-config-configclaude-env-abc:/home/node/.config/claude');
    });

    it('authDirPathが設定されている場合はバインドマウントを使用（後方互換）', () => {
      mockExistsSync.mockReturnValue(true);

      const adapterWithAuth = new DockerAdapter({
        environmentId: 'env-1',
        imageName: 'test-image',
        imageTag: 'latest',
        authDirPath: '/data/environments/env-1',
      });
      const { createOptions } = (adapterWithAuth as any).buildContainerOptions('/workspace');
      const binds = createOptions.HostConfig.Binds as string[];
      expect(binds).toContain('/data/environments/env-1/claude:/home/node/.claude');
      expect(binds).toContain('/data/environments/env-1/config/claude:/home/node/.config/claude');
      // 名前付きVolumeが含まれていないことを確認
      const namedVolumeBinds = binds.filter((b) => b.startsWith('claude-config-'));
      expect(namedVolumeBinds).toHaveLength(0);

      mockExistsSync.mockReturnValue(false);
    });
  });
});
