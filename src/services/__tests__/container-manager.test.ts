import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';

// Use vi.hoisted to ensure mocks are available during hoisting
const mocks = vi.hoisted(() => {
  const mockDockerService = {
    isDockerRunning: vi.fn(),
    createVolume: vi.fn(),
    createContainer: vi.fn(),
    startContainer: vi.fn(),
    stopContainer: vi.fn(),
    removeContainer: vi.fn(),
    removeVolume: vi.fn(),
    getContainerStatus: vi.fn(),
    execCommand: vi.fn(),
  };

  const mockSessionManager = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    updateStatus: vi.fn(),
    updateContainerId: vi.fn(),
    delete: vi.fn(),
  };

  return { mockDockerService, mockSessionManager };
});

vi.mock('../docker-service', () => ({
  DockerService: class MockDockerService {
    isDockerRunning = mocks.mockDockerService.isDockerRunning;
    createVolume = mocks.mockDockerService.createVolume;
    createContainer = mocks.mockDockerService.createContainer;
    startContainer = mocks.mockDockerService.startContainer;
    stopContainer = mocks.mockDockerService.stopContainer;
    removeContainer = mocks.mockDockerService.removeContainer;
    removeVolume = mocks.mockDockerService.removeVolume;
    getContainerStatus = mocks.mockDockerService.getContainerStatus;
    execCommand = mocks.mockDockerService.execCommand;
  },
}));

vi.mock('../session-manager', () => ({
  SessionManager: class MockSessionManager {
    create = mocks.mockSessionManager.create;
    findById = mocks.mockSessionManager.findById;
    findAll = mocks.mockSessionManager.findAll;
    updateStatus = mocks.mockSessionManager.updateStatus;
    updateContainerId = mocks.mockSessionManager.updateContainerId;
    delete = mocks.mockSessionManager.delete;
  },
}));

import { ContainerManager } from '../container-manager';

describe('ContainerManager', () => {
  let containerManager: ContainerManager;
  const homeDir = os.homedir();

  beforeEach(() => {
    vi.clearAllMocks();
    containerManager = new ContainerManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with volume and container', async () => {
      const options = {
        name: 'test-session',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-123',
        name: 'test-session',
        containerId: null,
        volumeName: 'claudework-test-session',
        repoUrl: options.repoUrl,
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        id: 'container-abc123',
      };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-test-session' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockDockerService.getContainerStatus.mockResolvedValue({ status: 'running', running: true });
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-abc123',
        status: 'running',
      });

      const result = await containerManager.createSession(options);

      expect(mocks.mockDockerService.isDockerRunning).toHaveBeenCalled();
      expect(mocks.mockDockerService.createVolume).toHaveBeenCalledWith('claudework-test-session');
      expect(mocks.mockSessionManager.create).toHaveBeenCalledWith({
        name: 'test-session',
        volumeName: 'claudework-test-session',
        repoUrl: options.repoUrl,
        branch: options.branch,
      });
      expect(mocks.mockDockerService.createContainer).toHaveBeenCalled();
      expect(result.name).toBe('test-session');
    });

    it('should configure mounts correctly', async () => {
      const options = {
        name: 'mount-test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-456',
        name: 'mount-test',
        containerId: null,
        volumeName: 'claudework-mount-test',
        repoUrl: options.repoUrl,
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-mount' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-mount-test' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockDockerService.getContainerStatus.mockResolvedValue({ status: 'running', running: true });
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-mount',
        status: 'running',
      });

      await containerManager.createSession(options);

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      // Verify mounts are configured
      expect(createContainerCall.mounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: path.join(homeDir, '.claude'),
            target: '/root/.claude',
            readOnly: true,
          }),
          expect.objectContaining({
            source: path.join(homeDir, '.gitconfig'),
            target: '/root/.gitconfig',
            readOnly: true,
          }),
        ])
      );
    });

    it('should throw error when Docker is not running', async () => {
      mocks.mockDockerService.isDockerRunning.mockResolvedValue(false);

      await expect(
        containerManager.createSession({
          name: 'test',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
        })
      ).rejects.toThrow('Docker is not running');
    });
  });

  describe('startSession', () => {
    it('should start a stopped container', async () => {
      const mockSession = {
        id: 'session-789',
        name: 'start-test',
        containerId: 'container-xyz',
        volumeName: 'claudework-start-test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);

      await containerManager.startSession('session-789');

      expect(mocks.mockSessionManager.findById).toHaveBeenCalledWith('session-789');
      expect(mocks.mockDockerService.startContainer).toHaveBeenCalledWith('container-xyz');
      expect(mocks.mockSessionManager.updateStatus).toHaveBeenCalledWith('session-789', 'running');
    });

    it('should throw error when session not found', async () => {
      mocks.mockSessionManager.findById.mockResolvedValue(null);

      await expect(containerManager.startSession('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });

    it('should throw error when container ID is missing', async () => {
      const mockSession = {
        id: 'session-no-container',
        name: 'no-container',
        containerId: null,
        volumeName: 'claudework-no-container',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);

      await expect(containerManager.startSession('session-no-container')).rejects.toThrow(
        'Container not found for session: session-no-container'
      );
    });
  });

  describe('stopSession', () => {
    it('should stop a running container', async () => {
      const mockSession = {
        id: 'session-stop',
        name: 'stop-test',
        containerId: 'container-stop',
        volumeName: 'claudework-stop-test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.stopContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);

      await containerManager.stopSession('session-stop');

      expect(mocks.mockDockerService.stopContainer).toHaveBeenCalledWith('container-stop');
      expect(mocks.mockSessionManager.updateStatus).toHaveBeenCalledWith('session-stop', 'stopped');
    });
  });

  describe('deleteSession', () => {
    it('should delete container, volume, and session record', async () => {
      const mockSession = {
        id: 'session-delete',
        name: 'delete-test',
        containerId: 'container-delete',
        volumeName: 'claudework-delete-test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.removeContainer.mockResolvedValue(undefined);
      mocks.mockDockerService.removeVolume.mockResolvedValue(undefined);
      mocks.mockSessionManager.delete.mockResolvedValue(undefined);

      await containerManager.deleteSession('session-delete');

      expect(mocks.mockDockerService.removeContainer).toHaveBeenCalledWith('container-delete', true);
      expect(mocks.mockDockerService.removeVolume).toHaveBeenCalledWith('claudework-delete-test');
      expect(mocks.mockSessionManager.delete).toHaveBeenCalledWith('session-delete');
    });

    it('should skip container removal if no container ID', async () => {
      const mockSession = {
        id: 'session-no-container',
        name: 'no-container-delete',
        containerId: null,
        volumeName: 'claudework-no-container-delete',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'error',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.removeVolume.mockResolvedValue(undefined);
      mocks.mockSessionManager.delete.mockResolvedValue(undefined);

      await containerManager.deleteSession('session-no-container');

      expect(mocks.mockDockerService.removeContainer).not.toHaveBeenCalled();
      expect(mocks.mockDockerService.removeVolume).toHaveBeenCalledWith('claudework-no-container-delete');
      expect(mocks.mockSessionManager.delete).toHaveBeenCalledWith('session-no-container');
    });
  });

  describe('getSessionStatus', () => {
    it('should return session status from container', async () => {
      const mockSession = {
        id: 'session-status',
        name: 'status-test',
        containerId: 'container-status',
        volumeName: 'claudework-status-test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.getContainerStatus.mockResolvedValue({ status: 'running', running: true });

      const status = await containerManager.getSessionStatus('session-status');

      expect(status).toBe('running');
    });

    it('should return stopped when container is not running', async () => {
      const mockSession = {
        id: 'session-stopped-status',
        name: 'stopped-status-test',
        containerId: 'container-stopped-status',
        volumeName: 'claudework-stopped-status',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.getContainerStatus.mockResolvedValue({ status: 'exited', running: false });

      const status = await containerManager.getSessionStatus('session-stopped-status');

      expect(status).toBe('stopped');
    });
  });

  describe('listSessions', () => {
    it('should return all sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'session-1',
          containerId: 'container-1',
          volumeName: 'claudework-session-1',
          repoUrl: 'https://github.com/test/repo1.git',
          branch: 'main',
          status: 'running',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'session-2',
          name: 'session-2',
          containerId: 'container-2',
          volumeName: 'claudework-session-2',
          repoUrl: 'https://github.com/test/repo2.git',
          branch: 'develop',
          status: 'stopped',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mocks.mockSessionManager.findAll.mockResolvedValue(mockSessions);

      const sessions = await containerManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(mocks.mockSessionManager.findAll).toHaveBeenCalled();
    });
  });
});
