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
});
