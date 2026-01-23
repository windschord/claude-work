import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ホイストされたモックを作成
const { mockExec, mockAccess } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockAccess: vi.fn(),
}));

// child_processモジュールをモック
vi.mock('child_process', async () => {
  const mockExports = {
    exec: mockExec,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

// fs/promisesモジュールをモック
vi.mock('fs/promises', async () => {
  return {
    access: mockAccess,
  };
});

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
      // Dockerfile存在チェック - 成功
      mockAccess.mockResolvedValue(undefined);

      // docker build 成功
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(null, {
            stdout: 'Step 1/3 : FROM node:18-alpine\nStep 2/3 : WORKDIR /app\nStep 3/3 : CMD ["node"]\nSuccessfully built abc123\nSuccessfully tagged test-image:latest\n',
            stderr: '',
          });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const request = createRequest({
        dockerfilePath: '/path/to/Dockerfile',
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

    it('should return 400 when Dockerfile not found', async () => {
      // Dockerfile存在チェック - 失敗
      mockAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const request = createRequest({
        dockerfilePath: '/nonexistent/Dockerfile',
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Dockerfile not found');
      expect(data.error).toContain('/nonexistent/Dockerfile');
    });

    it('should return 400 with build log on build failure', async () => {
      // Dockerfile存在チェック - 成功
      mockAccess.mockResolvedValue(undefined);

      // docker build 失敗
      const buildError = new Error('Build failed') as Error & {
        stdout: string;
        stderr: string;
      };
      buildError.stdout = 'Step 1/3 : FROM invalid-image:nonexistent\n';
      buildError.stderr = 'pull access denied for invalid-image\n';

      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(buildError, { stdout: '', stderr: '' });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const request = createRequest({
        dockerfilePath: '/path/to/Dockerfile',
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
        dockerfilePath: '/path/to/Dockerfile',
        imageTag: 'latest',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('imageName is required');
    });

    it('should use default tag "latest" when imageTag is not provided', async () => {
      // Dockerfile存在チェック - 成功
      mockAccess.mockResolvedValue(undefined);

      // docker build 成功
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          // コマンドにlatestタグが含まれているか確認
          expect(cmd).toContain('test-image:latest');
          callback(null, {
            stdout: 'Successfully built abc123\n',
            stderr: '',
          });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const request = createRequest({
        dockerfilePath: '/path/to/Dockerfile',
        imageName: 'test-image',
        // imageTag省略
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.imageName).toBe('test-image:latest');
    });
  });
});
