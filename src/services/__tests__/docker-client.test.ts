import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerClient } from '../docker-client';

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
  });
});
