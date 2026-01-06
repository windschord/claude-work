import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available during hoisting
const mocks = vi.hoisted(() => {
  const mockContainerStart = vi.fn().mockResolvedValue(undefined);
  const mockContainerStop = vi.fn().mockResolvedValue(undefined);
  const mockContainerRemove = vi.fn().mockResolvedValue(undefined);
  const mockContainerInspect = vi.fn().mockResolvedValue({
    State: { Status: 'running', Running: true }
  });
  const mockVolumeRemove = vi.fn().mockResolvedValue(undefined);
  const mockPing = vi.fn().mockResolvedValue('OK');
  const mockCreateContainer = vi.fn();
  const mockGetContainer = vi.fn();
  const mockCreateVolume = vi.fn().mockResolvedValue({ name: 'test-volume' });
  const mockGetVolume = vi.fn();

  return {
    mockContainerStart,
    mockContainerStop,
    mockContainerRemove,
    mockContainerInspect,
    mockVolumeRemove,
    mockPing,
    mockCreateContainer,
    mockGetContainer,
    mockCreateVolume,
    mockGetVolume,
  };
});

vi.mock('dockerode', () => {
  const mockContainer = {
    start: mocks.mockContainerStart,
    stop: mocks.mockContainerStop,
    remove: mocks.mockContainerRemove,
    inspect: mocks.mockContainerInspect,
  };

  const mockVolume = {
    remove: mocks.mockVolumeRemove,
  };

  mocks.mockCreateContainer.mockResolvedValue(mockContainer);
  mocks.mockGetContainer.mockReturnValue(mockContainer);
  mocks.mockGetVolume.mockReturnValue(mockVolume);

  return {
    default: class MockDocker {
      ping = mocks.mockPing;
      createContainer = mocks.mockCreateContainer;
      getContainer = mocks.mockGetContainer;
      createVolume = mocks.mockCreateVolume;
      getVolume = mocks.mockGetVolume;
      listContainers = vi.fn().mockResolvedValue([]);
    },
  };
});

// Import after mock is set up
import { DockerService } from '../docker-service';

describe('DockerService', () => {
  let dockerService: DockerService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the resolved values
    mocks.mockCreateContainer.mockResolvedValue({
      start: mocks.mockContainerStart,
      stop: mocks.mockContainerStop,
      remove: mocks.mockContainerRemove,
      inspect: mocks.mockContainerInspect,
    });
    mocks.mockGetContainer.mockReturnValue({
      start: mocks.mockContainerStart,
      stop: mocks.mockContainerStop,
      remove: mocks.mockContainerRemove,
      inspect: mocks.mockContainerInspect,
    });
    mocks.mockGetVolume.mockReturnValue({
      remove: mocks.mockVolumeRemove,
    });
    dockerService = new DockerService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isDockerRunning', () => {
    it('should return true when Docker is running', async () => {
      mocks.mockPing.mockResolvedValueOnce('OK');
      const result = await dockerService.isDockerRunning();
      expect(result).toBe(true);
    });

    it('should return false when Docker is not running', async () => {
      mocks.mockPing.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await dockerService.isDockerRunning();
      expect(result).toBe(false);
    });
  });

  describe('createContainer', () => {
    it('should create a container with the specified options', async () => {
      const options = {
        image: 'claudework-session:latest',
        name: 'test-container',
        env: { REPO_URL: 'https://github.com/test/repo.git', BRANCH: 'main' },
        volumes: [{ source: 'test-volume', target: '/workspace' }],
        mounts: [
          { source: '/home/user/.claude', target: '/root/.claude', readOnly: true },
        ],
      };

      const container = await dockerService.createContainer(options);
      expect(container).toBeDefined();
      expect(mocks.mockCreateContainer).toHaveBeenCalled();
    });

    it('should pass environment variables correctly', async () => {
      const options = {
        image: 'claudework-session:latest',
        name: 'test-container',
        env: { REPO_URL: 'https://github.com/test/repo.git', BRANCH: 'main' },
        volumes: [],
        mounts: [],
      };

      await dockerService.createContainer(options);

      const callArgs = mocks.mockCreateContainer.mock.calls[0][0];
      expect(callArgs.Env).toContain('REPO_URL=https://github.com/test/repo.git');
      expect(callArgs.Env).toContain('BRANCH=main');
    });
  });

  describe('startContainer', () => {
    it('should start a container by ID', async () => {
      await expect(dockerService.startContainer('test-container-id')).resolves.not.toThrow();
      expect(mocks.mockContainerStart).toHaveBeenCalled();
    });
  });

  describe('stopContainer', () => {
    it('should stop a container by ID', async () => {
      await expect(dockerService.stopContainer('test-container-id')).resolves.not.toThrow();
      expect(mocks.mockContainerStop).toHaveBeenCalled();
    });
  });

  describe('removeContainer', () => {
    it('should remove a container by ID', async () => {
      await expect(dockerService.removeContainer('test-container-id')).resolves.not.toThrow();
      expect(mocks.mockContainerRemove).toHaveBeenCalledWith({ force: false });
    });

    it('should force remove a container when specified', async () => {
      await expect(dockerService.removeContainer('test-container-id', true)).resolves.not.toThrow();
      expect(mocks.mockContainerRemove).toHaveBeenCalledWith({ force: true });
    });
  });

  describe('createVolume', () => {
    it('should create a volume with the specified name', async () => {
      const volume = await dockerService.createVolume('test-volume');
      expect(volume).toBeDefined();
      expect(volume.name).toBe('test-volume');
      expect(mocks.mockCreateVolume).toHaveBeenCalledWith({ Name: 'test-volume' });
    });
  });

  describe('removeVolume', () => {
    it('should remove a volume by name', async () => {
      await expect(dockerService.removeVolume('test-volume')).resolves.not.toThrow();
      expect(mocks.mockVolumeRemove).toHaveBeenCalled();
    });
  });

  describe('getContainerStatus', () => {
    it('should return container status', async () => {
      const status = await dockerService.getContainerStatus('test-container-id');
      expect(status).toBeDefined();
      expect(status.status).toBe('running');
      expect(status.running).toBe(true);
    });
  });
});
