import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted for proper mock hoisting
const mocks = vi.hoisted(() => {
  const mockContainerManager = {
    createSession: vi.fn(),
    listSessions: vi.fn(),
    startSession: vi.fn(),
    stopSession: vi.fn(),
    deleteSession: vi.fn(),
    getSessionStatus: vi.fn(),
  };

  return { mockContainerManager };
});

vi.mock('@/services/container-manager', () => ({
  ContainerManager: class MockContainerManager {
    createSession = mocks.mockContainerManager.createSession;
    listSessions = mocks.mockContainerManager.listSessions;
    startSession = mocks.mockContainerManager.startSession;
    stopSession = mocks.mockContainerManager.stopSession;
    deleteSession = mocks.mockContainerManager.deleteSession;
    getSessionStatus = mocks.mockContainerManager.getSessionStatus;
  },
}));

vi.mock('@/services/repository-manager', () => ({
  RepositoryNotFoundError: class RepositoryNotFoundError extends Error {
    constructor(id: string) {
      super(`Repository not found: ${id}`);
      this.name = 'RepositoryNotFoundError';
    }
  },
}));

import { GET, POST } from '../route';
import { RepositoryNotFoundError } from '@/services/repository-manager';

describe('Sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/sessions', () => {
    it('should return all sessions with repository information', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'test-session-1',
          containerId: 'container-1',
          volumeName: 'claudework-session-1',
          branch: 'session/test-session-1',
          parentBranch: 'main',
          worktreePath: '/home/user/.claudework/worktrees/my-project-test-session-1',
          status: 'running',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          repositoryId: 'repo-1',
          repository: {
            id: 'repo-1',
            name: 'my-project',
            type: 'local',
            path: '/home/user/projects/my-project',
            url: null,
            defaultBranch: 'main',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        {
          id: 'session-2',
          name: 'test-session-2',
          containerId: 'container-2',
          volumeName: 'claudework-session-2',
          branch: 'session/test-session-2',
          parentBranch: 'develop',
          worktreePath: null,
          status: 'stopped',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          repositoryId: 'repo-2',
          repository: {
            id: 'repo-2',
            name: 'remote-project',
            type: 'remote',
            path: null,
            url: 'https://github.com/test/repo.git',
            defaultBranch: 'main',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ];

      mocks.mockContainerManager.listSessions.mockResolvedValue(mockSessions);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0].name).toBe('test-session-1');
      expect(data.sessions[0].repository.name).toBe('my-project');
      expect(data.sessions[0].repository.type).toBe('local');
      expect(data.sessions[1].repository.type).toBe('remote');
      expect(mocks.mockContainerManager.listSessions).toHaveBeenCalled();
    });

    it('should return empty array when no sessions exist', async () => {
      mocks.mockContainerManager.listSessions.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessions).toEqual([]);
    });

    it('should return 500 on server error', async () => {
      mocks.mockContainerManager.listSessions.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/sessions', () => {
    it('should create a new session with repositoryId and parentBranch', async () => {
      const mockSession = {
        id: 'new-session-123',
        name: 'new-session',
        containerId: 'container-new',
        volumeName: 'claudework-new-session',
        branch: 'session/new-session',
        parentBranch: 'main',
        worktreePath: '/home/user/.claudework/worktrees/my-project-new-session',
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        repositoryId: 'repo-1',
        repository: {
          id: 'repo-1',
          name: 'my-project',
          type: 'local',
          path: '/home/user/projects/my-project',
          url: null,
          defaultBranch: 'main',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      mocks.mockContainerManager.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'new-session',
          repositoryId: 'repo-1',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.session.id).toBe('new-session-123');
      expect(data.session.name).toBe('new-session');
      expect(data.session.branch).toBe('session/new-session');
      expect(data.session.parentBranch).toBe('main');
      expect(mocks.mockContainerManager.createSession).toHaveBeenCalledWith({
        name: 'new-session',
        repositoryId: 'repo-1',
        parentBranch: 'main',
      });
    });

    it('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          repositoryId: 'repo-1',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('name');
    });

    it('should return 400 when repositoryId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('repositoryId');
    });

    it('should return 400 when parentBranch is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repositoryId: 'repo-1',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parentBranch');
    });

    it('should return 400 when JSON is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('should return 404 when repository is not found', async () => {
      mocks.mockContainerManager.createSession.mockRejectedValue(
        new RepositoryNotFoundError('non-existent-repo')
      );

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repositoryId: 'non-existent-repo',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Repository not found');
    });

    it('should return 500 when Docker is not running', async () => {
      mocks.mockContainerManager.createSession.mockRejectedValue(
        new Error('Docker is not running')
      );

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repositoryId: 'repo-1',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Docker');
    });

    it('should trim whitespace from input values', async () => {
      const mockSession = {
        id: 'new-session-123',
        name: 'trimmed-session',
        containerId: 'container-new',
        volumeName: 'claudework-trimmed-session',
        branch: 'session/trimmed-session',
        parentBranch: 'main',
        worktreePath: null,
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        repositoryId: 'repo-1',
      };

      mocks.mockContainerManager.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: '  trimmed-session  ',
          repositoryId: '  repo-1  ',
          parentBranch: '  main  ',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mocks.mockContainerManager.createSession).toHaveBeenCalledWith({
        name: 'trimmed-session',
        repositoryId: 'repo-1',
        parentBranch: 'main',
      });
    });

    it('should return 400 when name is empty string', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: '   ',
          repositoryId: 'repo-1',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('name');
    });

    it('should return 400 when repositoryId is empty string', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repositoryId: '   ',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('repositoryId');
    });

    it('should return 400 when parentBranch is empty string', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repositoryId: 'repo-1',
          parentBranch: '   ',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parentBranch');
    });

    it('should return 500 on unexpected server error', async () => {
      mocks.mockContainerManager.createSession.mockRejectedValue(
        new Error('Unexpected error')
      );

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repositoryId: 'repo-1',
          parentBranch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
