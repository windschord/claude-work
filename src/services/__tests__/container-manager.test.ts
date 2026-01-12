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

  const mockRepositoryManager = {
    findById: vi.fn(),
    findAll: vi.fn(),
    register: vi.fn(),
    delete: vi.fn(),
    getBranches: vi.fn(),
  };

  const mockWorktreeService = {
    create: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
  };

  return { mockDockerService, mockSessionManager, mockRepositoryManager, mockWorktreeService };
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

vi.mock('../repository-manager', () => ({
  RepositoryManager: class MockRepositoryManager {
    findById = mocks.mockRepositoryManager.findById;
    findAll = mocks.mockRepositoryManager.findAll;
    register = mocks.mockRepositoryManager.register;
    delete = mocks.mockRepositoryManager.delete;
    getBranches = mocks.mockRepositoryManager.getBranches;
  },
  RepositoryNotFoundError: class RepositoryNotFoundError extends Error {
    constructor(id: string) {
      super(`Repository not found: ${id}`);
      this.name = 'RepositoryNotFoundError';
    }
  },
}));

vi.mock('../worktree-service', () => ({
  WorktreeService: class MockWorktreeService {
    create = mocks.mockWorktreeService.create;
    remove = mocks.mockWorktreeService.remove;
    list = mocks.mockWorktreeService.list;

    static generateWorktreePath(repoName: string, sessionName: string): string {
      return `/home/user/.claudework/worktrees/${repoName}-${sessionName}`;
    }

    static generateBranchName(sessionName: string): string {
      return `session/${sessionName.trim().replace(/\s+/g, '-')}`;
    }
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

  describe('createSession with remote repository', () => {
    it('should create a session with volume and container for remote repository', async () => {
      const options = {
        name: 'test-session',
        repositoryId: 'repo-123',
        parentBranch: 'main',
      };

      const mockRepository = {
        id: 'repo-123',
        name: 'test-repo',
        type: 'remote',
        url: 'https://github.com/test/repo.git',
        path: null,
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        name: 'test-session',
        containerId: null,
        volumeName: 'claudework-test-session',
        repositoryId: 'repo-123',
        branch: 'session/test-session',
        parentBranch: 'main',
        worktreePath: null,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        id: 'container-abc123',
      };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-test-session' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-abc123',
        status: 'running',
        repository: mockRepository,
      });

      const result = await containerManager.createSession(options);

      expect(mocks.mockDockerService.isDockerRunning).toHaveBeenCalled();
      expect(mocks.mockRepositoryManager.findById).toHaveBeenCalledWith('repo-123');
      expect(mocks.mockDockerService.createVolume).toHaveBeenCalledWith('claudework-test-session');
      expect(mocks.mockWorktreeService.create).not.toHaveBeenCalled();
      expect(mocks.mockSessionManager.create).toHaveBeenCalledWith({
        name: 'test-session',
        volumeName: 'claudework-test-session',
        repositoryId: 'repo-123',
        branch: 'session/test-session',
        parentBranch: 'main',
        worktreePath: null,
      });
      expect(mocks.mockDockerService.createContainer).toHaveBeenCalled();
      expect(result.name).toBe('test-session');
    });

    it('should configure mounts correctly for remote repository', async () => {
      const options = {
        name: 'mount-test',
        repositoryId: 'repo-456',
        parentBranch: 'main',
      };

      const mockRepository = {
        id: 'repo-456',
        name: 'mount-repo',
        type: 'remote',
        url: 'https://github.com/test/repo.git',
        path: null,
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-456',
        name: 'mount-test',
        containerId: null,
        volumeName: 'claudework-mount-test',
        repositoryId: 'repo-456',
        branch: 'session/mount-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-mount' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-mount-test' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-mount',
        status: 'running',
        repository: mockRepository,
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

      // Verify volume mount is used for remote
      expect(createContainerCall.volumes).toEqual([
        {
          source: 'claudework-mount-test',
          target: '/workspace',
        },
      ]);
    });

    it('should set REPO_URL and BRANCH environment variables for remote repository', async () => {
      const options = {
        name: 'env-test',
        repositoryId: 'repo-env',
        parentBranch: 'main',
      };

      const mockRepository = {
        id: 'repo-env',
        name: 'env-repo',
        type: 'remote',
        url: 'https://github.com/test/repo.git',
        path: null,
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-env',
        name: 'env-test',
        containerId: null,
        volumeName: 'claudework-env-test',
        repositoryId: 'repo-env',
        branch: 'session/env-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-env' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);
      mocks.mockDockerService.createVolume.mockResolvedValue({ name: 'claudework-env-test' });
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-env',
        status: 'running',
        repository: mockRepository,
      });

      await containerManager.createSession(options);

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      expect(createContainerCall.env.REPO_URL).toBe('https://github.com/test/repo.git');
      expect(createContainerCall.env.BRANCH).toBe('session/env-test');
      expect(createContainerCall.env.PARENT_BRANCH).toBe('main');
    });

    it('should throw error when Docker is not running', async () => {
      mocks.mockDockerService.isDockerRunning.mockResolvedValue(false);

      await expect(
        containerManager.createSession({
          name: 'test',
          repositoryId: 'repo-123',
          parentBranch: 'main',
        })
      ).rejects.toThrow('Docker is not running');
    });

    it('should throw error when repository not found', async () => {
      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(null);

      await expect(
        containerManager.createSession({
          name: 'test',
          repositoryId: 'non-existent',
          parentBranch: 'main',
        })
      ).rejects.toThrow('Repository not found: non-existent');
    });
  });

  describe('createSession with local repository', () => {
    it('should create a session with worktree for local repository', async () => {
      const options = {
        name: 'local-session',
        repositoryId: 'repo-local',
        parentBranch: 'main',
      };

      const mockRepository = {
        id: 'repo-local',
        name: 'local-repo',
        type: 'local',
        url: null,
        path: '/home/user/projects/local-repo',
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-local',
        name: 'local-session',
        containerId: null,
        volumeName: 'claudework-local-session',
        repositoryId: 'repo-local',
        branch: 'session/local-session',
        parentBranch: 'main',
        worktreePath: '/home/user/.claudework/worktrees/local-repo-local-session',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-local' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);
      mocks.mockWorktreeService.create.mockResolvedValue(undefined);
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-local',
        status: 'running',
        repository: mockRepository,
      });

      const result = await containerManager.createSession(options);

      // Verify worktree was created instead of volume
      expect(mocks.mockWorktreeService.create).toHaveBeenCalledWith({
        repoPath: '/home/user/projects/local-repo',
        worktreePath: '/home/user/.claudework/worktrees/local-repo-local-session',
        branch: 'session/local-session',
        parentBranch: 'main',
      });
      expect(mocks.mockDockerService.createVolume).not.toHaveBeenCalled();

      // Verify session was created with worktreePath
      expect(mocks.mockSessionManager.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'local-session',
          worktreePath: '/home/user/.claudework/worktrees/local-repo-local-session',
        })
      );

      expect(result.name).toBe('local-session');
    });

    it('should configure bind mount for worktree instead of volume mount', async () => {
      const options = {
        name: 'bind-mount-test',
        repositoryId: 'repo-bind',
        parentBranch: 'main',
      };

      const mockRepository = {
        id: 'repo-bind',
        name: 'bind-repo',
        type: 'local',
        url: null,
        path: '/home/user/projects/bind-repo',
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-bind',
        name: 'bind-mount-test',
        containerId: null,
        volumeName: 'claudework-bind-mount-test',
        repositoryId: 'repo-bind',
        branch: 'session/bind-mount-test',
        parentBranch: 'main',
        worktreePath: '/home/user/.claudework/worktrees/bind-repo-bind-mount-test',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-bind' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);
      mocks.mockWorktreeService.create.mockResolvedValue(undefined);
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-bind',
        status: 'running',
        repository: mockRepository,
      });

      await containerManager.createSession(options);

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      // Verify bind mount is configured for worktree path
      expect(createContainerCall.mounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: '/home/user/.claudework/worktrees/bind-repo-bind-mount-test',
            target: '/workspace',
            readOnly: false,
          }),
        ])
      );

      // Verify no volume is used for workspace
      expect(createContainerCall.volumes).toBeUndefined();
    });

    it('should not set REPO_URL environment variable for local repository', async () => {
      const options = {
        name: 'no-url-test',
        repositoryId: 'repo-no-url',
        parentBranch: 'main',
      };

      const mockRepository = {
        id: 'repo-no-url',
        name: 'no-url-repo',
        type: 'local',
        url: null,
        path: '/home/user/projects/no-url-repo',
        defaultBranch: 'main',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-no-url',
        name: 'no-url-test',
        containerId: null,
        volumeName: 'claudework-no-url-test',
        repositoryId: 'repo-no-url',
        branch: 'session/no-url-test',
        parentBranch: 'main',
        worktreePath: '/home/user/.claudework/worktrees/no-url-repo-no-url-test',
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = { id: 'container-no-url' };

      mocks.mockDockerService.isDockerRunning.mockResolvedValue(true);
      mocks.mockRepositoryManager.findById.mockResolvedValue(mockRepository);
      mocks.mockWorktreeService.create.mockResolvedValue(undefined);
      mocks.mockDockerService.createContainer.mockResolvedValue(mockContainer);
      mocks.mockDockerService.startContainer.mockResolvedValue(undefined);
      mocks.mockSessionManager.create.mockResolvedValue(mockSession);
      mocks.mockSessionManager.updateContainerId.mockResolvedValue(undefined);
      mocks.mockSessionManager.updateStatus.mockResolvedValue(undefined);
      mocks.mockSessionManager.findById.mockResolvedValue({
        ...mockSession,
        containerId: 'container-no-url',
        status: 'running',
        repository: mockRepository,
      });

      await containerManager.createSession(options);

      const createContainerCall = mocks.mockDockerService.createContainer.mock.calls[0][0];

      // Verify REPO_URL is not set (git clone will be skipped)
      expect(createContainerCall.env.REPO_URL).toBeUndefined();
      // Verify BRANCH and PARENT_BRANCH are still set
      expect(createContainerCall.env.BRANCH).toBe('session/no-url-test');
      expect(createContainerCall.env.PARENT_BRANCH).toBe('main');
    });
  });

  describe('startSession', () => {
    it('should start a stopped container', async () => {
      const mockSession = {
        id: 'session-789',
        name: 'start-test',
        containerId: 'container-xyz',
        volumeName: 'claudework-start-test',
        repositoryId: 'repo-789',
        branch: 'session/start-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-789',
          name: 'start-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
        repositoryId: 'repo-no-container',
        branch: 'session/no-container',
        parentBranch: 'main',
        worktreePath: null,
        status: 'creating',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-no-container',
          name: 'no-container-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
        repositoryId: 'repo-stop',
        branch: 'session/stop-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-stop',
          name: 'stop-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
    it('should delete container, volume, and session record for remote repository', async () => {
      const mockSession = {
        id: 'session-delete',
        name: 'delete-test',
        containerId: 'container-delete',
        volumeName: 'claudework-delete-test',
        repositoryId: 'repo-delete',
        branch: 'session/delete-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-delete',
          name: 'delete-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.removeContainer.mockResolvedValue(undefined);
      mocks.mockDockerService.removeVolume.mockResolvedValue(undefined);
      mocks.mockSessionManager.delete.mockResolvedValue(undefined);

      await containerManager.deleteSession('session-delete');

      expect(mocks.mockDockerService.removeContainer).toHaveBeenCalledWith('container-delete', true);
      expect(mocks.mockDockerService.removeVolume).toHaveBeenCalledWith('claudework-delete-test');
      expect(mocks.mockWorktreeService.remove).not.toHaveBeenCalled();
      expect(mocks.mockSessionManager.delete).toHaveBeenCalledWith('session-delete');
    });

    it('should delete container, worktree, and session record for local repository', async () => {
      const mockSession = {
        id: 'session-delete-local',
        name: 'delete-local-test',
        containerId: 'container-delete-local',
        volumeName: 'claudework-delete-local-test',
        repositoryId: 'repo-delete-local',
        branch: 'session/delete-local-test',
        parentBranch: 'main',
        worktreePath: '/home/user/.claudework/worktrees/delete-repo-delete-local-test',
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-delete-local',
          name: 'delete-local-repo',
          type: 'local',
          url: null,
          path: '/home/user/projects/delete-local-repo',
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mocks.mockSessionManager.findById.mockResolvedValue(mockSession);
      mocks.mockDockerService.removeContainer.mockResolvedValue(undefined);
      mocks.mockWorktreeService.remove.mockResolvedValue(undefined);
      mocks.mockSessionManager.delete.mockResolvedValue(undefined);

      await containerManager.deleteSession('session-delete-local');

      expect(mocks.mockDockerService.removeContainer).toHaveBeenCalledWith('container-delete-local', true);
      expect(mocks.mockWorktreeService.remove).toHaveBeenCalledWith(
        '/home/user/.claudework/worktrees/delete-repo-delete-local-test',
        '/home/user/projects/delete-local-repo',
        { force: true }
      );
      // Volume should not be removed for local repository with worktree
      expect(mocks.mockDockerService.removeVolume).not.toHaveBeenCalled();
      expect(mocks.mockSessionManager.delete).toHaveBeenCalledWith('session-delete-local');
    });

    it('should skip container removal if no container ID', async () => {
      const mockSession = {
        id: 'session-no-container',
        name: 'no-container-delete',
        containerId: null,
        volumeName: 'claudework-no-container-delete',
        repositoryId: 'repo-no-container',
        branch: 'session/no-container-delete',
        parentBranch: 'main',
        worktreePath: null,
        status: 'error',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-no-container',
          name: 'no-container-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
        repositoryId: 'repo-status',
        branch: 'session/status-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-status',
          name: 'status-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
        repositoryId: 'repo-stopped-status',
        branch: 'session/stopped-status-test',
        parentBranch: 'main',
        worktreePath: null,
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
        repository: {
          id: 'repo-stopped-status',
          name: 'stopped-status-repo',
          type: 'remote',
          url: 'https://github.com/test/repo.git',
          path: null,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
          repositoryId: 'repo-1',
          branch: 'session/session-1',
          parentBranch: 'main',
          worktreePath: null,
          status: 'running',
          createdAt: new Date(),
          updatedAt: new Date(),
          repository: {
            id: 'repo-1',
            name: 'repo-1',
            type: 'remote',
            url: 'https://github.com/test/repo1.git',
            path: null,
            defaultBranch: 'main',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'session-2',
          name: 'session-2',
          containerId: 'container-2',
          volumeName: 'claudework-session-2',
          repositoryId: 'repo-2',
          branch: 'session/session-2',
          parentBranch: 'develop',
          worktreePath: '/home/user/.claudework/worktrees/repo-2-session-2',
          status: 'stopped',
          createdAt: new Date(),
          updatedAt: new Date(),
          repository: {
            id: 'repo-2',
            name: 'repo-2',
            type: 'local',
            url: null,
            path: '/home/user/projects/repo-2',
            defaultBranch: 'main',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mocks.mockSessionManager.findAll.mockResolvedValue(mockSessions);

      const sessions = await containerManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(mocks.mockSessionManager.findAll).toHaveBeenCalled();
    });
  });
});
