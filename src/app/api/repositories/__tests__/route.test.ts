import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Repository } from '@prisma/client';

// Use vi.hoisted for proper mock hoisting
const mocks = vi.hoisted(() => {
  const mockRepositoryManager = {
    register: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    getBranches: vi.fn(),
  };

  return { mockRepositoryManager };
});

vi.mock('@/services/repository-manager', () => ({
  RepositoryManager: class MockRepositoryManager {
    register = mocks.mockRepositoryManager.register;
    findAll = mocks.mockRepositoryManager.findAll;
    findById = mocks.mockRepositoryManager.findById;
    delete = mocks.mockRepositoryManager.delete;
    getBranches = mocks.mockRepositoryManager.getBranches;
  },
}));

import { GET, POST } from '../route';

describe('Repositories API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/repositories', () => {
    it('should return all repositories with session count', async () => {
      const mockRepositories = [
        {
          id: 'uuid-1',
          name: 'my-project',
          type: 'local',
          path: '/home/user/projects/my-project',
          url: null,
          defaultBranch: 'main',
          sessionCount: 2,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'uuid-2',
          name: 'remote-project',
          type: 'remote',
          path: null,
          url: 'https://github.com/user/remote-project.git',
          defaultBranch: 'main',
          sessionCount: 0,
          createdAt: new Date('2024-01-02T00:00:00Z'),
          updatedAt: new Date('2024-01-02T00:00:00Z'),
        },
      ];

      mocks.mockRepositoryManager.findAll.mockResolvedValue(mockRepositories);

      const request = new NextRequest('http://localhost:3000/api/repositories');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.repositories).toHaveLength(2);
      expect(data.repositories[0]).toMatchObject({
        id: 'uuid-1',
        name: 'my-project',
        type: 'local',
        path: '/home/user/projects/my-project',
        defaultBranch: 'main',
        sessionCount: 2,
      });
      expect(mocks.mockRepositoryManager.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no repositories exist', async () => {
      mocks.mockRepositoryManager.findAll.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/repositories');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.repositories).toEqual([]);
    });

    it('should return 500 on server error', async () => {
      mocks.mockRepositoryManager.findAll.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/repositories');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/repositories', () => {
    describe('local repository', () => {
      it('should register a local repository', async () => {
        const mockRepository: Repository = {
          id: 'uuid-new',
          name: 'my-project',
          type: 'local',
          path: '/home/user/projects/my-project',
          url: null,
          defaultBranch: 'main',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        };

        mocks.mockRepositoryManager.register.mockResolvedValue(mockRepository);

        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'local',
            path: '/home/user/projects/my-project',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.id).toBe('uuid-new');
        expect(data.name).toBe('my-project');
        expect(data.type).toBe('local');
        expect(data.path).toBe('/home/user/projects/my-project');
        expect(data.defaultBranch).toBe('main');
        expect(mocks.mockRepositoryManager.register).toHaveBeenCalledWith({
          name: 'my-project',
          type: 'local',
          path: '/home/user/projects/my-project',
        });
      });

      it('should return 400 when path is missing for local type', async () => {
        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'local',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('path');
      });
    });

    describe('remote repository', () => {
      it('should register a remote repository', async () => {
        const mockRepository: Repository = {
          id: 'uuid-remote',
          name: 'my-project',
          type: 'remote',
          path: null,
          url: 'https://github.com/user/my-project.git',
          defaultBranch: 'main',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        };

        mocks.mockRepositoryManager.register.mockResolvedValue(mockRepository);

        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'remote',
            url: 'https://github.com/user/my-project.git',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.id).toBe('uuid-remote');
        expect(data.name).toBe('my-project');
        expect(data.type).toBe('remote');
        expect(data.url).toBe('https://github.com/user/my-project.git');
        expect(data.defaultBranch).toBe('main');
        expect(mocks.mockRepositoryManager.register).toHaveBeenCalledWith({
          name: 'my-project',
          type: 'remote',
          url: 'https://github.com/user/my-project.git',
        });
      });

      it('should return 400 when url is missing for remote type', async () => {
        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'remote',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('url');
      });
    });

    describe('validation', () => {
      it('should return 400 when name is missing', async () => {
        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            type: 'local',
            path: '/home/user/projects/my-project',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('name');
      });

      it('should return 400 when type is missing', async () => {
        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('type');
      });

      it('should return 400 when type is invalid', async () => {
        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'invalid',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('type');
      });

      it('should return 400 when JSON is invalid', async () => {
        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: 'invalid json',
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBeDefined();
      });

      it('should trim whitespace from name and path', async () => {
        const mockRepository: Repository = {
          id: 'uuid-trimmed',
          name: 'my-project',
          type: 'local',
          path: '/home/user/projects/my-project',
          url: null,
          defaultBranch: 'main',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        };

        mocks.mockRepositoryManager.register.mockResolvedValue(mockRepository);

        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: '  my-project  ',
            type: 'local',
            path: '  /home/user/projects/my-project  ',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(mocks.mockRepositoryManager.register).toHaveBeenCalledWith({
          name: 'my-project',
          type: 'local',
          path: '/home/user/projects/my-project',
        });
      });
    });

    describe('error handling', () => {
      it('should return 400 when path is not a git repository', async () => {
        mocks.mockRepositoryManager.register.mockRejectedValue(
          new Error('Path is not a git repository')
        );

        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'local',
            path: '/home/user/not-a-repo',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('not a git repository');
      });

      it('should return 400 when remote repository is not accessible', async () => {
        mocks.mockRepositoryManager.register.mockRejectedValue(
          new Error('Failed to get default branch from remote repository')
        );

        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'remote',
            url: 'https://github.com/user/invalid-repo.git',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('remote repository');
      });

      it('should return 500 on unexpected server error', async () => {
        mocks.mockRepositoryManager.register.mockRejectedValue(
          new Error('Unexpected database error')
        );

        const request = new NextRequest('http://localhost:3000/api/repositories', {
          method: 'POST',
          body: JSON.stringify({
            name: 'my-project',
            type: 'local',
            path: '/home/user/projects/my-project',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Internal server error');
      });
    });
  });
});
