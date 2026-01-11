import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const mockSessionManager = {
    findById: vi.fn(),
  };

  const mockDockerService = {
    execCommand: vi.fn(),
  };

  return { mockSessionManager, mockDockerService };
});

vi.mock('@/services/session-manager', () => ({
  SessionManager: class MockSessionManager {
    findById = mocks.mockSessionManager.findById;
  },
}));

vi.mock('@/services/docker-service', () => ({
  DockerService: class MockDockerService {
    execCommand = mocks.mockDockerService.execCommand;
  },
}));

import { GET } from '../route';

describe('GET /api/sessions/:id/warning', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return warning when there are uncommitted changes', async () => {
    const mockSession = {
      id: 'session-warning',
      name: 'warning-session',
      containerId: 'container-warning',
      volumeName: 'claudework-warning-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
    // git status --porcelain returns output when there are changes
    mocks.mockDockerService.execCommand
      .mockResolvedValueOnce({ exitCode: 0, output: 'M  file.txt' }) // git status
      .mockResolvedValueOnce({ exitCode: 0, output: '' }) // git rev-parse --verify origin/main (branch exists)
      .mockResolvedValueOnce({ exitCode: 0, output: '2' }); // git rev-list --count

    const request = new NextRequest('http://localhost:3000/api/sessions/session-warning/warning');
    const response = await GET(request, { params: Promise.resolve({ id: 'session-warning' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.warning.hasUncommittedChanges).toBe(true);
    expect(data.warning.unpushedCommitCount).toBe(2);
  });

  it('should return no warning when repository is clean and pushed', async () => {
    const mockSession = {
      id: 'session-clean',
      name: 'clean-session',
      containerId: 'container-clean',
      volumeName: 'claudework-clean-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
    // git status --porcelain returns empty when clean
    mocks.mockDockerService.execCommand
      .mockResolvedValueOnce({ exitCode: 0, output: '' }) // git status
      .mockResolvedValueOnce({ exitCode: 0, output: '' }) // git rev-parse --verify origin/main (branch exists)
      .mockResolvedValueOnce({ exitCode: 0, output: '0' }); // git rev-list --count

    const request = new NextRequest('http://localhost:3000/api/sessions/session-clean/warning');
    const response = await GET(request, { params: Promise.resolve({ id: 'session-clean' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.warning.hasUncommittedChanges).toBe(false);
    expect(data.warning.unpushedCommitCount).toBe(0);
  });

  it('should return 404 when session not found', async () => {
    mocks.mockSessionManager.findById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/warning');
    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Session not found');
  });

  it('should return 400 when container is not running', async () => {
    const mockSession = {
      id: 'session-no-container',
      name: 'no-container-session',
      containerId: null,
      volumeName: 'claudework-no-container-session',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      status: 'creating',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-no-container/warning');
    const response = await GET(request, { params: Promise.resolve({ id: 'session-no-container' }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Container');
  });
});
