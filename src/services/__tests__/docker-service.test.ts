import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    ping: vi.fn(),
    info: vi.fn(),
    listContainers: vi.fn(),
    inspectImage: vi.fn(),
    buildImage: vi.fn(),
  }
}));

vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// Mock tar-fs
vi.mock('tar-fs', () => ({
  pack: vi.fn().mockReturnValue('mock-tar-stream'),
}));

// Mock child_process for 'which docker'
const { mockExec } = vi.hoisted(() => ({
  mockExec: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: mockExec,
  default: { exec: mockExec },
}));

// Mock fs/promises and os
const { mockAccess, mockHomedir } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockHomedir: vi.fn().mockReturnValue('/mock/home'),
}));

vi.mock('fs/promises', () => ({
  access: mockAccess,
}));

vi.mock('os', () => ({
  homedir: mockHomedir,
}));

// テスト対象
import { DockerService, DockerServiceConfig } from '../docker-service';

describe('DockerService', () => {
  let dockerService: DockerService;

  beforeEach(() => {
    vi.clearAllMocks();
    dockerService = new DockerService();
    mockAccess.mockResolvedValue(undefined); // Default: file exists
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isDockerAvailable', () => {
    it('Dockerデーモンが起動している場合はtrueを返す', async () => {
      mockDockerClient.ping.mockResolvedValue(true);

      const result = await dockerService.isDockerAvailable();

      expect(result).toBe(true);
      expect(mockDockerClient.ping).toHaveBeenCalled();
    });

    it('Dockerデーモンが停止している場合はfalseを返す', async () => {
      mockDockerClient.ping.mockResolvedValue(false);

      const result = await dockerService.isDockerAvailable();

      expect(result).toBe(false);
    });
  });

  describe('imageExists', () => {
    it('イメージが存在する場合はtrueを返す', async () => {
      mockDockerClient.inspectImage.mockResolvedValue({});

      const result = await dockerService.imageExists();

      expect(result).toBe(true);
      expect(mockDockerClient.inspectImage).toHaveBeenCalledWith('claude-code-sandboxed:latest');
    });

    it('イメージが存在しない場合はfalseを返す', async () => {
      mockDockerClient.inspectImage.mockRejectedValue(new Error('No such image'));

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
      expect(service.isEnabled()).toBe(false);
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
      // Mock successful build
      mockDockerClient.buildImage.mockResolvedValue(undefined);

      await expect(dockerService.buildImage()).resolves.toBeUndefined();
      
      expect(mockDockerClient.buildImage).toHaveBeenCalledWith(
        'mock-tar-stream',
        expect.objectContaining({ t: 'claude-code-sandboxed:latest' }),
        expect.any(Function)
      );
    });

    it('進捗コールバックが呼び出される', async () => {
      mockDockerClient.buildImage.mockImplementation(async (stream, opts, onProgress) => {
        if (onProgress) {
          onProgress({ stream: 'Step 1/5: FROM node:20-slim\n' });
          onProgress({ stream: 'Step 2/5: RUN apt-get update\n' });
        }
        return Promise.resolve();
      });

      const onProgress = vi.fn();
      await dockerService.buildImage(onProgress);

      expect(onProgress).toHaveBeenCalledWith('Step 1/5: FROM node:20-slim\n');
      expect(onProgress).toHaveBeenCalledWith('Step 2/5: RUN apt-get update\n');
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('ビルドが失敗した場合はログ出力される（DockerClientはrejectする）', async () => {
      // DockerClientがrejectする場合
      mockDockerClient.buildImage.mockRejectedValue(new Error('Build failed'));
      await expect(dockerService.buildImage()).rejects.toThrow('Build failed');
    });
  });

  describe('getDockerfilePath', () => {
    it('Dockerfileのパスを返す', () => {
      const result = dockerService.getDockerfilePath();

      // 結果がdockerディレクトリへの絶対パスであることを確認
      expect(result).toMatch(/\/docker$/);
      // process.cwd()からの相対パスであることを確認
      expect(result).toContain(process.cwd());
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

  describe('diagnoseDockerError', () => {
    it('Dockerがインストールされていない場合はDOCKER_NOT_INSTALLEDエラーを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          if (cmd === 'which docker') {
            const error = new Error('command not found');
            callback(error, '', '');
          }
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const result = await dockerService.diagnoseDockerError();

      expect(result).not.toBeNull();
      expect(result?.errorType).toBe('DOCKER_NOT_INSTALLED');
      expect(result?.userMessage).toContain('インストールされていません');
    });

    it('Dockerデーモンが停止している場合はDOCKER_DAEMON_NOT_RUNNINGエラーを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          if (cmd === 'which docker') {
            callback(null, '/usr/bin/docker', '');
          }
          return {} as ReturnType<typeof mockExec>;
        }
      );
      
      mockDockerClient.info.mockRejectedValue(new Error('Cannot connect to Docker daemon'));

      const result = await dockerService.diagnoseDockerError();

      expect(result).not.toBeNull();
      expect(result?.errorType).toBe('DOCKER_DAEMON_NOT_RUNNING');
      expect(result?.userMessage).toContain('起動していません');
    });

    it('権限エラーの場合はDOCKER_PERMISSION_DENIEDエラーを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          if (cmd === 'which docker') {
            callback(null, '/usr/bin/docker', '');
          }
          return {} as ReturnType<typeof mockExec>;
        }
      );
      
      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.listContainers.mockRejectedValue({ statusCode: 403, message: 'permission denied' });

      const result = await dockerService.diagnoseDockerError();

      expect(result).not.toBeNull();
      expect(result?.errorType).toBe('DOCKER_PERMISSION_DENIED');
      expect(result?.userMessage).toContain('権限がありません');
    });

    it('問題がない場合はnullを返す', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, 'success', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.listContainers.mockResolvedValue([]);

      const result = await dockerService.diagnoseDockerError();

      expect(result).toBeNull();
    });
  });

  describe('checkAuthCredentials', () => {
    it('認証情報のチェック結果を返す', async () => {
      const result = await dockerService.checkAuthCredentials();

      // 結果の構造を確認
      expect(result).toHaveProperty('claudeAuth');
      expect(result).toHaveProperty('claudeConfig');
      expect(result).toHaveProperty('sshAuth');
      expect(result).toHaveProperty('gitConfig');
      expect(result).toHaveProperty('anthropicApiKey');

      expect(result.claudeAuth.exists).toBe(true);
      expect(result.claudeAuth.path).toBe('/mock/home/.claude');
    });

    it('ファイルが存在しない場合', async () => {
      mockAccess.mockRejectedValue(new Error('No such file'));

      const result = await dockerService.checkAuthCredentials();
      
      expect(result.claudeAuth.exists).toBe(false);
    });
  });

  describe('diagnoseAuthIssues', () => {
    it('ANTHROPIC_API_KEYが未設定の場合は問題を報告する', async () => {
      // 環境変数を一時的にクリア
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      // Also mock file access failure to verify that part too if needed, 
      // but here we focus on API key
      mockAccess.mockResolvedValue(undefined);

      try {
        const service = new DockerService();
        const issues = await service.diagnoseAuthIssues();

        expect(issues.some((issue) => issue.includes('ANTHROPIC_API_KEY'))).toBe(true);
      } finally {
        // 環境変数を復元
        if (originalApiKey) {
          process.env.ANTHROPIC_API_KEY = originalApiKey;
        }
      }
    });

    it('問題がない場合は空配列を返す', async () => {
      // 環境変数を設定
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-key';
      mockAccess.mockResolvedValue(undefined);

      try {
        const service = new DockerService();
        const issues = await service.diagnoseAuthIssues();

        // ANTHROPIC_API_KEYに関する問題は含まれない
        expect(issues.some((issue) => issue.includes('ANTHROPIC_API_KEY'))).toBe(false);
      } finally {
        // 環境変数を復元
        if (originalApiKey) {
          process.env.ANTHROPIC_API_KEY = originalApiKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
      }
    });
  });
});
