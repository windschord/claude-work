import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerClient } from '../docker-client';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// Mock dockerode
const { mockDockerConstructor } = vi.hoisted(() => {
  return { mockDockerConstructor: vi.fn() };
});

vi.mock('dockerode', () => {
  return {
    default: mockDockerConstructor
  };
});

describe('DockerClient', () => {
  let dockerClient: DockerClient;
  let mockDockerInstance: any;

  beforeEach(() => {
    DockerClient.resetForTesting();
    
    mockDockerInstance = {
      ping: vi.fn(),
      info: vi.fn(),
      listContainers: vi.fn(),
      getImage: vi.fn().mockReturnValue({ inspect: vi.fn() }),
      getContainer: vi.fn().mockReturnValue({ 
        inspect: vi.fn(),
        stop: vi.fn(),
        remove: vi.fn(),
        kill: vi.fn(),
        exec: vi.fn()
      }),
      createContainer: vi.fn(),
      buildImage: vi.fn(),
      pull: vi.fn(),
      createVolume: vi.fn(),
      getVolume: vi.fn().mockReturnValue({ remove: vi.fn() }),
      run: vi.fn(),
      modem: {
        followProgress: vi.fn((stream, onFinished, _onProgress) => {
          onFinished(null, []);
        })
      }
    };

    mockDockerConstructor.mockImplementation(function(this: any) { return mockDockerInstance; });
    
    dockerClient = DockerClient.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = DockerClient.getInstance();
    const instance2 = DockerClient.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should call ping', async () => {
    mockDockerInstance.ping.mockResolvedValue(Buffer.from('OK'));
    const result = await dockerClient.ping();
    expect(mockDockerInstance.ping).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should handle ping failure', async () => {
    mockDockerInstance.ping.mockRejectedValue(new Error('Connection failed'));
    const result = await dockerClient.ping();
    expect(mockDockerInstance.ping).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should call info', async () => {
    const mockInfo = { ID: '123' };
    mockDockerInstance.info.mockResolvedValue(mockInfo);
    const result = await dockerClient.info();
    expect(mockDockerInstance.info).toHaveBeenCalled();
    expect(result).toEqual(mockInfo);
  });

  it('should inspect image', async () => {
    const mockImage = { inspect: vi.fn().mockResolvedValue({ Id: 'img1' }) };
    mockDockerInstance.getImage.mockReturnValue(mockImage);
    const result = await dockerClient.inspectImage('test-image');
    expect(mockDockerInstance.getImage).toHaveBeenCalledWith('test-image');
    expect(mockImage.inspect).toHaveBeenCalled();
    expect(result).toEqual({ Id: 'img1' });
  });

  it('should inspect container', async () => {
    const mockContainer = { inspect: vi.fn().mockResolvedValue({ Id: 'cont1' }) };
    mockDockerInstance.getContainer.mockReturnValue(mockContainer);
    const result = await dockerClient.inspectContainer('test-container');
    expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container');
    expect(mockContainer.inspect).toHaveBeenCalled();
    expect(result).toEqual({ Id: 'cont1' });
  });

  it('should create volume', async () => {
    mockDockerInstance.createVolume.mockResolvedValue({ Name: 'vol1' });
    const result = await dockerClient.createVolume('vol1');
    expect(mockDockerInstance.createVolume).toHaveBeenCalledWith({ Name: 'vol1' });
    expect(result).toEqual({ Name: 'vol1' });
  });

  it('should remove volume', async () => {
    const mockVolume = { remove: vi.fn().mockResolvedValue({}) };
    mockDockerInstance.getVolume.mockReturnValue(mockVolume);
    await dockerClient.removeVolume('vol1');
    expect(mockDockerInstance.getVolume).toHaveBeenCalledWith('vol1');
    expect(mockVolume.remove).toHaveBeenCalled();
  });

  describe('listVolumes', () => {
    it('Docker Volume一覧を返す', async () => {
      const mockResponse = {
        Volumes: [
          { Name: 'cw-repo-my-project', Driver: 'local', CreatedAt: '2026-01-15T10:30:00Z', Labels: {}, Mountpoint: '/var/lib/docker/volumes/cw-repo-my-project/_data', Scope: 'local' },
          { Name: 'claude-repo-abc123', Driver: 'local', CreatedAt: '2025-12-01T08:00:00Z', Labels: {}, Mountpoint: '/var/lib/docker/volumes/claude-repo-abc123/_data', Scope: 'local' },
        ],
        Warnings: [],
      };
      mockDockerInstance.listVolumes = vi.fn().mockResolvedValue(mockResponse);
      const result = await dockerClient.listVolumes();
      expect(mockDockerInstance.listVolumes).toHaveBeenCalled();
      expect(result.Volumes).toHaveLength(2);
      expect(result.Volumes[0].Name).toBe('cw-repo-my-project');
    });

    it('エラー時に例外をスローする', async () => {
      mockDockerInstance.listVolumes = vi.fn().mockRejectedValue(new Error('Docker error'));
      await expect(dockerClient.listVolumes()).rejects.toThrow('Docker error');
    });
  });

  describe('inspectVolume', () => {
    it('指定Volumeの詳細を返す', async () => {
      const mockInfo = { Name: 'cw-repo-test', Driver: 'local', CreatedAt: '2026-01-15T10:30:00Z', Labels: {}, Mountpoint: '/var/lib/docker/volumes/cw-repo-test/_data', Scope: 'local' };
      const mockVolume = { inspect: vi.fn().mockResolvedValue(mockInfo) };
      mockDockerInstance.getVolume.mockReturnValue(mockVolume);
      const result = await dockerClient.inspectVolume('cw-repo-test');
      expect(mockDockerInstance.getVolume).toHaveBeenCalledWith('cw-repo-test');
      expect(mockVolume.inspect).toHaveBeenCalled();
      expect(result.Name).toBe('cw-repo-test');
    });

    it('存在しないVolumeでエラーをスローする', async () => {
      const mockVolume = { inspect: vi.fn().mockRejectedValue(new Error('No such volume')) };
      mockDockerInstance.getVolume.mockReturnValue(mockVolume);
      await expect(dockerClient.inspectVolume('nonexistent')).rejects.toThrow('No such volume');
    });
  });

  describe('run', () => {
    it('should return StatusCode from array result (Dockerode format)', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      // Dockerode returns [{ StatusCode }, container] array
      mockDockerInstance.run.mockResolvedValue([{ StatusCode: 0 }, { id: 'container-id' }]);

      const result = await dockerClient.run('alpine/git', ['clone', 'url'], stream);
      expect(result).toEqual({ StatusCode: 0 });
      expect(mockDockerInstance.run).toHaveBeenCalledWith(
        'alpine/git', ['clone', 'url'], stream, {}
      );
    });

    it('should return StatusCode from plain object result', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue({ StatusCode: 0 });

      const result = await dockerClient.run('alpine/git', ['clone', 'url'], stream);
      expect(result).toEqual({ StatusCode: 0 });
    });

    it('should throw when result is null', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue(null);

      await expect(dockerClient.run('alpine/git', ['ls'], stream)).rejects.toThrow(
        'Unexpected docker.run() result'
      );
    });

    it('should throw when result lacks StatusCode', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue({ someOther: 'value' });

      await expect(dockerClient.run('alpine/git', ['ls'], stream)).rejects.toThrow(
        'Unexpected docker.run() result'
      );
    });

    it('should throw when StatusCode is not a number', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue({ StatusCode: 'zero' });

      await expect(dockerClient.run('alpine/git', ['ls'], stream)).rejects.toThrow(
        'Unexpected docker.run() result'
      );
    });

    it('should throw when array result first element lacks StatusCode', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue([{ other: 'data' }, { id: 'container' }]);

      await expect(dockerClient.run('alpine/git', ['ls'], stream)).rejects.toThrow(
        'Unexpected docker.run() result'
      );
    });

    it('should pass custom options to docker.run', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue([{ StatusCode: 0 }, { id: 'c1' }]);

      const opts = { HostConfig: { Binds: ['/host:/container'] } } as any;
      await dockerClient.run('alpine', ['ls'], stream, opts);
      expect(mockDockerInstance.run).toHaveBeenCalledWith('alpine', ['ls'], stream, opts);
    });

    it('should return non-zero StatusCode without throwing', async () => {
      const { Writable } = await import('stream');
      const stream = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
      mockDockerInstance.run.mockResolvedValue([{ StatusCode: 128 }, { id: 'c1' }]);

      const result = await dockerClient.run('alpine', ['exit', '128'], stream);
      expect(result.StatusCode).toBe(128);
    });
  });

  describe('getDockerInstance', () => {
    it('should return the Docker instance', () => {
      const instance = dockerClient.getDockerInstance();
      expect(instance).toBe(mockDockerInstance);
    });
  });

  describe('getImage', () => {
    it('should return a Docker image object', () => {
      const mockImage = { inspect: vi.fn() };
      mockDockerInstance.getImage.mockReturnValue(mockImage);
      const result = dockerClient.getImage('test-image');
      expect(mockDockerInstance.getImage).toHaveBeenCalledWith('test-image');
      expect(result).toBe(mockImage);
    });
  });

  describe('getContainer', () => {
    it('should return a Docker container object', () => {
      const mockContainer = { inspect: vi.fn() };
      mockDockerInstance.getContainer.mockReturnValue(mockContainer);
      const result = dockerClient.getContainer('test-container');
      expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container');
      expect(result).toBe(mockContainer);
    });
  });

  describe('getVolume', () => {
    it('should return a Docker volume object', () => {
      const mockVolume = { inspect: vi.fn(), remove: vi.fn() };
      mockDockerInstance.getVolume.mockReturnValue(mockVolume);
      const result = dockerClient.getVolume('test-volume');
      expect(mockDockerInstance.getVolume).toHaveBeenCalledWith('test-volume');
      expect(result).toBe(mockVolume);
    });
  });

  describe('listImages', () => {
    it('should return list of images', async () => {
      const mockImages = [{ Id: 'img1' }, { Id: 'img2' }];
      mockDockerInstance.listImages = vi.fn().mockResolvedValue(mockImages);
      const result = await dockerClient.listImages();
      expect(result).toEqual(mockImages);
    });

    it('should pass options to docker.listImages', async () => {
      mockDockerInstance.listImages = vi.fn().mockResolvedValue([]);
      const opts = { all: true };
      await dockerClient.listImages(opts);
      expect(mockDockerInstance.listImages).toHaveBeenCalledWith(opts);
    });

    it('should throw and log on error', async () => {
      mockDockerInstance.listImages = vi.fn().mockRejectedValue(new Error('list error'));
      await expect(dockerClient.listImages()).rejects.toThrow('list error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list images', { error: expect.any(Error) });
    });
  });

  describe('listContainers', () => {
    it('should return list of containers', async () => {
      const mockContainers = [{ Id: 'c1' }];
      mockDockerInstance.listContainers.mockResolvedValue(mockContainers);
      const result = await dockerClient.listContainers();
      expect(result).toEqual(mockContainers);
    });

    it('should pass options to docker.listContainers', async () => {
      mockDockerInstance.listContainers.mockResolvedValue([]);
      const opts = { all: true };
      await dockerClient.listContainers(opts);
      expect(mockDockerInstance.listContainers).toHaveBeenCalledWith(opts);
    });

    it('should throw and log on error', async () => {
      mockDockerInstance.listContainers.mockRejectedValue(new Error('list error'));
      await expect(dockerClient.listContainers()).rejects.toThrow('list error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list containers', { error: expect.any(Error) });
    });
  });

  describe('createContainer', () => {
    it('should create a container with options', async () => {
      const mockContainer = { id: 'new-container' };
      mockDockerInstance.createContainer.mockResolvedValue(mockContainer);
      const opts = { Image: 'alpine', Cmd: ['ls'] } as any;
      const result = await dockerClient.createContainer(opts);
      expect(result).toBe(mockContainer);
      expect(mockDockerInstance.createContainer).toHaveBeenCalledWith(opts);
    });

    it('should throw and log on error', async () => {
      mockDockerInstance.createContainer.mockRejectedValue(new Error('create error'));
      await expect(dockerClient.createContainer({ Image: 'alpine' } as any)).rejects.toThrow('create error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create container', { error: expect.any(Error) });
    });
  });

  describe('info error handling', () => {
    it('should throw and log on error', async () => {
      mockDockerInstance.info.mockRejectedValue(new Error('info error'));
      await expect(dockerClient.info()).rejects.toThrow('info error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get Docker info', { error: expect.any(Error) });
    });
  });

  describe('inspectImage error handling', () => {
    it('should throw on error without logging', async () => {
      const mockImage = { inspect: vi.fn().mockRejectedValue(new Error('not found')) };
      mockDockerInstance.getImage.mockReturnValue(mockImage);
      await expect(dockerClient.inspectImage('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('inspectContainer error handling', () => {
    it('should throw on error without logging', async () => {
      const mockContainer = { inspect: vi.fn().mockRejectedValue(new Error('not found')) };
      mockDockerInstance.getContainer.mockReturnValue(mockContainer);
      await expect(dockerClient.inspectContainer('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('createVolume error handling', () => {
    it('should throw and log on error', async () => {
      mockDockerInstance.createVolume.mockRejectedValue(new Error('vol error'));
      await expect(dockerClient.createVolume('test-vol')).rejects.toThrow('vol error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create volume: test-vol', { error: expect.any(Error) });
    });
  });

  describe('removeVolume error handling', () => {
    it('should throw and log on error', async () => {
      const mockVolume = { remove: vi.fn().mockRejectedValue(new Error('remove error')) };
      mockDockerInstance.getVolume.mockReturnValue(mockVolume);
      await expect(dockerClient.removeVolume('test-vol')).rejects.toThrow('remove error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to remove volume: test-vol', { error: expect.any(Error) });
    });
  });

  describe('buildImage', () => {
    it('should build image and call onProgress', async () => {
      const { Readable } = await import('stream');
      const inputStream = new Readable({ read() { this.push(null); } });
      const mockBuildStream = {};
      mockDockerInstance.buildImage.mockResolvedValue(mockBuildStream);

      const progressEvents: any[] = [];
      mockDockerInstance.modem.followProgress.mockImplementation(
        (stream: any, onFinished: any, onProgress: any) => {
          onProgress({ stream: 'Step 1' });
          onProgress({ stream: 'Step 2' });
          onFinished(null, []);
        }
      );

      await dockerClient.buildImage(inputStream, { t: 'test-image' }, (event) => {
        progressEvents.push(event);
      });

      expect(mockDockerInstance.buildImage).toHaveBeenCalledWith(inputStream, { t: 'test-image' });
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0]).toEqual({ stream: 'Step 1' });
    });

    it('should build image without onProgress callback', async () => {
      const { Readable } = await import('stream');
      const inputStream = new Readable({ read() { this.push(null); } });
      mockDockerInstance.buildImage.mockResolvedValue({});
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any, onProgress: any) => {
          onProgress({ stream: 'Step 1' });
          onFinished(null, []);
        }
      );

      // Should not throw even without onProgress
      await dockerClient.buildImage(inputStream, { t: 'test-image' });
    });

    it('should throw on build error', async () => {
      const { Readable } = await import('stream');
      const inputStream = new Readable({ read() { this.push(null); } });
      mockDockerInstance.buildImage.mockRejectedValue(new Error('build error'));

      await expect(dockerClient.buildImage(inputStream, { t: 'test-image' })).rejects.toThrow('build error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to build image', { error: expect.any(Error) });
    });

    it('should throw when followProgress reports error', async () => {
      const { Readable } = await import('stream');
      const inputStream = new Readable({ read() { this.push(null); } });
      mockDockerInstance.buildImage.mockResolvedValue({});
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any) => {
          onFinished(new Error('build failed'), []);
        }
      );

      await expect(dockerClient.buildImage(inputStream, { t: 'test-image' })).rejects.toThrow('build failed');
    });

    it('should handle onProgress callback that throws', async () => {
      const { Readable } = await import('stream');
      const inputStream = new Readable({ read() { this.push(null); } });
      mockDockerInstance.buildImage.mockResolvedValue({});
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any, onProgress: any) => {
          onProgress({ stream: 'Step 1' });
          onFinished(null, []);
        }
      );

      // onProgress throws, should be caught and logged
      await dockerClient.buildImage(inputStream, { t: 'test-image' }, () => {
        throw new Error('callback error');
      });

      expect(mockLogger.error).toHaveBeenCalledWith('onProgress callback threw an exception', { callbackError: expect.any(Error) });
    });
  });

  describe('pull', () => {
    it('should pull image and call onProgress', async () => {
      const mockStream = {};
      mockDockerInstance.pull.mockResolvedValue(mockStream);

      const progressEvents: any[] = [];
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any, onProgress: any) => {
          onProgress({ status: 'Pulling layer' });
          onFinished(null, []);
        }
      );

      await dockerClient.pull('alpine:latest', (event) => {
        progressEvents.push(event);
      });

      expect(mockDockerInstance.pull).toHaveBeenCalledWith('alpine:latest');
      expect(progressEvents).toHaveLength(1);
    });

    it('should pull image without onProgress', async () => {
      mockDockerInstance.pull.mockResolvedValue({});
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any, onProgress: any) => {
          onProgress({ status: 'Pulling' });
          onFinished(null, []);
        }
      );

      await dockerClient.pull('alpine:latest');
    });

    it('should throw on pull error', async () => {
      mockDockerInstance.pull.mockRejectedValue(new Error('pull error'));

      await expect(dockerClient.pull('nonexistent:tag')).rejects.toThrow('pull error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to pull image: nonexistent:tag', { error: expect.any(Error) });
    });

    it('should throw when followProgress reports error', async () => {
      mockDockerInstance.pull.mockResolvedValue({});
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any) => {
          onFinished(new Error('pull failed'), []);
        }
      );

      await expect(dockerClient.pull('alpine:latest')).rejects.toThrow('pull failed');
    });

    it('should handle onProgress callback that throws', async () => {
      mockDockerInstance.pull.mockResolvedValue({});
      mockDockerInstance.modem.followProgress.mockImplementation(
        (_stream: any, onFinished: any, onProgress: any) => {
          onProgress({ status: 'Pulling' });
          onFinished(null, []);
        }
      );

      await dockerClient.pull('alpine:latest', () => {
        throw new Error('callback error');
      });

      expect(mockLogger.error).toHaveBeenCalledWith('onProgress callback threw an exception', { callbackError: expect.any(Error) });
    });
  });

  describe('resetForTesting', () => {
    it('should allow creating a new instance after reset', () => {
      const instance1 = DockerClient.getInstance();
      DockerClient.resetForTesting();
      const instance2 = DockerClient.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });
});
