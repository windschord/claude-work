/**
 * RepositoryManager のテスト
 * リポジトリの登録・管理を行うサービス
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Repository } from '@prisma/client';

// Mock prisma before importing RepositoryManager
vi.mock('@/lib/db', () => ({
  prisma: {
    repository: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      count: vi.fn(),
    },
  },
}));

// Mock FilesystemService - need to use class mock
const mockFilesystemServiceInstance = {
  isGitRepository: vi.fn(),
  getCurrentBranch: vi.fn(),
  getGitBranches: vi.fn(),
};

vi.mock('../filesystem-service', () => ({
  FilesystemService: class {
    isGitRepository = mockFilesystemServiceInstance.isGitRepository;
    getCurrentBranch = mockFilesystemServiceInstance.getCurrentBranch;
    getGitBranches = mockFilesystemServiceInstance.getGitBranches;
  },
}));

import { RepositoryManager, RepositoryNotFoundError, RepositoryHasSessionsError } from '../repository-manager';
import { prisma } from '@/lib/db';

const mockPrisma = vi.mocked(prisma);

describe('RepositoryManager', () => {
  let repositoryManager: RepositoryManager;
  let mockExecFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFn = vi.fn();
    repositoryManager = new RepositoryManager({ execFn: mockExecFn });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    describe('local repository', () => {
      it('should register a local repository', async () => {
        const input = {
          name: 'my-local-repo',
          type: 'local' as const,
          path: '/home/user/projects/my-repo',
        };

        mockFilesystemServiceInstance.isGitRepository.mockResolvedValue(true);
        mockFilesystemServiceInstance.getCurrentBranch.mockResolvedValue('main');

        const expectedRepository: Repository = {
          id: 'uuid-123',
          name: 'my-local-repo',
          type: 'local',
          path: '/home/user/projects/my-repo',
          url: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.repository.create.mockResolvedValue(expectedRepository);

        const result = await repositoryManager.register(input);

        expect(mockFilesystemServiceInstance.isGitRepository).toHaveBeenCalledWith('/home/user/projects/my-repo');
        expect(mockFilesystemServiceInstance.getCurrentBranch).toHaveBeenCalledWith('/home/user/projects/my-repo');
        expect(mockPrisma.repository.create).toHaveBeenCalledWith({
          data: {
            name: 'my-local-repo',
            type: 'local',
            path: '/home/user/projects/my-repo',
            url: null,
            defaultBranch: 'main',
          },
        });
        expect(result).toEqual(expectedRepository);
      });

      it('should throw error if local path is not a git repository', async () => {
        const input = {
          name: 'not-a-repo',
          type: 'local' as const,
          path: '/home/user/projects/not-a-repo',
        };

        mockFilesystemServiceInstance.isGitRepository.mockResolvedValue(false);

        await expect(repositoryManager.register(input)).rejects.toThrow('Path is not a git repository');
      });

      it('should throw error if path is not provided for local type', async () => {
        const input = {
          name: 'local-repo',
          type: 'local' as const,
        };

        await expect(repositoryManager.register(input)).rejects.toThrow('Path is required for local repository');
      });
    });

    describe('remote repository', () => {
      it('should register a remote repository', async () => {
        const input = {
          name: 'my-remote-repo',
          type: 'remote' as const,
          url: 'https://github.com/user/repo.git',
        };

        mockExecFn.mockResolvedValue({
          stdout: 'ref: refs/heads/main\tHEAD\naaaabbbb1234567890abcdef1234567890abcdef\tHEAD\n',
          stderr: '',
        });

        const expectedRepository: Repository = {
          id: 'uuid-456',
          name: 'my-remote-repo',
          type: 'remote',
          path: null,
          url: 'https://github.com/user/repo.git',
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.repository.create.mockResolvedValue(expectedRepository);

        const result = await repositoryManager.register(input);

        expect(mockExecFn).toHaveBeenCalledWith(
          'git ls-remote --symref https://github.com/user/repo.git HEAD'
        );
        expect(mockPrisma.repository.create).toHaveBeenCalledWith({
          data: {
            name: 'my-remote-repo',
            type: 'remote',
            path: null,
            url: 'https://github.com/user/repo.git',
            defaultBranch: 'main',
          },
        });
        expect(result).toEqual(expectedRepository);
      });

      it('should throw error if url is not provided for remote type', async () => {
        const input = {
          name: 'remote-repo',
          type: 'remote' as const,
        };

        await expect(repositoryManager.register(input)).rejects.toThrow('URL is required for remote repository');
      });

      it('should throw error if git ls-remote fails', async () => {
        const input = {
          name: 'invalid-remote-repo',
          type: 'remote' as const,
          url: 'https://github.com/user/invalid-repo.git',
        };

        mockExecFn.mockRejectedValue(new Error('Repository not found'));

        await expect(repositoryManager.register(input)).rejects.toThrow('Failed to get default branch from remote repository');
      });

      it('should parse default branch correctly from various outputs', async () => {
        const input = {
          name: 'repo-with-master',
          type: 'remote' as const,
          url: 'https://github.com/user/repo.git',
        };

        mockExecFn.mockResolvedValue({
          stdout: 'ref: refs/heads/master\tHEAD\naaaabbbb1234567890abcdef1234567890abcdef\tHEAD\n',
          stderr: '',
        });

        const expectedRepository: Repository = {
          id: 'uuid-789',
          name: 'repo-with-master',
          type: 'remote',
          path: null,
          url: 'https://github.com/user/repo.git',
          defaultBranch: 'master',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.repository.create.mockResolvedValue(expectedRepository);

        const result = await repositoryManager.register(input);

        expect(result.defaultBranch).toBe('master');
      });
    });
  });

  describe('findAll', () => {
    it('should return all repositories with session count', async () => {
      const mockRepositories = [
        {
          id: 'uuid-1',
          name: 'repo-1',
          type: 'local',
          path: '/home/user/repo1',
          url: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { sessions: 2 },
        },
        {
          id: 'uuid-2',
          name: 'repo-2',
          type: 'remote',
          path: null,
          url: 'https://github.com/user/repo2.git',
          defaultBranch: 'develop',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { sessions: 0 },
        },
      ];

      mockPrisma.repository.findMany.mockResolvedValue(mockRepositories);

      const result = await repositoryManager.findAll();

      expect(mockPrisma.repository.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { sessions: true },
          },
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'uuid-1',
        name: 'repo-1',
        sessionCount: 2,
      });
      expect(result[1]).toMatchObject({
        id: 'uuid-2',
        name: 'repo-2',
        sessionCount: 0,
      });
    });

    it('should return empty array when no repositories exist', async () => {
      mockPrisma.repository.findMany.mockResolvedValue([]);

      const result = await repositoryManager.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return repository when found', async () => {
      const expectedRepository: Repository = {
        id: 'uuid-123',
        name: 'my-repo',
        type: 'local',
        path: '/home/user/projects/my-repo',
        url: null,
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.repository.findUnique.mockResolvedValue(expectedRepository);

      const result = await repositoryManager.findById('uuid-123');

      expect(mockPrisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
      expect(result).toEqual(expectedRepository);
    });

    it('should return null when repository not found', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      const result = await repositoryManager.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete repository when it has no sessions', async () => {
      const repository: Repository = {
        id: 'uuid-123',
        name: 'my-repo',
        type: 'local',
        path: '/home/user/projects/my-repo',
        url: null,
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.repository.findUnique.mockResolvedValue(repository);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.repository.delete.mockResolvedValue(repository);

      await repositoryManager.delete('uuid-123');

      expect(mockPrisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
      expect(mockPrisma.session.count).toHaveBeenCalledWith({
        where: { repositoryId: 'uuid-123' },
      });
      expect(mockPrisma.repository.delete).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
    });

    it('should throw error when repository has sessions', async () => {
      const repository: Repository = {
        id: 'uuid-123',
        name: 'my-repo',
        type: 'local',
        path: '/home/user/projects/my-repo',
        url: null,
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.repository.findUnique.mockResolvedValue(repository);
      mockPrisma.session.count.mockResolvedValue(3);

      await expect(repositoryManager.delete('uuid-123')).rejects.toThrow(RepositoryHasSessionsError);
      await expect(repositoryManager.delete('uuid-123')).rejects.toThrow('Cannot delete repository with 3 active sessions');

      expect(mockPrisma.repository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when repository not found', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(repositoryManager.delete('non-existent')).rejects.toThrow(RepositoryNotFoundError);
      await expect(repositoryManager.delete('non-existent')).rejects.toThrow('Repository not found: non-existent');
    });
  });

  describe('getBranches', () => {
    describe('local repository', () => {
      it('should return branches for local repository', async () => {
        const repository: Repository = {
          id: 'uuid-123',
          name: 'my-local-repo',
          type: 'local',
          path: '/home/user/projects/my-repo',
          url: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.repository.findUnique.mockResolvedValue(repository);
        mockFilesystemServiceInstance.getGitBranches.mockResolvedValue(['main', 'develop', 'feature/test']);

        const result = await repositoryManager.getBranches('uuid-123');

        expect(mockFilesystemServiceInstance.getGitBranches).toHaveBeenCalledWith('/home/user/projects/my-repo');
        expect(result).toEqual({
          branches: ['main', 'develop', 'feature/test'],
          defaultBranch: 'main',
        });
      });
    });

    describe('remote repository', () => {
      it('should return branches for remote repository', async () => {
        const repository: Repository = {
          id: 'uuid-456',
          name: 'my-remote-repo',
          type: 'remote',
          path: null,
          url: 'https://github.com/user/repo.git',
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.repository.findUnique.mockResolvedValue(repository);
        mockExecFn.mockResolvedValue({
          stdout: 'aaaabbbb1234567890abcdef1234567890abcdef\trefs/heads/main\nbbbbcccc1234567890abcdef1234567890abcdef\trefs/heads/develop\nccccdddd1234567890abcdef1234567890abcdef\trefs/heads/feature/test\n',
          stderr: '',
        });

        const result = await repositoryManager.getBranches('uuid-456');

        expect(mockExecFn).toHaveBeenCalledWith(
          'git ls-remote --heads https://github.com/user/repo.git'
        );
        expect(result).toEqual({
          branches: ['main', 'develop', 'feature/test'],
          defaultBranch: 'main',
        });
      });
    });

    it('should throw error when repository not found', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(repositoryManager.getBranches('non-existent')).rejects.toThrow(RepositoryNotFoundError);
    });
  });
});
