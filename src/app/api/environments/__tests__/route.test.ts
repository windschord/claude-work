import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// ホイストされたモック
const { mockExec, mockAccess } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockAccess: vi.fn(),
}));

// モック
const mockFindAll = vi.fn();
const mockCreate = vi.fn();
const mockCheckStatus = vi.fn();
const mockCreateAuthDirectory = vi.fn();

vi.mock('@/services/environment-service', () => ({
  environmentService: {
    findAll: () => mockFindAll(),
    create: (input: unknown) => mockCreate(input),
    checkStatus: (id: string) => mockCheckStatus(id),
    createAuthDirectory: (id: string) => mockCreateAuthDirectory(id),
  },
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

describe('/api/environments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/environments', () => {
    it('環境一覧を取得できる', async () => {
      const environments = [
        {
          id: 'env-1',
          name: 'Local Host',
          type: 'HOST',
          description: 'Default host',
          config: '{}',
          auth_dir_path: null,
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'env-2',
          name: 'Docker Env',
          type: 'DOCKER',
          description: 'Docker environment',
          config: '{"imageName":"my-image"}',
          auth_dir_path: '/data/environments/env-2',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockFindAll.mockResolvedValue(environments);

      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environments).toHaveLength(2);
      expect(data.environments[0].id).toBe('env-1');
      expect(mockFindAll).toHaveBeenCalledTimes(1);
      // ステータスなしの場合はcheckStatusは呼ばれない
      expect(mockCheckStatus).not.toHaveBeenCalled();
    });

    it('includeStatus=trueで環境ステータスも取得できる', async () => {
      const environments = [
        {
          id: 'env-1',
          name: 'Local Host',
          type: 'HOST',
          description: 'Default host',
          config: '{}',
          auth_dir_path: null,
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockFindAll.mockResolvedValue(environments);
      mockCheckStatus.mockResolvedValue({
        available: true,
        authenticated: true,
      });

      const request = new NextRequest('http://localhost:3000/api/environments?includeStatus=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environments).toHaveLength(1);
      expect(data.environments[0].status).toBeDefined();
      expect(data.environments[0].status.available).toBe(true);
      expect(data.environments[0].status.authenticated).toBe(true);
      expect(mockCheckStatus).toHaveBeenCalledTimes(1);
      expect(mockCheckStatus).toHaveBeenCalledWith('env-1');
    });

    it('複数環境のステータスを並列取得する', async () => {
      const environments = [
        {
          id: 'env-1',
          name: 'Local Host',
          type: 'HOST',
          description: null,
          config: '{}',
          auth_dir_path: null,
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'env-2',
          name: 'Docker Env',
          type: 'DOCKER',
          description: null,
          config: '{}',
          auth_dir_path: '/data/environments/env-2',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockFindAll.mockResolvedValue(environments);
      mockCheckStatus
        .mockResolvedValueOnce({ available: true, authenticated: true })
        .mockResolvedValueOnce({ available: true, authenticated: false, details: { dockerDaemon: true, imageExists: false } });

      const request = new NextRequest('http://localhost:3000/api/environments?includeStatus=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environments).toHaveLength(2);
      expect(mockCheckStatus).toHaveBeenCalledTimes(2);
    });

    it('環境一覧取得時のエラーを処理する', async () => {
      mockFindAll.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('空の環境一覧を正しく返す', async () => {
      mockFindAll.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environments).toHaveLength(0);
    });
  });

  describe('POST /api/environments', () => {
    it('HOST環境を作成できる', async () => {
      const newEnvironment = {
        id: 'env-new',
        name: 'New Host',
        type: 'HOST',
        description: 'New host environment',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCreate.mockResolvedValue(newEnvironment);

      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Host',
          type: 'HOST',
          description: 'New host environment',
          config: {},
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.environment.id).toBe('env-new');
      expect(data.environment.name).toBe('New Host');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      // HOST環境では認証ディレクトリは作成されない
      expect(mockCreateAuthDirectory).not.toHaveBeenCalled();
    });

    it('DOCKER環境を作成すると認証ディレクトリも作成される', async () => {
      const newEnvironment = {
        id: 'env-docker-new',
        name: 'Docker Env',
        type: 'DOCKER',
        description: 'Docker environment',
        config: '{"imageName":"my-image","imageTag":"latest"}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCreate.mockResolvedValue(newEnvironment);
      mockCreateAuthDirectory.mockResolvedValue('/data/environments/env-docker-new');

      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Docker Env',
          type: 'DOCKER',
          description: 'Docker environment',
          config: { imageName: 'my-image', imageTag: 'latest' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.environment.id).toBe('env-docker-new');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreateAuthDirectory).toHaveBeenCalledTimes(1);
      expect(mockCreateAuthDirectory).toHaveBeenCalledWith('env-docker-new');
    });

    it('名前が空の場合は400エラー', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          type: 'HOST',
          config: {},
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('name');
    });

    it('タイプが無効な場合は400エラー', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Env',
          type: 'INVALID',
          config: {},
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('type');
    });

    it('不正なJSONの場合は400エラー', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('サーバーエラーを処理する', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Env',
          type: 'HOST',
          config: {},
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('SSH環境を作成できる', async () => {
      const newEnvironment = {
        id: 'env-ssh-new',
        name: 'SSH Env',
        type: 'SSH',
        description: 'SSH environment',
        config: '{"host":"example.com"}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCreate.mockResolvedValue(newEnvironment);

      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'SSH Env',
          type: 'SSH',
          description: 'SSH environment',
          config: { host: 'example.com' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.environment.type).toBe('SSH');
      // SSH環境でも認証ディレクトリは作成されない（現時点では）
      expect(mockCreateAuthDirectory).not.toHaveBeenCalled();
    });

    describe('Dockerfile自動ビルド（imageSource=dockerfile）', () => {
      it('imageSource=dockerfileの場合、自動でDockerイメージをビルドする', async () => {
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
              stdout: 'Successfully built abc123\nSuccessfully tagged claude-work-env-temp:latest\n',
              stderr: '',
            });
            return {} as ReturnType<typeof mockExec>;
          }
        );

        const newEnvironment = {
          id: 'env-docker-build',
          name: 'Docker Build Env',
          type: 'DOCKER',
          description: 'Docker environment with Dockerfile',
          config: '{"imageSource":"dockerfile","dockerfilePath":"/path/to/Dockerfile","imageName":"claude-work-env-temp","imageTag":"latest"}',
          auth_dir_path: null,
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateAuthDirectory.mockResolvedValue('/data/environments/env-docker-build');

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            description: 'Docker environment with Dockerfile',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath: '/path/to/Dockerfile',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.environment.id).toBe('env-docker-build');
        // docker buildが呼ばれたことを確認
        expect(mockExec).toHaveBeenCalled();
        // 認証ディレクトリが作成されたことを確認
        expect(mockCreateAuthDirectory).toHaveBeenCalledWith('env-docker-build');
        // configにビルドしたイメージ名が設定されていることを確認
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              imageName: expect.stringMatching(/^claude-work-env-/),
              imageTag: 'latest',
            }),
          })
        );
      });

      it('Dockerfileが存在しない場合は400エラーを返す', async () => {
        // Dockerfile存在チェック - 失敗
        mockAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath: '/nonexistent/Dockerfile',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Dockerfile not found');
        // 環境は作成されない
        expect(mockCreate).not.toHaveBeenCalled();
      });

      it('Dockerビルドが失敗した場合は400エラーを返す', async () => {
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

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath: '/path/to/Dockerfile',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Docker build failed');
        expect(data.details).toContain('pull access denied');
        // 環境は作成されない
        expect(mockCreate).not.toHaveBeenCalled();
      });

      it('imageSource=dockerfileでdockerfilePathがない場合は400エラーを返す', async () => {
        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            config: {
              imageSource: 'dockerfile',
              // dockerfilePath が欠落
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('dockerfilePath is required');
        expect(mockCreate).not.toHaveBeenCalled();
      });

      it('imageSource=existingの場合はビルドを実行しない', async () => {
        const newEnvironment = {
          id: 'env-docker-existing',
          name: 'Docker Existing Env',
          type: 'DOCKER',
          description: 'Docker environment with existing image',
          config: '{"imageSource":"existing","imageName":"my-image","imageTag":"latest"}',
          auth_dir_path: null,
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateAuthDirectory.mockResolvedValue('/data/environments/env-docker-existing');

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Existing Env',
            type: 'DOCKER',
            description: 'Docker environment with existing image',
            config: {
              imageSource: 'existing',
              imageName: 'my-image',
              imageTag: 'latest',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.environment.id).toBe('env-docker-existing');
        // ビルドは実行されない
        expect(mockExec).not.toHaveBeenCalled();
        // 認証ディレクトリは作成される
        expect(mockCreateAuthDirectory).toHaveBeenCalledWith('env-docker-existing');
      });
    });
  });
});
