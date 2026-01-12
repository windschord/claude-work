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
        sourceType: 'remote',
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

  describe('createSession with localPath', () => {
    it('should create a session with local directory mount instead of volume', async () => {
      const options = {
        name: 'local-session',
        localPath: '/home/user/projects/my-project',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-local-123',
        name: 'local-session',
        containerId: null,
        volumeName: 'claudework-local-session',
        repoUrl: null,
        localPath: '/home/user/projects/my-project',
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        id: 'container-local-abc123',
      };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-local-session' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-local-abc123',
        status: 'running',
      });

      const result = await containerManager.createSession(options);

      // Verify session was created with localPath instead of repoUrl
      expect(mocks.mockSessionManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'local',
          name: 'local-session',
          localPath: '/home/user/projects/my-project',
          branch: 'main',
        })
      );

      expect(result.name).toBe('local-session');
    });

    it('should configure bind mount for local path instead of volume mount', async () => {
      const options = {
        name: 'bind-mount-test',
        localPath: '/home/user/projects/my-project',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-bind-456',
        name: 'bind-mount-test',
        containerId: null,
        volumeName: 'claudework-bind-mount-test',
        repoUrl: null,
        localPath: '/home/user/projects/my-project',
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-bind' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-bind-mount-test' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-bind',
        status: 'running',
      });

      await containerManager.createSession(options);

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      // Verify bind mount is configured for local path
      expect(createContainerCall.mounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: '/home/user/projects/my-project',
            target: '/workspace',
            readOnly: false,
          }),
        ])
      );

      // Verify no volume is used for workspace
      expect(createContainerCall.volumes).toBeUndefined();
    });

    it('should not set REPO_URL environment variable for local path sessions', async () => {
      const options = {
        name: 'no-repo-url-test',
        localPath: '/home/user/projects/my-project',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-no-repo',
        name: 'no-repo-url-test',
        containerId: null,
        volumeName: 'claudework-no-repo-url-test',
        repoUrl: null,
        localPath: '/home/user/projects/my-project',
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-no-repo' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-no-repo-url-test' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-no-repo',
        status: 'running',
      });

      await containerManager.createSession(options);

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      // Verify REPO_URL is not set (git clone will be skipped)
      expect(createContainerCall.env.REPO_URL).toBeUndefined();
      // Verify BRANCH is still set
      expect(createContainerCall.env.BRANCH).toBe('main');
    });

    it('should not create volume when using local path', async () => {
      const options = {
        name: 'no-volume-test',
        localPath: '/home/user/projects/my-project',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-no-volume',
        name: 'no-volume-test',
        containerId: null,
        volumeName: 'claudework-no-volume-test',
        repoUrl: null,
        localPath: '/home/user/projects/my-project',
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-no-volume' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-no-volume',
        status: 'running',
      });

      await containerManager.createSession(options);

      // Verify createVolume is NOT called for local path sessions
      expect(mocks.mockDockerService.createVolume).not.toHaveBeenCalled();
    });

    it('should still work with repoUrl (existing behavior)', async () => {
      const options = {
        name: 'repo-url-test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
      };

      const mockSession = {
        id: 'session-repo',
        name: 'repo-url-test',
        containerId: null,
        volumeName: 'claudework-repo-url-test',
        repoUrl: options.repoUrl,
        localPath: null,
        branch: options.branch,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-repo' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-repo-url-test' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-repo',
        status: 'running',
      });

      await containerManager.createSession(options);

      // Verify volume is created
      expect(mocks.mockDockerService.createVolume).toHaveBeenCalledWith('claudework-repo-url-test');

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      // Verify REPO_URL is set
      expect(createContainerCall.env.REPO_URL).toBe('https://github.com/test/repo.git');

      // Verify volume mount is used
      expect(createContainerCall.volumes).toEqual([
        {
          source: 'claudework-repo-url-test',
          target: '/workspace',
        },
      ]);
    });

    it('should throw error when neither repoUrl nor localPath is provided', async () => {
      const options = {
        name: 'invalid-test',
        branch: 'main',
      };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);

      await expect(containerManager.createSession(options as any)).rejects.toThrow(
        'Either repoUrl or localPath must be provided'
      );
    });

    it('should throw error when both repoUrl and localPath are provided', async () => {
      const options = {
        name: 'conflict-test',
        repoUrl: 'https://github.com/test/repo.git',
        localPath: '/home/user/projects/my-project',
        branch: 'main',
      };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);

      await expect(containerManager.createSession(options as any)).rejects.toThrow(
        'Cannot specify both repoUrl and localPath'
      );
    });
  });
});
