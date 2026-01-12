import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const mockSessionManager = {
    findById: vi.fn(),
  };

  const mockContainerManager = {
    stopSession: vi.fn(),
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
    stopSession = mocks.mockContainerManager.stopSession;
  },
}));

import { POST } from '../route';

describe('POST /api/sessions/:id/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should stop a running session', async () => {
    const mockSession = {
      id: 'session-stop',
      name: 'stop-session',
      containerId: 'container-stop',
      volumeName: 'claudework-stop-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
    mocks.mockContainerManager.stopSession.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-stop/stop', {
      method: 'POST',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'session-stop' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Session stopped');
    expect(mocks.mockContainerManager.stopSession).toHaveBeenCalledWith('session-stop');
  });

  it('should return 404 when session not found', async () => {
    mocks.mockSessionManager.findById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/stop', {
      method: 'POST',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Session not found');
  });
});
