import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';

// ホイストされたモックを作成
const { mockSpawn, mockAccess } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockAccess: vi.fn(),
}));

// child_processモジュールをモック（spawnを使用するように変更）
vi.mock('child_process', async () => {
  const mockExports = {
    spawn: mockSpawn,
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

// モックのchild processを作成するヘルパー
function createMockProcess() {
  const mockProcess = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.kill = vi.fn();
  return mockProcess;
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

      // docker build 成功（spawnを使用）
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const responsePromise = POST(request);

      // 非同期でイベントを発火
      setImmediate(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            'Step 1/3 : FROM node:18-alpine\nStep 2/3 : WORKDIR /app\nStep 3/3 : CMD ["node"]\nSuccessfully built abc123\nSuccessfully tagged test-image:latest\n'
          )
        );
        mockProcess.emit('close', 0);
      });

      const response = await responsePromise;
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

      // docker build 失敗（spawnを使用）
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        imageTag: 'latest',
      });

      const responsePromise = POST(request);

      // 非同期でイベントを発火（ビルド失敗）
      setImmediate(() => {
        mockProcess.stdout.emit('data', Buffer.from('Step 1/3 : FROM invalid-image:nonexistent\n'));
        mockProcess.stderr.emit('data', Buffer.from('pull access denied for invalid-image\n'));
        mockProcess.emit('close', 1); // 非ゼロの終了コード
      });

      const response = await responsePromise;
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

      // docker build 成功（spawnを使用）
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const request = createRequest({
        dockerfilePath,
        imageName: 'test-image',
        // imageTag省略
      });

      const responsePromise = POST(request);

      // spawnが呼ばれた引数を確認
      setImmediate(() => {
        // spawnの引数を確認
        expect(mockSpawn).toHaveBeenCalledWith(
          'docker',
          ['build', '-t', 'test-image:latest', '-f', 'Dockerfile', '.'],
          expect.any(Object)
        );

        mockProcess.stdout.emit('data', Buffer.from('Successfully built abc123\n'));
        mockProcess.emit('close', 0);
      });

      const response = await responsePromise;
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.imageName).toBe('test-image:latest');
    });
  });
});
