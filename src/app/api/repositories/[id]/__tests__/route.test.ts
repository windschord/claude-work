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
  RepositoryNotFoundError: class RepositoryNotFoundError extends Error {
    constructor(id: string) {
      super(`Repository not found: ${id}`);
      this.name = 'RepositoryNotFoundError';
    }
  },
  RepositoryHasSessionsError: class RepositoryHasSessionsError extends Error {
    constructor(sessionCount: number) {
      super(`Cannot delete repository with ${sessionCount} active sessions`);
      this.name = 'RepositoryHasSessionsError';
    }
  },
}));

import { GET, DELETE } from '../route';
import { RepositoryNotFoundError, RepositoryHasSessionsError } from '@/services/repository-manager';

describe('Repositories [id] API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/repositories/:id', () => {
    it('should return repository by id', async () => {
      const mockRepository: Repository = {
        id: 'uuid-123',
        name: 'my-project',
        type: 'local',
        path: '/home/user/projects/my-project',
        url: null,
        defaultBranch: 'main',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('uuid-123');
      expect(data.name).toBe('my-project');
      expect(data.type).toBe('local');
      expect(data.path).toBe('/home/user/projects/my-project');
      expect(data.defaultBranch).toBe('main');
      expect(mocks.mockRepositoryManager.findById).toHaveBeenCalledWith('uuid-123');
    });

    it('should return 404 when repository not found', async () => {
      mocks.mockRepositoryManager.findById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/repositories/non-existent');
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Repository not found');
    });

    it('should return 500 on server error', async () => {
      mocks.mockRepositoryManager.findById.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/repositories/:id', () => {
    it('should delete repository by id', async () => {
      mocks.mockRepositoryManager.delete.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(204);
      expect(mocks.mockRepositoryManager.delete).toHaveBeenCalledWith('uuid-123');
    });

    it('should return 404 when repository not found', async () => {
      mocks.mockRepositoryManager.delete.mockRejectedValue(
        new RepositoryNotFoundError('non-existent')
      );

      const request = new NextRequest('http://localhost:3000/api/repositories/non-existent', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Repository not found');
    });

    it('should return 409 when repository has active sessions', async () => {
      mocks.mockRepositoryManager.delete.mockRejectedValue(
        new RepositoryHasSessionsError(3)
      );

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('active sessions');
    });

    it('should return 500 on server error', async () => {
      mocks.mockRepositoryManager.delete.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
