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

import { GET } from '../browse/route';
import { AccessDeniedError, NotFoundError } from '@/services/filesystem-service';

describe('Filesystem Browse API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/filesystem/browse', () => {
    it('should return directory contents for valid path', async () => {
      const mockEntries = [
        {
          name: 'project1',
          path: '/home/user/projects/project1',
          type: 'directory' as const,
          isGitRepository: true,
          isHidden: false,
        },
        {
          name: 'project2',
          path: '/home/user/projects/project2',
          type: 'directory' as const,
          isGitRepository: false,
          isHidden: false,
        },
        {
          name: 'file.txt',
          path: '/home/user/projects/file.txt',
          type: 'file' as const,
          isGitRepository: false,
          isHidden: false,
        },
      ];

      mocks.mockFilesystemService.listDirectory.mockResolvedValue(mockEntries);
      mocks.mockFilesystemService.getParentPath.mockReturnValue('/home/user');

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/browse?path=/home/user/projects'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.currentPath).toBe('/home/user/projects');
      expect(data.parentPath).toBe('/home/user');
      expect(data.entries).toHaveLength(3);
      expect(data.entries[0].name).toBe('project1');
      expect(mocks.mockFilesystemService.listDirectory).toHaveBeenCalledWith('/home/user/projects');
    });

    it('should use home directory when path is not provided', async () => {
      const mockEntries = [
        {
          name: 'Documents',
          path: '/home/user/Documents',
          type: 'directory' as const,
          isGitRepository: false,
          isHidden: false,
        },
      ];

      mocks.mockFilesystemService.listDirectory.mockResolvedValue(mockEntries);
      mocks.mockFilesystemService.getParentPath.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/filesystem/browse');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.parentPath).toBeNull();
      expect(data.entries).toHaveLength(1);
      // listDirectory should be called without arguments (uses default home directory)
      expect(mocks.mockFilesystemService.listDirectory).toHaveBeenCalledWith(undefined);
    });

    it('should return 403 when access is denied', async () => {
      mocks.mockFilesystemService.listDirectory.mockRejectedValue(
        new AccessDeniedError('Access denied: path outside home directory')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/browse?path=/etc/passwd'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Access denied');
    });

    it('should return 404 when directory is not found', async () => {
      mocks.mockFilesystemService.listDirectory.mockRejectedValue(
        new NotFoundError('Directory not found: /home/user/nonexistent')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/browse?path=/home/user/nonexistent'
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should return 400 when path contains null bytes', async () => {
      mocks.mockFilesystemService.listDirectory.mockRejectedValue(
        new Error('Invalid path: null byte detected')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/browse?path=/home/user/test\x00evil'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid path');
    });

    it('should return 400 when path is too long', async () => {
      const longPath = '/home/user/' + 'a'.repeat(5000);
      mocks.mockFilesystemService.listDirectory.mockRejectedValue(
        new Error('Invalid path: path too long')
      );

      const request = new NextRequest(
        `http://localhost:3000/api/filesystem/browse?path=${encodeURIComponent(longPath)}`
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid path');
    });

    it('should return 500 when unexpected error occurs', async () => {
      mocks.mockFilesystemService.listDirectory.mockRejectedValue(
        new Error('Unexpected filesystem error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/filesystem/browse?path=/home/user'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});
