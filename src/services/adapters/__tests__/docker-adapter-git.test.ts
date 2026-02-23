import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    inspectContainer: vi.fn(),
    getContainer: vi.fn(),
    run: vi.fn(),
  }
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

describe('DockerAdapter Git Operations', () => {
  let adapter: DockerAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();

    adapter = new DockerAdapter({
      environmentId: 'test-env',
      imageName: 'node',
      imageTag: '20-alpine',
      authDirPath: '/tmp/test-auth',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('gitClone', () => {
    it('should clone a repository successfully', async () => {
      // Mock DockerClient.run to simulate successful git clone
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[0]) {
            streams[0].write('Cloning into /workspace/target...\nDone.');
          }
          return { StatusCode: 0 };
        }
      );

      const result = await adapter.gitClone({
        url: 'git@github.com:test/repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/test-repo');
      expect(result.error).toBeUndefined();
    });

    it('should handle clone failure', async () => {
      // Mock DockerClient.run to simulate git clone failure
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[1]) {
            streams[1].write('fatal: Could not read from remote repository');
          }
          return { StatusCode: 1 };
        }
      );

      const result = await adapter.gitClone({
        url: 'git@github.com:test/invalid-repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('fatal: Could not read from remote repository');
    });

    it('should handle Docker run error', async () => {
      // Mock DockerClient.run to throw error
      mockDockerClient.run.mockRejectedValue(new Error('Docker not found'));

      const result = await adapter.gitClone({
        url: 'git@github.com:test/repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(false);
      // runEphemeralContainer catches the error and returns { code: 1, stderr: error.message }
      // gitClone then returns { success: false, error: result.stderr }
      expect(result.error).toBe('Docker not found');
    });
  });

  describe('gitPull', () => {
    it('should pull successfully with updates', async () => {
      // Mock DockerClient.run to simulate successful pull with updates
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[0]) {
            streams[0].write('Updating abc123..def456\nFast-forward\n file.txt | 1 +\n');
          }
          return { StatusCode: 0 };
        }
      );

      const result = await adapter.gitPull('/tmp/test-repo');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.message).toContain('Fast-forward');
    });

    it('should pull successfully without updates', async () => {
      // Mock DockerClient.run to simulate pull with no updates
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[0]) {
            streams[0].write('Already up to date.');
          }
          return { StatusCode: 0 };
        }
      );

      const result = await adapter.gitPull('/tmp/test-repo');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.message).toBe('Already up to date.');
    });

    it('should handle fast-forward failure', async () => {
      // Mock DockerClient.run to simulate fast-forward failure
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[1]) {
            streams[1].write('fatal: Not possible to fast-forward, aborting.');
          }
          return { StatusCode: 1 };
        }
      );

      const result = await adapter.gitPull('/tmp/test-repo');

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toContain('fast-forward');
    });
  });

  describe('gitGetBranches', () => {
    it('should return local and remote branches', async () => {
      // Mock for: 1st call = local branches, 2nd = remote branches, 3rd = default branch
      const localOutput = '* main\n  feature-1\n  feature-2\n';
      const remoteOutput = '  origin/HEAD -> origin/main\n  origin/main\n  origin/feature-1\n';
      const defaultOutput = 'refs/remotes/origin/main\n';

      let callCount = 0;
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          callCount++;
          let output = '';

          // 1st call: git branch (local)
          if (callCount === 1) {
            output = localOutput;
          }
          // 2nd call: git branch -r (remote)
          else if (callCount === 2) {
            output = remoteOutput;
          }
          // 3rd call: git symbolic-ref (default)
          else if (callCount === 3) {
            output = defaultOutput;
          }

          if (streams && streams[0]) {
            streams[0].write(output);
          }
          return { StatusCode: 0 };
        }
      );

      const result = await adapter.gitGetBranches('/tmp/test-repo');

      expect(result).toHaveLength(5);
      // Local branches
      expect(result).toContainEqual({
        name: 'main',
        isDefault: true,
        isRemote: false,
      });
      expect(result).toContainEqual({
        name: 'feature-1',
        isDefault: false,
        isRemote: false,
      });
      expect(result).toContainEqual({
        name: 'feature-2',
        isDefault: false,
        isRemote: false,
      });
      // Remote branches
      expect(result).toContainEqual({
        name: 'origin/main',
        isDefault: false,
        isRemote: true,
      });
      expect(result).toContainEqual({
        name: 'origin/feature-1',
        isDefault: false,
        isRemote: true,
      });
    });

    it('should handle git command failure gracefully', async () => {
      // Mock DockerClient.run to simulate error (non-zero status code)
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[1]) {
            streams[1].write('fatal: not a git repository');
          }
          return { StatusCode: 128 };
        }
      );

      const result = await adapter.gitGetBranches('/tmp/invalid-repo');

      expect(result).toEqual([]);
    });
  });

  describe('gitGetDefaultBranch', () => {
    it('should return default branch name', async () => {
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[0]) {
            streams[0].write('refs/remotes/origin/main\n');
          }
          return { StatusCode: 0 };
        }
      );

      const result = await adapter.gitGetDefaultBranch('/tmp/test-repo');

      expect(result).toBe('main');
    });

    it('should return "main" if symbolic-ref fails', async () => {
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[1]) {
            streams[1].write('fatal: ref refs/remotes/origin/HEAD is not a symbolic ref');
          }
          return { StatusCode: 1 };
        }
      );

      const result = await adapter.gitGetDefaultBranch('/tmp/test-repo');

      expect(result).toBe('main');
    });

    it('should handle "develop" as default branch', async () => {
      mockDockerClient.run.mockImplementation(
        async (_image: string, _cmd: string[], streams: any[], _options: any) => {
          if (streams && streams[0]) {
            streams[0].write('refs/remotes/origin/develop\n');
          }
          return { StatusCode: 0 };
        }
      );

      const result = await adapter.gitGetDefaultBranch('/tmp/test-repo');

      expect(result).toBe('develop');
    });
  });
});
