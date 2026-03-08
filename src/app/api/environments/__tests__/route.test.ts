import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as path from 'path';
import { GET, POST } from '../route';

// ホイストされたモック
const { mockAccess, mockDockerClient, mockIsHostEnvironmentAllowed } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockDockerClient: {
    buildImage: vi.fn(),
  },
  mockIsHostEnvironmentAllowed: vi.fn(() => true),
}));

// Mock environment-detect
vi.mock('@/lib/environment-detect', () => ({
  isHostEnvironmentAllowed: mockIsHostEnvironmentAllowed,
}));

// Mock DockerClient
vi.mock('@/services/docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// Mock tar-fs
vi.mock('tar-fs', () => ({
  pack: vi.fn().mockReturnValue('mock-tar-stream'),
}));

// モック
const mockFindAll = vi.fn();
const mockCreate = vi.fn();
const mockCheckStatus = vi.fn();
const mockCreateConfigVolumes = vi.fn();
const mockDelete = vi.fn();

// NetworkFilterService モック
const mockUpdateFilterConfig = vi.fn();
const mockGetDefaultTemplates = vi.fn();
const mockApplyTemplates = vi.fn();

vi.mock('@/services/environment-service', () => ({
  environmentService: {
    findAll: () => mockFindAll(),
    create: (input: unknown) => mockCreate(input),
    checkStatus: (id: string) => mockCheckStatus(id),
    createConfigVolumes: (id: string) => mockCreateConfigVolumes(id),
    delete: (id: string) => mockDelete(id),
  },
}));

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    updateFilterConfig: (...args: unknown[]) => mockUpdateFilterConfig(...args),
    getDefaultTemplates: () => mockGetDefaultTemplates(),
    applyTemplates: (...args: unknown[]) => mockApplyTemplates(...args),
  },
}));

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

// 許可されたベースディレクトリ
const ALLOWED_BASE_DIR = path.resolve(process.cwd(), 'data', 'environments');

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

    it('HOST不許可時にHOST環境にdisabled=trueが付与され、meta.hostEnvironmentDisabled=trueが返る', async () => {
      mockIsHostEnvironmentAllowed.mockReturnValue(false);

      const environments = [
        {
          id: 'env-1',
          name: 'Local Host',
          type: 'HOST',
          description: 'Default host',
          config: '{}',
          auth_dir_path: null,
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
      // HOST環境にdisabledフラグが付与される
      expect(data.environments[0].disabled).toBe(true);
      // DOCKER環境にはdisabledフラグなし
      expect(data.environments[1].disabled).toBeUndefined();
      // metaにhostEnvironmentDisabledが含まれる
      expect(data.meta).toBeDefined();
      expect(data.meta.hostEnvironmentDisabled).toBe(true);
    });

    it('HOST不許可時にincludeStatus=trueでもdisabledとmetaが返る', async () => {
      mockIsHostEnvironmentAllowed.mockReturnValue(false);

      const environments = [
        {
          id: 'env-1',
          name: 'Local Host',
          type: 'HOST',
          description: 'Default host',
          config: '{}',
          auth_dir_path: null,
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
      expect(data.environments[0].disabled).toBe(true);
      expect(data.environments[0].status).toBeDefined();
      expect(data.meta.hostEnvironmentDisabled).toBe(true);
    });

    it('HOST許可時にはdisabledフラグなし、meta.hostEnvironmentDisabled=false', async () => {
      mockIsHostEnvironmentAllowed.mockReturnValue(true);

      const environments = [
        {
          id: 'env-1',
          name: 'Local Host',
          type: 'HOST',
          description: 'Default host',
          config: '{}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockFindAll.mockResolvedValue(environments);

      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environments[0].disabled).toBeUndefined();
      expect(data.meta).toBeDefined();
      expect(data.meta.hostEnvironmentDisabled).toBe(false);
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
      expect(mockCreateConfigVolumes).not.toHaveBeenCalled();
    });

    it('DOCKER環境を作成すると認証ディレクトリも作成される', async () => {
      const newEnvironment = {
        id: 'env-docker-new',
        name: 'Docker Env',
        type: 'DOCKER',
        description: 'Docker environment',
        config: '{"imageName":"my-image","imageTag":"latest"}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCreate.mockResolvedValue(newEnvironment);
      mockCreateConfigVolumes.mockResolvedValue(undefined);

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
      expect(mockCreateConfigVolumes).toHaveBeenCalledTimes(1);
      expect(mockCreateConfigVolumes).toHaveBeenCalledWith('env-docker-new');
    });

    it('DOCKER環境作成時にcreateConfigVolumesが失敗するとロールバックされる', async () => {
      const newEnvironment = {
        id: 'env-docker-rollback',
        name: 'Docker Rollback Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCreate.mockResolvedValue(newEnvironment);
      mockCreateConfigVolumes.mockRejectedValue(new Error('Volume creation failed'));
      mockDelete.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Docker Rollback Env',
          type: 'DOCKER',
          config: {},
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('設定Volumeの作成に失敗しました');
      expect(mockDelete).toHaveBeenCalledWith('env-docker-rollback');
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
      expect(mockCreateConfigVolumes).not.toHaveBeenCalled();
    });

    it('HOST不許可時にHOST環境作成で403エラー', async () => {
      mockIsHostEnvironmentAllowed.mockReturnValue(false);

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

      expect(response.status).toBe(403);
      expect(data.error).toContain('HOST');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('HOST許可時にHOST環境作成は正常(201)', async () => {
      mockIsHostEnvironmentAllowed.mockReturnValue(true);

      const newEnvironment = {
        id: 'env-host-ok',
        name: 'New Host',
        type: 'HOST',
        description: 'New host environment',
        config: '{}',
        auth_dir_path: null,
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
      expect(data.environment.id).toBe('env-host-ok');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    describe('Docker環境作成時のデフォルトネットワークフィルタリングルール適用', () => {
      const defaultTemplates = [
        { category: 'Anthropic API', rules: [{ target: 'api.anthropic.com', port: 443, description: 'Claude API' }] },
        { category: 'npm', rules: [{ target: '*.npmjs.org', port: 443, description: 'npm registry' }, { target: '*.npmjs.com', port: 443, description: 'npm registry' }] },
      ];

      beforeEach(() => {
        mockGetDefaultTemplates.mockReturnValue(defaultTemplates);
        mockUpdateFilterConfig.mockResolvedValue({ id: 'config-1', environment_id: 'env-docker-new', enabled: true });
        mockApplyTemplates.mockResolvedValue({ created: 3, skipped: 0, rules: [] });
      });

      it('DOCKER環境作成時にフィルタリングが有効化されデフォルトテンプレートが適用される', async () => {
        const newEnvironment = {
          id: 'env-docker-new',
          name: 'Docker Env',
          type: 'DOCKER',
          description: null,
          config: '{"imageName":"my-image","imageTag":"latest"}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateConfigVolumes.mockResolvedValue(undefined);

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Env',
            type: 'DOCKER',
            config: { imageName: 'my-image', imageTag: 'latest' },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        // デフォルトテンプレートが取得される
        expect(mockGetDefaultTemplates).toHaveBeenCalled();
        // テンプレートルールが適用される
        expect(mockApplyTemplates).toHaveBeenCalledWith(
          'env-docker-new',
          expect.arrayContaining([
            expect.objectContaining({ target: 'api.anthropic.com', port: 443 }),
            expect.objectContaining({ target: '*.npmjs.org', port: 443 }),
            expect.objectContaining({ target: '*.npmjs.com', port: 443 }),
          ])
        );
        // ルール適用後にフィルタリングが有効化される（順序が重要）
        expect(mockUpdateFilterConfig).toHaveBeenCalledWith('env-docker-new', true);
        // 呼び出し順: createConfigVolumes → applyTemplates → updateFilterConfig
        const configVolumesOrder = mockCreateConfigVolumes.mock.invocationCallOrder[0];
        const applyOrder = mockApplyTemplates.mock.invocationCallOrder[0];
        const enableOrder = mockUpdateFilterConfig.mock.invocationCallOrder[0];
        expect(configVolumesOrder).toBeLessThan(applyOrder);
        expect(applyOrder).toBeLessThan(enableOrder);
      });

      it('HOST環境作成時にはフィルタリング初期化が行われない', async () => {
        const newEnvironment = {
          id: 'env-host-new',
          name: 'Host Env',
          type: 'HOST',
          description: null,
          config: '{}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Host Env',
            type: 'HOST',
            config: {},
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(mockUpdateFilterConfig).not.toHaveBeenCalled();
        expect(mockApplyTemplates).not.toHaveBeenCalled();
      });

      it('SSH環境作成時にはフィルタリング初期化が行われない', async () => {
        const newEnvironment = {
          id: 'env-ssh-new',
          name: 'SSH Env',
          type: 'SSH',
          description: null,
          config: '{}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'SSH Env',
            type: 'SSH',
            config: {},
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(mockUpdateFilterConfig).not.toHaveBeenCalled();
        expect(mockApplyTemplates).not.toHaveBeenCalled();
      });

      it('フィルタリング初期化失敗時もDocker環境作成は成功する（ベストエフォート）', async () => {
        const newEnvironment = {
          id: 'env-docker-filter-fail',
          name: 'Docker Env',
          type: 'DOCKER',
          description: null,
          config: '{"imageName":"my-image","imageTag":"latest"}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateConfigVolumes.mockResolvedValue(undefined);
        mockUpdateFilterConfig.mockRejectedValue(new Error('Filter config failed'));

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Env',
            type: 'DOCKER',
            config: { imageName: 'my-image', imageTag: 'latest' },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);

        // 環境作成自体は成功する
        expect(response.status).toBe(201);
      });

      it('テンプレート適用失敗時もDocker環境作成は成功する（ベストエフォート）', async () => {
        const newEnvironment = {
          id: 'env-docker-apply-fail',
          name: 'Docker Env',
          type: 'DOCKER',
          description: null,
          config: '{"imageName":"my-image","imageTag":"latest"}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateConfigVolumes.mockResolvedValue(undefined);
        mockApplyTemplates.mockRejectedValue(new Error('Apply templates failed'));

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Env',
            type: 'DOCKER',
            config: { imageName: 'my-image', imageTag: 'latest' },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);

        // テンプレート適用失敗時も環境作成は成功する
        expect(response.status).toBe(201);
        // フィルタリングは有効化されない（ルール適用前に失敗したため）
        expect(mockUpdateFilterConfig).not.toHaveBeenCalled();
      });
    });

    describe('Dockerfile自動ビルド（imageSource=dockerfile）', () => {
      it('imageSource=dockerfileの場合、自動でDockerイメージをビルドする', async () => {
        const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile');

        // Dockerfile存在チェック - 成功
        mockAccess.mockResolvedValue(undefined);

        // docker build 成功
        mockDockerClient.buildImage.mockResolvedValue(undefined);

        const newEnvironment = {
          id: 'env-docker-build',
          name: 'Docker Build Env',
          type: 'DOCKER',
          description: 'Docker environment with Dockerfile',
          config: '{"imageSource":"dockerfile","dockerfilePath":"/path/to/Dockerfile","imageName":"claude-work-env-temp","imageTag":"latest"}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateConfigVolumes.mockResolvedValue(undefined);

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            description: 'Docker environment with Dockerfile',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.environment.id).toBe('env-docker-build');
        // buildImageが呼ばれたことを確認
        expect(mockDockerClient.buildImage).toHaveBeenCalled();
        // 認証ディレクトリが作成されたことを確認
        expect(mockCreateConfigVolumes).toHaveBeenCalledWith('env-docker-build');
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

      it('許可されていないパスの場合は400エラーを返す', async () => {
        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath: '/unauthorized/path/Dockerfile',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Dockerfile path is not allowed');
        expect(mockCreate).not.toHaveBeenCalled();
      });

      it('Dockerfileが存在しない場合は400エラーを返す', async () => {
        const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'nonexistent', 'Dockerfile');

        // Dockerfile存在チェック - 失敗
        mockAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        // パス情報は漏洩させない
        expect(data.error).toBe('Dockerfile not found');
        expect(data.error).not.toContain(dockerfilePath);
        // 環境は作成されない
        expect(mockCreate).not.toHaveBeenCalled();
      });

      it('Dockerビルドが失敗した場合は400エラーを返す', async () => {
        const dockerfilePath = path.join(ALLOWED_BASE_DIR, 'test-env', 'Dockerfile');

        // Dockerfile存在チェック - 成功
        mockAccess.mockResolvedValue(undefined);

        // docker build 失敗（onProgressでエラー）
        mockDockerClient.buildImage.mockImplementation(async (stream, options, onProgress) => {
          if (onProgress) {
            onProgress({ error: 'pull access denied for invalid-image' });
          }
          return Promise.reject(new Error('pull access denied for invalid-image'));
        });

        const request = new NextRequest('http://localhost:3000/api/environments', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Docker Build Env',
            type: 'DOCKER',
            config: {
              imageSource: 'dockerfile',
              dockerfilePath,
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
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockCreate.mockResolvedValue(newEnvironment);
        mockCreateConfigVolumes.mockResolvedValue(undefined);

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
        expect(mockDockerClient.buildImage).not.toHaveBeenCalled();
        // 認証ディレクトリは作成される
        expect(mockCreateConfigVolumes).toHaveBeenCalledWith('env-docker-existing');
      });
    });
  });
});
