import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const mockSessionManager = {
    findById: vi.fn(),
  };

  const mockContainerManager = {
    startSession: vi.fn(),
  };

  return { mockSessionManager, mockContainerManager };
});

vi.mock('@/services/session-manager', () => ({
  SessionManager: class MockSessionManager {
    findById = mocks.mockSessionManager.findById;
  },
}));

vi.mock('@/services/container-manager', () => ({
  ContainerManager: class MockContainerManager {
    startSession = mocks.mockContainerManager.startSession;
  },
}));

import { POST } from '../route';

describe('POST /api/sessions/:id/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start a stopped session', async () => {
    const mockSession = {
      id: 'session-start',
      name: 'start-session',
      containerId: 'container-start',
      volumeName: 'claudework-start-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'stopped',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
    mocks.mockContainerManager.startSession.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-start/start', {
      method: 'POST',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'session-start' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Session started');
    expect(mocks.mockContainerManager.startSession).toHaveBeenCalledWith('session-start');
  });

  it('should return 404 when session not found', async () => {
    mocks.mockSessionManager.findById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/start', {
      method: 'POST',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Session not found');
  });
});
