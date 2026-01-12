import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma before importing SessionManager
vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { SessionManager } from '../session-manager';
import { prisma } from '@/lib/db';

const mockPrisma = vi.mocked(prisma);

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a new session from remote repository (legacy input)', async () => {
      const input = {
        name: 'test-session',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      };

      const expectedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: null,
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          volumeName: input.volumeName,
          repoUrl: input.repoUrl,
          localPath: null,
          branch: input.branch,
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });

    it('should create a new session from remote repository (new input format)', async () => {
      const input = {
        sourceType: 'remote' as const,
        name: 'test-session',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      };

      const expectedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: null,
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          volumeName: input.volumeName,
          repoUrl: input.repoUrl,
          localPath: null,
          branch: input.branch,
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });

    it('should create a new session from local directory', async () => {
      const input = {
        sourceType: 'local' as const,
        name: 'local-session',
        volumeName: 'vol-local-123',
        localPath: '/home/user/projects/my-repo',
      };

      const expectedSession = {
        id: 'uuid-456',
        name: 'local-session',
        containerId: null,
        volumeName: 'vol-local-123',
        repoUrl: null,
        localPath: '/home/user/projects/my-repo',
        branch: 'main',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          volumeName: input.volumeName,
          localPath: input.localPath,
          repoUrl: null,
          branch: 'main',
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });

    it('should create a new session from local directory with custom branch', async () => {
      const input = {
        sourceType: 'local' as const,
        name: 'local-session',
        volumeName: 'vol-local-123',
        localPath: '/home/user/projects/my-repo',
        branch: 'develop',
      };

      const expectedSession = {
        id: 'uuid-789',
        name: 'local-session',
        containerId: null,
        volumeName: 'vol-local-123',
        repoUrl: null,
        localPath: '/home/user/projects/my-repo',
        branch: 'develop',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          volumeName: input.volumeName,
          localPath: input.localPath,
          repoUrl: null,
          branch: 'develop',
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });
  });

  describe('findById', () => {
    it('should return session when found', async () => {
      const expectedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: 'container-abc',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.findUnique.mockResolvedValue(expectedSession);

      const result = await sessionManager.findById('uuid-123');

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
      expect(result).toEqual(expectedSession);
    });

    it('should return null when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await sessionManager.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all sessions', async () => {
      const expectedSessions = [
        {
          id: 'uuid-1',
          name: 'session-1',
          containerId: 'container-1',
          volumeName: 'vol-1',
          repoUrl: 'https://github.com/test/repo1.git',
          localPath: null,
          branch: 'main',
          status: 'running',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'uuid-2',
          name: 'session-2',
          containerId: null,
          volumeName: 'vol-2',
          repoUrl: 'https://github.com/test/repo2.git',
          localPath: null,
          branch: 'develop',
          status: 'stopped',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.session.findMany.mockResolvedValue(expectedSessions);

      const result = await sessionManager.findAll();

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(expectedSessions);
    });

    it('should return empty array when no sessions exist', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      const result = await sessionManager.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update session status', async () => {
      const updatedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: 'container-abc',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.update.mockResolvedValue(updatedSession);

      await sessionManager.updateStatus('uuid-123', 'running');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { status: 'running' },
      });
    });

    it('should update status to error', async () => {
      const updatedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: null,
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'error',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.update.mockResolvedValue(updatedSession);

      await sessionManager.updateStatus('uuid-123', 'error');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { status: 'error' },
      });
    });
  });

  describe('updateContainerId', () => {
    it('should update session containerId', async () => {
      const updatedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: 'new-container-xyz',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.update.mockResolvedValue(updatedSession);

      await sessionManager.updateContainerId('uuid-123', 'new-container-xyz');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { containerId: 'new-container-xyz' },
      });
    });
  });

  describe('delete', () => {
    it('should delete session by id', async () => {
      const deletedSession = {
        id: 'uuid-123',
        name: 'test-session',
        containerId: 'container-abc',
        volumeName: 'vol-test-123',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: null,
        branch: 'main',
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.session.delete.mockResolvedValue(deletedSession);

      await sessionManager.delete('uuid-123');

      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
    });
  });
});
