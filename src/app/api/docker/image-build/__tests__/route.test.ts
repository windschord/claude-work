import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// DockerClientモックを作成
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    buildImage: vi.fn(),
  },
}));

vi.mock('@/services/docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// fs/promisesモジュールをモック
const { mockAccess } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
}));

vi.mock('fs/promises', async () => {
  return {
    access: mockAccess,
  };
});

// tar-fsモジュールをモック
vi.mock('tar-fs', () => ({
  pack: vi.fn(() => 'mock-tar-stream'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// テスト対象
import { POST } from '../route';
import { NextRequest } from 'next/server';

// 許可されたベースディレクトリ
const ALLOWED_BASE_DIR = path.resolve(process.cwd(), 'data', 'environments');

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/docker/image-build', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('/api/docker/image-build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/docker/image-build', () => {
    it('should build image from Dockerfile', async () => {
      // 許可されたパス内のDockerfileを使用
      const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile');

      // Dockerfile存在チェック - 成功
      mockAccess.mockResolvedValue(undefined);

      // buildImage成功: onProgressコールバックでストリームイベントを送信
      mockDockerClient.buildImage.mockImplementation(
        async (_stream: unknown, _options: unknown, onProgress?: (event: any) => void) => {
          if (onProgress) {
            onProgress({ stream: 'Step 1/3 : FROM node:18-alpine\n' });
            onProgress({ stream: 'Step 2/3 : WORKDIR /app\n' });
            onProgress({ stream: 'Step 3/3 : CMD ["node"]\n' });
            onProgress({ stream: 'Successfully built abc123\n' });
            onProgress({ stream: 'Successfully tagged test-image:latest\n' });
          }
        }
      );

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.imageName).toBe('test-image:latest');
      expect(data.buildLog).toContain('Successfully built');
    });

    it('should return 400 when path is not allowed', async () => {
      // 許可されていないパス
      const request = createRequest({
        dockerfilePath: '/unauthorized/path/Dockerfile',
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Dockerfile path is not allowed');
    });

    it('should return 400 when Dockerfile not found', async () => {
      const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'nonexistent', 'Dockerfile');

      // Dockerfile存在チェック - 失敗
      mockAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      // パス情報は漏洩させない
      expect(data.error).toBe('Dockerfile not found');
      expect(data.error).not.toContain(dockerfilePath);
    });

    it('should return 400 with build log on build failure', async () => {
      const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile');

      // Dockerfile存在チェック - 成功
      mockAccess.mockResolvedValue(undefined);

      // buildImage: onProgressでエラーイベントを送信
      mockDockerClient.buildImage.mockImplementation(
        async (_stream: unknown, _options: unknown, onProgress?: (event: any) => void) => {
          if (onProgress) {
            onProgress({ stream: 'Step 1/3 : FROM invalid-image:nonexistent\n' });
            onProgress({ error: 'pull access denied for invalid-image' });
          }
        }
      );

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Build failed');
      expect(data.buildLog).toContain('pull access denied');
    });

    it('should return 400 when dockerfilePath is missing', async () => {
      const request = createRequest({
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('dockerfilePath is required');
    });

    it('should return 400 when imageName is missing', async () => {
      const request = createRequest({
        dockerfilePath: path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile'),
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('imageName is required');
    });

    it('should return 400 for invalid imageName format', async () => {
      const request = createRequest({
        dockerfilePath: path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile'),
        imageName: 'INVALID_IMAGE_NAME', // 大文字は許可されない
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid imageName format');
    });

    it('should return 400 for invalid imageTag format', async () => {
      const request = createRequest({
        dockerfilePath: path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile'),
        imageName: 'test-image',
        imageTag: 'tag with spaces', // スペースは許可されない
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid imageTag format');
    });

    it('should use default tag "latest" when imageTag is not provided', async () => {
      const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile');

      // Dockerfile存在チェック - 成功
      mockAccess.mockResolvedValue(undefined);

      // buildImage成功
      mockDockerClient.buildImage.mockImplementation(
        async (_stream: unknown, _options: unknown, onProgress?: (event: any) => void) => {
          if (onProgress) {
            onProgress({ stream: 'Successfully built abc123\n' });
          }
        }
      );

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        // imageTag省略
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.imageName).toBe('test-image:latest');

      // buildImageが正しいオプションで呼ばれたか確認
      expect(mockDockerClient.buildImage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          t: 'test-image:latest',
        }),
        expect.any(Function)
      );
    });
  });
});
