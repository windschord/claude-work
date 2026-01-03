import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ホイストされたモックを作成
const { mockExec } = vi.hoisted(() => ({
  mockExec: vi.fn(),
}));

// child_processモジュールをモック
vi.mock('child_process', async () => {
  const mockExports = {
    exec: mockExec,
    spawn: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

// テスト対象
import { DockerService, DockerServiceConfig } from '../docker-service';

describe('DockerService', () => {
  let dockerService: DockerService;

  beforeEach(() => {
    vi.clearAllMocks();
    dockerService = new DockerService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isDockerAvailable', () => {
    it('Dockerデーモンが起動している場合はtrueを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, 'Docker version 24.0.0', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.isDockerAvailable();

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith('docker info', expect.any(Function));
    });

    it('Dockerデーモンが停止している場合はfalseを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(new Error('Cannot connect to Docker daemon'), '', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.isDockerAvailable();

      expect(result).toBe(false);
    });

    it('Dockerがインストールされていない場合はfalseを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const error = new Error('command not found: docker') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          callback(error, '', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.isDockerAvailable();

      expect(result).toBe(false);
    });
  });

  describe('imageExists', () => {
    it('イメージが存在する場合はtrueを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, 'abc123def456', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.imageExists();

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker images'),
        expect.any(Function)
      );
    });

    it('イメージが存在しない場合はfalseを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, '', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.imageExists();

      expect(result).toBe(false);
    });

    it('コマンドエラーの場合はfalseを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(new Error('Docker error'), '', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.imageExists();

      expect(result).toBe(false);
    });
  });

  describe('getImageName', () => {
    it('デフォルトのイメージ名を返す', () => {
      expect(dockerService.getImageName()).toBe('claude-code-sandboxed');
    });

    it('設定されたイメージ名を返す', () => {
      const config: DockerServiceConfig = {
        imageName: 'custom-image',
        imageTag: 'v1.0',
        maxConcurrentContainers: 10,
      };
      const customService = new DockerService(config);

      expect(customService.getImageName()).toBe('custom-image');
    });
  });

  describe('getImageTag', () => {
    it('デフォルトのイメージタグを返す', () => {
      expect(dockerService.getImageTag()).toBe('latest');
    });

    it('設定されたイメージタグを返す', () => {
      const config: DockerServiceConfig = {
        imageName: 'custom-image',
        imageTag: 'v1.0',
        maxConcurrentContainers: 10,
      };
      const customService = new DockerService(config);

      expect(customService.getImageTag()).toBe('v1.0');
    });
  });

  describe('getFullImageName', () => {
    it('完全なイメージ名を返す', () => {
      expect(dockerService.getFullImageName()).toBe('claude-code-sandboxed:latest');
    });

    it('カスタム設定の完全なイメージ名を返す', () => {
      const config: DockerServiceConfig = {
        imageName: 'my-image',
        imageTag: 'v2.0',
        maxConcurrentContainers: 5,
      };
      const customService = new DockerService(config);

      expect(customService.getFullImageName()).toBe('my-image:v2.0');
    });
  });

  describe('constructor with config', () => {
    it('デフォルト設定で初期化される', () => {
      const service = new DockerService();

      expect(service.getImageName()).toBe('claude-code-sandboxed');
      expect(service.getImageTag()).toBe('latest');
      expect(service.getMaxConcurrentContainers()).toBe(5);
    });

    it('カスタム設定で初期化される', () => {
      const config: DockerServiceConfig = {
        imageName: 'test-image',
        imageTag: 'test-tag',
        maxConcurrentContainers: 3,
      };
      const service = new DockerService(config);

      expect(service.getImageName()).toBe('test-image');
      expect(service.getImageTag()).toBe('test-tag');
      expect(service.getMaxConcurrentContainers()).toBe(3);
    });
  });
});
