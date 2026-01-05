import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ホイストされたモックを作成
const { mockExec, mockExecFile, mockSpawn } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockExecFile: vi.fn(),
  mockSpawn: vi.fn(),
}));

// child_processモジュールをモック
vi.mock('child_process', async () => {
  const mockExports = {
    exec: mockExec,
    execFile: mockExecFile,
    spawn: mockSpawn,
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
      mockExecFile.mockImplementation(
        (
          command: string,
          args: string[],
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, 'abc123def456', '');
          return {} as ReturnType<typeof mockExecFile>;
        }
      );

      const result = await dockerService.imageExists();

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['images', '-q', 'claude-code-sandboxed:latest'],
        expect.any(Function)
      );
    });

    it('イメージが存在しない場合はfalseを返す', async () => {
      mockExecFile.mockImplementation(
        (
          command: string,
          args: string[],
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, '', '');
          return {} as ReturnType<typeof mockExecFile>;
        }
      );

      const result = await dockerService.imageExists();

      expect(result).toBe(false);
    });

    it('コマンドエラーの場合はfalseを返す', async () => {
      mockExecFile.mockImplementation(
        (
          command: string,
          args: string[],
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(new Error('Docker error'), '', '');
          return {} as ReturnType<typeof mockExecFile>;
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
        enabled: true,
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
        enabled: true,
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
        enabled: true,
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
        enabled: true,
      };
      const service = new DockerService(config);

      expect(service.getImageName()).toBe('test-image');
      expect(service.getImageTag()).toBe('test-tag');
      expect(service.getMaxConcurrentContainers()).toBe(3);
    });
  });

  describe('buildImage', () => {
    it('ビルドが成功した場合はresolveする', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const buildPromise = dockerService.buildImage();

      // ビルドログを出力
      mockProcess.stdout.emit('data', Buffer.from('Step 1/5: FROM node:20-slim\n'));
      mockProcess.stdout.emit('data', Buffer.from('Successfully built abc123\n'));

      // ビルド完了
      mockProcess.emit('close', 0);

      await expect(buildPromise).resolves.toBeUndefined();
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['build', '-t']),
        expect.any(Object)
      );
    });

    it('進捗コールバックが呼び出される', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const onProgress = vi.fn();
      const buildPromise = dockerService.buildImage(onProgress);

      // ビルドログを出力
      mockProcess.stdout.emit('data', Buffer.from('Step 1/5: FROM node:20-slim\n'));
      mockProcess.stdout.emit('data', Buffer.from('Step 2/5: RUN apt-get update\n'));

      // ビルド完了
      mockProcess.emit('close', 0);

      await buildPromise;

      expect(onProgress).toHaveBeenCalledWith('Step 1/5: FROM node:20-slim\n');
      expect(onProgress).toHaveBeenCalledWith('Step 2/5: RUN apt-get update\n');
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('ビルドが失敗した場合はrejectする', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const buildPromise = dockerService.buildImage();

      // エラー出力
      mockProcess.stderr.emit('data', Buffer.from('Error: Dockerfile not found\n'));

      // ビルド失敗
      mockProcess.emit('close', 1);

      await expect(buildPromise).rejects.toThrow('Docker image build failed with exit code 1');
    });

    it('spawnエラーの場合はrejectする', async () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const buildPromise = dockerService.buildImage();

      // spawnエラー
      mockProcess.emit('error', new Error('spawn docker ENOENT'));

      await expect(buildPromise).rejects.toThrow('spawn docker ENOENT');
    });
  });

  describe('getDockerfilePath', () => {
    it('Dockerfileのパスを返す', () => {
      const path = dockerService.getDockerfilePath();
      expect(path).toContain('docker');
    });
  });

  describe('isEnabled', () => {
    it('デフォルトでfalseを返す（DOCKER_ENABLED環境変数が未設定の場合）', () => {
      // 環境変数が設定されていない場合はデフォルトでfalse
      expect(dockerService.isEnabled()).toBe(false);
    });

    it('設定でtrueを指定した場合はtrueを返す', () => {
      const config: DockerServiceConfig = {
        imageName: 'test',
        imageTag: 'test',
        maxConcurrentContainers: 5,
        enabled: true,
      };
      const service = new DockerService(config);
      expect(service.isEnabled()).toBe(true);
    });

    it('設定でfalseを指定した場合はfalseを返す', () => {
      const config: DockerServiceConfig = {
        imageName: 'test',
        imageTag: 'test',
        maxConcurrentContainers: 5,
        enabled: false,
      };
      const service = new DockerService(config);
      expect(service.isEnabled()).toBe(false);
    });
  });
});
