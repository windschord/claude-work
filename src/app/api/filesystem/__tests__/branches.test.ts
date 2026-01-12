import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted for proper mock hoisting
const mocks = vi.hoisted(() => {
  const mockFilesystemService = {
    listDirectory: vi.fn(),
    getParentPath: vi.fn(),
    isPathAllowed: vi.fn(),
    validatePath: vi.fn(),
    isGitRepository: vi.fn(),
    getGitBranches: vi.fn(),
    getCurrentBranch: vi.fn(),
  };

  return { mockFilesystemService };
});

vi.mock('@/services/filesystem-service', () => ({
  FilesystemService: class MockFilesystemService {
    listDirectory = mocks.mockFilesystemService.listDirectory;
    getParentPath = mocks.mockFilesystemService.getParentPath;
    isPathAllowed = mocks.mockFilesystemService.isPathAllowed;
    validatePath = mocks.mockFilesystemService.validatePath;
    isGitRepository = mocks.mockFilesystemService.isGitRepository;
    getGitBranches = mocks.mockFilesystemService.getGitBranches;
    getCurrentBranch = mocks.mockFilesystemService.getCurrentBranch;
  },
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AccessDeniedError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

import { GET } from '../branches/route';
import { AccessDeniedError } from '@/services/filesystem-service';

describe('Filesystem Branches API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/filesystem/branches', () => {
    it('should return branches for valid git repository', async () => {
      const mockBranches = ['main', 'develop', 'feature/new-feature'];

      mocks.mockFilesystemService.getGitBranches.mockResolvedValue(mockBranches);
      mocks.mockFilesystemService.getCurrentBranch.mockResolvedValue('main');

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/branches?path=/home/user/projects/myapp'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.branches).toEqual(mockBranches);
      expect(data.currentBranch).toBe('main');
      expect(mocks.mockFilesystemService.getGitBranches).toHaveBeenCalledWith(
        '/home/user/projects/myapp'
      );
      expect(mocks.mockFilesystemService.getCurrentBranch).toHaveBeenCalledWith(
        '/home/user/projects/myapp'
      );
    });

    it('should return 400 when path is not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/filesystem/branches');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('path');
    });

    it('should return 400 when path is not a git repository', async () => {
      mocks.mockFilesystemService.getGitBranches.mockRejectedValue(
        new Error('Not a git repository')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/branches?path=/home/user/not-a-repo'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('git repository');
    });

    it('should return 403 when access is denied', async () => {
      mocks.mockFilesystemService.getGitBranches.mockRejectedValue(
        new AccessDeniedError('Access denied: path outside home directory')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/branches?path=/etc/secret-repo'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Access denied');
    });

    it('should return 500 when unexpected error occurs', async () => {
      mocks.mockFilesystemService.getGitBranches.mockRejectedValue(
        new Error('Unexpected git error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/branches?path=/home/user/projects/myapp'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle detached HEAD state', async () => {
      const mockBranches = ['main', 'develop'];

      mocks.mockFilesystemService.getGitBranches.mockResolvedValue(mockBranches);
      mocks.mockFilesystemService.getCurrentBranch.mockResolvedValue('HEAD');

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/branches?path=/home/user/projects/myapp'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.branches).toEqual(mockBranches);
      expect(data.currentBranch).toBe('HEAD');
    });

    it('should handle empty branch list', async () => {
      mocks.mockFilesystemService.getGitBranches.mockResolvedValue([]);
      mocks.mockFilesystemService.getCurrentBranch.mockResolvedValue('main');

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/branches?path=/home/user/projects/new-repo'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.branches).toEqual([]);
      expect(data.currentBranch).toBe('main');
    });
  });
});
