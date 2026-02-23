import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';
import { DockerClient } from '../../docker-client';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    inspectContainer: vi.fn(),
    getContainer: vi.fn(),
    run: vi.fn(),
  }
}));

vi.mock('../../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// Mock other dependencies
vi.mock('@/lib/db', () => ({
  db: { 
    select: vi.fn(() => ({ 
      from: vi.fn(() => ({ 
        where: vi.fn(() => ({ 
          get: vi.fn(), 
          all: vi.fn().mockReturnValue([]) 
        })),
        all: vi.fn().mockReturnValue([]) 
      })) 
    })), 
    update: vi.fn(() => ({ 
      set: vi.fn(() => ({ 
        where: vi.fn(() => ({ 
          run: vi.fn() 
        })) 
      })) 
    })) 
  },
  schema: { sessions: {}, sshKeys: {} },
}));

vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: vi.fn().mockImplementation(function() {
    return {
      getEffectiveSettings: vi.fn().mockResolvedValue({}),
    };
  }),
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: vi.fn().mockImplementation(function() {
    return {
      decrypt: vi.fn().mockResolvedValue('decrypted'),
    };
  }),
}));

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

describe('DockerAdapter', () => {
  let adapter: DockerAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new DockerAdapter({
      environmentId: 'env-1',
      imageName: 'test-image',
      imageTag: 'latest',
      authDirPath: '/auth',
    });
  });

  describe('isContainerRunning', () => {
    it('should use DockerClient.inspectContainer', async () => {
      mockDockerClient.inspectContainer.mockResolvedValue({ State: { Running: true } });
      const result = await (adapter as any).isContainerRunning('container-1');
      expect(result).toBe(true);
      expect(mockDockerClient.inspectContainer).toHaveBeenCalledWith('container-1');
    });

    it('should return false if inspect fails', async () => {
      mockDockerClient.inspectContainer.mockRejectedValue(new Error('Not found'));
      const result = await (adapter as any).isContainerRunning('container-1');
      expect(result).toBe(false);
    });
  });

  describe('stopContainer', () => {
    it('should use DockerClient.getContainer().stop()', async () => {
      const mockContainer = { stop: vi.fn().mockResolvedValue(undefined) };
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      await (adapter as any).stopContainer('container-1');

      expect(mockDockerClient.getContainer).toHaveBeenCalledWith('container-1');
      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
    });
  });

  describe('runEphemeralContainer', () => {
    it('should use DockerClient.run', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 0 });

      const result = await (adapter as any).runEphemeralContainer(['echo', 'hello'], {});

      expect(mockDockerClient.run).toHaveBeenCalled();
      expect(result.code).toBe(0);
    });
  });
});
