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
  });
});
