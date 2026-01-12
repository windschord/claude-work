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

  const mockFilesystemService = {
    isPathAllowed: vi.fn(),
    isGitRepository: vi.fn(),
  };

  return { mockContainerManager, mockFilesystemService };
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

vi.mock('@/services/filesystem-service', () => ({
  FilesystemService: class MockFilesystemService {
    isPathAllowed = mocks.mockFilesystemService.isPathAllowed;
    isGitRepository = mocks.mockFilesystemService.isGitRepository;
  },
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AccessDeniedError';
    }
  },
}));

import { GET, POST } from '../route';

describe('Sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/sessions', () => {
    it('should return all sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'test-session-1',
          containerId: 'container-1',
          volumeName: 'claudework-session-1',
          repoUrl: 'https://github.com/test/repo1.git',
          branch: 'main',
          status: 'running',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'session-2',
          name: 'test-session-2',
          containerId: 'container-2',
          volumeName: 'claudework-session-2',
          repoUrl: 'https://github.com/test/repo2.git',
          branch: 'develop',
          status: 'stopped',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mocks.mockContainerManager.listSessions.mockResolvedValue(mockSessions);

      const request = new NextRequest('http://localhost:3000/api/sessions');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0].name).toBe('test-session-1');
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
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const mockSession = {
        id: 'new-session-123',
        name: 'new-session',
        containerId: 'container-new',
        volumeName: 'claudework-new-session',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mocks.mockContainerManager.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'new-session',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.session.id).toBe('new-session-123');
      expect(data.session.name).toBe('new-session');
      expect(mocks.mockContainerManager.createSession).toHaveBeenCalledWith({
        name: 'new-session',
        sourceType: 'remote',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      });
    });

    it('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('name');
    });

    it('should return 400 when repoUrl is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          branch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('repoUrl');
    });

    it('should return 400 when branch is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repoUrl: 'https://github.com/test/repo.git',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('branch');
    });

    it('should return 400 when JSON is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 500 when Docker is not running', async () => {
      mocks.mockContainerManager.createSession.mockRejectedValue(
        new Error('Docker is not running')
      );

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Docker');
    });

    it('should create a new session with explicit sourceType remote', async () => {
      const mockSession = {
        id: 'session-remote',
        name: 'remote-session',
        containerId: 'container-remote',
        volumeName: 'claudework-remote-session',
        sourceType: 'remote',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        localPath: null,
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mocks.mockContainerManager.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'remote-session',
          sourceType: 'remote',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.session.id).toBe('session-remote');
      expect(mocks.mockContainerManager.createSession).toHaveBeenCalledWith({
        name: 'remote-session',
        sourceType: 'remote',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      });
    });

    it('should create a new session with local repository', async () => {
      const mockSession = {
        id: 'session-local',
        name: 'local-session',
        containerId: 'container-local',
        volumeName: 'claudework-local-session',
        sourceType: 'local',
        repoUrl: '',
        branch: '',
        localPath: '/home/user/projects/my-repo',
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mocks.mockFilesystemService.isPathAllowed.mockReturnValue(true);
      mocks.mockFilesystemService.isGitRepository.mockResolvedValue(true);
      mocks.mockContainerManager.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'local-session',
          sourceType: 'local',
          localPath: '/home/user/projects/my-repo',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.session.id).toBe('session-local');
      expect(data.session.sourceType).toBe('local');
      expect(mocks.mockFilesystemService.isPathAllowed).toHaveBeenCalledWith('/home/user/projects/my-repo');
      expect(mocks.mockFilesystemService.isGitRepository).toHaveBeenCalledWith('/home/user/projects/my-repo');
      expect(mocks.mockContainerManager.createSession).toHaveBeenCalledWith({
        name: 'local-session',
        sourceType: 'local',
        localPath: '/home/user/projects/my-repo',
      });
    });

    it('should return 400 when local path does not exist', async () => {
      mocks.mockFilesystemService.isPathAllowed.mockReturnValue(true);
      mocks.mockFilesystemService.isGitRepository.mockRejectedValue(new Error('ENOENT'));

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'local-session',
          sourceType: 'local',
          localPath: '/home/user/projects/nonexistent',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('does not exist');
    });

    it('should return 400 when local path is not a git repository', async () => {
      mocks.mockFilesystemService.isPathAllowed.mockReturnValue(true);
      mocks.mockFilesystemService.isGitRepository.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'local-session',
          sourceType: 'local',
          localPath: '/home/user/projects/not-a-repo',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('not a git repository');
    });

    it('should return 400 when local path is outside home directory', async () => {
      mocks.mockFilesystemService.isPathAllowed.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'local-session',
          sourceType: 'local',
          localPath: '/etc/passwd',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Access denied');
    });

    it('should return 400 when sourceType is local but localPath is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'local-session',
          sourceType: 'local',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('localPath');
    });

    it('should return 400 when sourceType is remote but repoUrl is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'remote-session',
          sourceType: 'remote',
          branch: 'main',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('repoUrl');
    });

    it('should return 400 when sourceType is remote but branch is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'remote-session',
          sourceType: 'remote',
          repoUrl: 'https://github.com/test/repo.git',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('branch');
    });

    it('should return 400 when sourceType is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-session',
          sourceType: 'invalid',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('sourceType');
    });
  });
});
