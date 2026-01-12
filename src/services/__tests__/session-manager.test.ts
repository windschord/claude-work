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

// Helper to create mock repository data
const createMockRepository = (overrides = {}) => ({
  id: 'repo-uuid-123',
  name: 'test-repo',
  type: 'remote',
  path: null,
  url: 'https://github.com/test/repo.git',
  defaultBranch: 'main',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock session data
const createMockSession = (overrides = {}) => ({
  id: 'uuid-123',
  name: 'test-session',
  containerId: null,
  volumeName: 'vol-test-123',
  repositoryId: 'repo-uuid-123',
  worktreePath: null,
  parentBranch: 'main',
  branch: 'session/test-session',
  status: 'creating',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock session with repository
const createMockSessionWithRepository = (
  sessionOverrides = {},
  repositoryOverrides = {}
) => ({
  ...createMockSession(sessionOverrides),
  repository: createMockRepository(repositoryOverrides),
});

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
    it('should create a new session with repository reference', async () => {
      const input = {
        name: 'test-session',
        repositoryId: 'repo-uuid-123',
        volumeName: 'vol-test-123',
        branch: 'session/test-session',
        parentBranch: 'main',
      };

      const expectedSession = createMockSession({
        name: input.name,
        repositoryId: input.repositoryId,
        volumeName: input.volumeName,
        branch: input.branch,
        parentBranch: input.parentBranch,
      });

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          repositoryId: input.repositoryId,
          volumeName: input.volumeName,
          worktreePath: null,
          branch: input.branch,
          parentBranch: input.parentBranch,
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });

    it('should create a new session with worktreePath for local repository', async () => {
      const input = {
        name: 'local-session',
        repositoryId: 'repo-local-123',
        volumeName: 'vol-local-123',
        worktreePath: '/home/user/projects/my-repo/.git/worktrees/session-local',
        branch: 'session/local-session',
        parentBranch: 'develop',
      };

      const expectedSession = createMockSession({
        id: 'uuid-456',
        name: input.name,
        repositoryId: input.repositoryId,
        volumeName: input.volumeName,
        worktreePath: input.worktreePath,
        branch: input.branch,
        parentBranch: input.parentBranch,
      });

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          repositoryId: input.repositoryId,
          volumeName: input.volumeName,
          worktreePath: input.worktreePath,
          branch: input.branch,
          parentBranch: input.parentBranch,
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });

    it('should create session without worktreePath when not provided', async () => {
      const input = {
        name: 'remote-session',
        repositoryId: 'repo-remote-123',
        volumeName: 'vol-remote-123',
        branch: 'session/remote-session',
        parentBranch: 'main',
      };

      const expectedSession = createMockSession({
        name: input.name,
        repositoryId: input.repositoryId,
        volumeName: input.volumeName,
        worktreePath: null,
        branch: input.branch,
        parentBranch: input.parentBranch,
      });

      mockPrisma.session.create.mockResolvedValue(expectedSession);

      const result = await sessionManager.create(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          repositoryId: input.repositoryId,
          volumeName: input.volumeName,
          worktreePath: null,
          branch: input.branch,
          parentBranch: input.parentBranch,
          status: 'creating',
        },
      });
      expect(result).toEqual(expectedSession);
    });
  });

  describe('findById', () => {
    it('should return session with repository when found', async () => {
      const expectedSessionWithRepo = createMockSessionWithRepository(
        {
          containerId: 'container-abc',
          status: 'running',
        },
        {
          type: 'remote',
          url: 'https://github.com/test/repo.git',
        }
      );

      mockPrisma.session.findUnique.mockResolvedValue(expectedSessionWithRepo);

      const result = await sessionManager.findById('uuid-123');

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        include: { repository: true },
      });
      expect(result).toEqual(expectedSessionWithRepo);
      expect(result?.repository).toBeDefined();
      expect(result?.repository.type).toBe('remote');
    });

    it('should return session with local repository when found', async () => {
      const expectedSessionWithRepo = createMockSessionWithRepository(
        {
          id: 'uuid-local',
          worktreePath: '/home/user/projects/my-repo/.git/worktrees/session',
        },
        {
          id: 'repo-local',
          type: 'local',
          path: '/home/user/projects/my-repo',
          url: null,
        }
      );

      mockPrisma.session.findUnique.mockResolvedValue(expectedSessionWithRepo);

      const result = await sessionManager.findById('uuid-local');

      expect(result?.repository.type).toBe('local');
      expect(result?.repository.path).toBe('/home/user/projects/my-repo');
      expect(result?.worktreePath).toBe('/home/user/projects/my-repo/.git/worktrees/session');
    });

    it('should return null when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await sessionManager.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all sessions with repository information', async () => {
      const expectedSessions = [
        createMockSessionWithRepository(
          {
            id: 'uuid-1',
            name: 'session-1',
            containerId: 'container-1',
            status: 'running',
          },
          {
            id: 'repo-1',
            name: 'repo-1',
            type: 'remote',
            url: 'https://github.com/test/repo1.git',
          }
        ),
        createMockSessionWithRepository(
          {
            id: 'uuid-2',
            name: 'session-2',
            containerId: null,
            status: 'stopped',
            worktreePath: '/path/to/worktree',
          },
          {
            id: 'repo-2',
            name: 'repo-2',
            type: 'local',
            path: '/home/user/repo2',
            url: null,
          }
        ),
      ];

      mockPrisma.session.findMany.mockResolvedValue(expectedSessions);

      const result = await sessionManager.findAll();

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { repository: true },
      });
      expect(result).toEqual(expectedSessions);
      expect(result[0].repository.type).toBe('remote');
      expect(result[1].repository.type).toBe('local');
    });

    it('should return empty array when no sessions exist', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      const result = await sessionManager.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update session status', async () => {
      const updatedSession = createMockSession({
        containerId: 'container-abc',
        status: 'running',
      });

      mockPrisma.session.update.mockResolvedValue(updatedSession);

      await sessionManager.updateStatus('uuid-123', 'running');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { status: 'running' },
      });
    });

    it('should update status to error', async () => {
      const updatedSession = createMockSession({
        status: 'error',
      });

      mockPrisma.session.update.mockResolvedValue(updatedSession);

      await sessionManager.updateStatus('uuid-123', 'error');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { status: 'error' },
      });
    });

    it('should update status to stopped', async () => {
      const updatedSession = createMockSession({
        status: 'stopped',
      });

      mockPrisma.session.update.mockResolvedValue(updatedSession);

      await sessionManager.updateStatus('uuid-123', 'stopped');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { status: 'stopped' },
      });
    });
  });

  describe('updateContainerId', () => {
    it('should update session containerId', async () => {
      const updatedSession = createMockSession({
        containerId: 'new-container-xyz',
        status: 'running',
      });

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
      const deletedSession = createMockSession({
        containerId: 'container-abc',
        status: 'stopped',
      });

      mockPrisma.session.delete.mockResolvedValue(deletedSession);

      await sessionManager.delete('uuid-123');

      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
    });
  });
});
