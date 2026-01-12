import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

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

import { GET } from '../route';
import { RepositoryNotFoundError } from '@/services/repository-manager';

describe('Repositories [id] Branches API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/repositories/:id/branches', () => {
    it('should return branches for a repository', async () => {
      const mockBranchInfo = {
        branches: ['main', 'develop', 'feature/xxx'],
        defaultBranch: 'main',
      };

      mocks.mockRepositoryManager.getBranches.mockResolvedValue(mockBranchInfo);

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123/branches');
      const response = await GET(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.branches).toEqual(['main', 'develop', 'feature/xxx']);
      expect(data.defaultBranch).toBe('main');
      expect(mocks.mockRepositoryManager.getBranches).toHaveBeenCalledWith('uuid-123');
    });

    it('should return empty branches array when repository has no branches', async () => {
      const mockBranchInfo = {
        branches: [],
        defaultBranch: 'main',
      };

      mocks.mockRepositoryManager.getBranches.mockResolvedValue(mockBranchInfo);

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123/branches');
      const response = await GET(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.branches).toEqual([]);
      expect(data.defaultBranch).toBe('main');
    });

    it('should return 404 when repository not found', async () => {
      mocks.mockRepositoryManager.getBranches.mockRejectedValue(
        new RepositoryNotFoundError('non-existent')
      );

      const request = new NextRequest('http://localhost:3000/api/repositories/non-existent/branches');
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Repository not found');
    });

    it('should return 500 on server error', async () => {
      mocks.mockRepositoryManager.getBranches.mockRejectedValue(new Error('Git command failed'));

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123/branches');
      const response = await GET(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should handle branches with special characters', async () => {
      const mockBranchInfo = {
        branches: ['main', 'feature/add-login', 'bugfix/fix-123', 'release/v1.0.0'],
        defaultBranch: 'main',
      };

      mocks.mockRepositoryManager.getBranches.mockResolvedValue(mockBranchInfo);

      const request = new NextRequest('http://localhost:3000/api/repositories/uuid-123/branches');
      const response = await GET(request, { params: Promise.resolve({ id: 'uuid-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.branches).toEqual(['main', 'feature/add-login', 'bugfix/fix-123', 'release/v1.0.0']);
    });
  });
});
