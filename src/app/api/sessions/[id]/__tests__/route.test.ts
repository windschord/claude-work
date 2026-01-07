import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted for proper mock hoisting
const mocks = vi.hoisted(() => {
  const mockSessionManager = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    updateStatus: vi.fn(),
    updateContainerId: vi.fn(),
    delete: vi.fn(),
  };

  const mockContainerManager = {
    createSession: vi.fn(),
    listSessions: vi.fn(),
    startSession: vi.fn(),
    stopSession: vi.fn(),
    deleteSession: vi.fn(),
    getSessionStatus: vi.fn(),
  };

  const mockPrisma = {
    session: {
      update: vi.fn(),
    },
  };

  return { mockSessionManager, mockContainerManager, mockPrisma };
});

vi.mock('@/services/session-manager', () => ({
  SessionManager: class MockSessionManager {
    create = mocks.mockSessionManager.create;
    findById = mocks.mockSessionManager.findById;
    findAll = mocks.mockSessionManager.findAll;
    updateStatus = mocks.mockSessionManager.updateStatus;
    updateContainerId = mocks.mockSessionManager.updateContainerId;
    delete = mocks.mockSessionManager.delete;
  },
}));

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

vi.mock('@/lib/db', () => ({
  prisma: mocks.mockPrisma,
}));

import { GET, DELETE, PATCH } from '../route';

describe('Sessions [id] API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session by id', async () => {
      const mockSession = {
        id: 'session-123',
        name: 'test-session',
        containerId: 'container-abc',
        volumeName: 'claudework-test-session',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'session-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.session.id).toBe('session-123');
      expect(data.session.name).toBe('test-session');
      expect(mocks.mockSessionManager.findById).toHaveBeenCalledWith('session-123');
    });

    it('should return 404 when session not found', async () => {
      mocks.mockSessionManager.findById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/sessions/non-existent');
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should delete session by id', async () => {
      const mockSession = {
        id: 'session-delete',
        name: 'delete-session',
        containerId: 'container-delete',
        volumeName: 'claudework-delete-session',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockContainerManager.deleteSession.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-delete', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'session-delete' }) });

      expect(response.status).toBe(204);
      expect(mocks.mockContainerManager.deleteSession).toHaveBeenCalledWith('session-delete');
    });

    it('should return 404 when session not found', async () => {
      mocks.mockSessionManager.findById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/sessions/non-existent', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });
  });

  describe('PATCH /api/sessions/:id', () => {
    it('should update session name', async () => {
      const mockSession = {
        id: 'session-patch',
        name: 'original-name',
        containerId: 'container-patch',
        volumeName: 'claudework-patch-session',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSession = {
        ...mockSession,
        name: 'updated-name',
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockPrisma.session.update.mockResolvedValue(updatedSession);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-patch', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'updated-name' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'session-patch' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.session.name).toBe('updated-name');
      expect(mocks.mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-patch' },
        data: { name: 'updated-name' },
      });
    });

    it('should return 400 when name is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/sessions/session-patch', {
        method: 'PATCH',
        body: JSON.stringify({ name: '' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'session-patch' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('should return 404 when session not found', async () => {
      mocks.mockSessionManager.findById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/sessions/non-existent', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'new-name' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });
  });
});
