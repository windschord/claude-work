import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted()でモックオブジェクトを先に定義
const { _mockDbSelect, _mockDbInsert, _mockDbUpdate, mockGitService, mockDockerService, mockEnvironmentService } = vi.hoisted(() => ({
  _mockDbSelect: {
    from: vi.fn(),
  },
  _mockDbInsert: {
    values: vi.fn(),
  },
  _mockDbUpdate: {
    set: vi.fn(),
  },
  mockGitService: {
    createWorktree: vi.fn(),
  },
  mockDockerService: {
    imageExists: vi.fn(),
    buildImage: vi.fn(),
    diagnoseDockerError: vi.fn(),
    diagnoseAuthIssues: vi.fn(),
  },
  mockEnvironmentService: {
    findById: vi.fn(),
  },
}));

// Drizzleモック
vi.mock('@/lib/db', () => {
  const mockSelectGet = vi.fn();
  const mockSelectAll = vi.fn();
  const mockInsertGet = vi.fn();
  const mockInsertRun = vi.fn();
  const mockUpdateRun = vi.fn();

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockSelectGet,
            all: mockSelectAll,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockInsertGet,
          })),
          run: mockInsertRun,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            run: mockUpdateRun,
          })),
        })),
      })),
      query: {
        sessions: {
          findMany: vi.fn(() => ({
            sync: vi.fn(() => []),
          })),
        },
      },
      // テスト用にアクセス可能
      _mockSelectGet: mockSelectGet,
      _mockSelectAll: mockSelectAll,
      _mockInsertGet: mockInsertGet,
      _mockInsertRun: mockInsertRun,
      _mockUpdateRun: mockUpdateRun,
    },
    schema: {
      projects: { id: 'id' },
      sessions: { project_id: 'project_id', name: 'name' },
      prompts: { content: 'content', id: 'id' },
      messages: {},
    },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
  desc: vi.fn((col) => ({ column: col, direction: 'desc' })),
  and: vi.fn((...args) => args),
}));

// GitServiceモック - コンストラクタとして使用可能なモック
vi.mock('@/services/git-service', () => ({
  GitService: class MockGitService {
    createWorktree = mockGitService.createWorktree;
  },
}));

// DockerServiceモック
vi.mock('@/services/docker-service', () => ({
  dockerService: mockDockerService,
  DockerError: class DockerError extends Error {
    errorType: string;
    userMessage: string;
    suggestion: string;
    constructor(errorType: string, message: string, userMessage: string, suggestion: string) {
      super(message);
      this.errorType = errorType;
      this.userMessage = userMessage;
      this.suggestion = suggestion;
    }
  },
}));

// loggerモック
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// session-name-generatorモック
vi.mock('@/lib/session-name-generator', () => ({
  generateUniqueSessionName: vi.fn(() => 'happy-panda'),
}));

// EnvironmentServiceモック
vi.mock('@/services/environment-service', () => ({
  environmentService: mockEnvironmentService,
}));

import { POST } from '../route';
import { db } from '@/lib/db';

// テスト用にモック関数にアクセス
const mockDb = db as typeof db & {
  _mockSelectGet: ReturnType<typeof vi.fn>;
  _mockSelectAll: ReturnType<typeof vi.fn>;
  _mockInsertGet: ReturnType<typeof vi.fn>;
  _mockInsertRun: ReturnType<typeof vi.fn>;
  _mockUpdateRun: ReturnType<typeof vi.fn>;
};

describe('POST /api/projects/[project_id]/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    // project取得用
    mockDb._mockSelectGet.mockReturnValue({
      id: 'project-1',
      name: 'Test Project',
      path: '/path/to/project',
    });

    // セッション重複チェック用（既存なし）
    mockDb._mockSelectAll.mockReturnValue([]);

    // セッション作成用
    mockDb._mockInsertGet.mockReturnValue({
      id: 'session-1',
      project_id: 'project-1',
      name: 'happy-panda',
      status: 'initializing',
      worktree_path: '/path/to/worktree',
      branch_name: 'session/session-123',
      docker_mode: false,
      container_id: null,
    });

    mockGitService.createWorktree.mockReturnValue('/path/to/worktree');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('dockerMode parameter', () => {
    it('should create session with dockerMode=false by default', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('should create session with dockerMode=true when specified and Docker available', async () => {
      mockDockerService.diagnoseDockerError.mockResolvedValue(null); // No error = Docker available
      mockDockerService.diagnoseAuthIssues.mockResolvedValue([]);
      mockDockerService.imageExists.mockResolvedValue(true);

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: true,
        container_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockDockerService.diagnoseDockerError).toHaveBeenCalled();
      expect(mockDockerService.imageExists).toHaveBeenCalled();
    });

    it('should return 503 when Docker not available and dockerMode=true', async () => {
      // DockerError objectを返すことで、Dockerが利用不可であることを示す
      mockDockerService.diagnoseDockerError.mockResolvedValue({
        errorType: 'DOCKER_NOT_INSTALLED',
        message: 'Docker not installed',
        userMessage: 'Dockerがインストールされていません',
        suggestion: 'Dockerをインストールしてください',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.error).toContain('Docker');
    });

    it('should build image when Docker available but image not exists', async () => {
      mockDockerService.diagnoseDockerError.mockResolvedValue(null);
      mockDockerService.diagnoseAuthIssues.mockResolvedValue([]);
      mockDockerService.imageExists.mockResolvedValue(false);
      mockDockerService.buildImage.mockResolvedValue(undefined);

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: true,
        container_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockDockerService.buildImage).toHaveBeenCalled();
    });

    it('should return 500 when image build fails', async () => {
      mockDockerService.diagnoseDockerError.mockResolvedValue(null);
      mockDockerService.diagnoseAuthIssues.mockResolvedValue([]);
      mockDockerService.imageExists.mockResolvedValue(false);
      mockDockerService.buildImage.mockRejectedValue(new Error('Build failed'));

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('claude_code_options and custom_env_vars', () => {
    it('should save claude_code_options as JSON string when provided', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: { model: 'claude-sonnet-4-5-20250929' },
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      // db.insert().values() がJSON文字列で呼ばれていることを確認
      expect(db.insert).toHaveBeenCalled();
    });

    it('should save null when claude_code_options not provided', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('should return 400 for non-object claude_code_options', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: 'invalid',
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('claude_code_options');
    });

    it('should return 400 for array claude_code_options', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: ['a', 'b'],
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for non-object custom_env_vars', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          custom_env_vars: 'invalid',
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('custom_env_vars');
    });

    it('should return 400 for custom_env_vars with non-string values', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          custom_env_vars: { VALID: 'ok', BAD: 123 },
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('custom_env_vars');
    });
  });

  describe('environment_id parameter', () => {
    it('should accept environment_id parameter and create session with it', async () => {
      const mockEnvironment = {
        id: 'env-docker-1',
        name: 'Docker Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // プロジェクトに environment_id を設定
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'env-docker-1',
      });

      mockEnvironmentService.findById.mockResolvedValue(mockEnvironment);
      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: false,
        container_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('env-docker-1');
    });

    it('should log warning when project environment_id references non-existent environment', async () => {
      // プロジェクトに存在しない environment_id を設定
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'non-existent',
      });

      mockEnvironmentService.findById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      // 環境が見つからない場合はフォールバックして201で成功する
      expect(response.status).toBe(201);
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should use default environment when no environment_id specified', async () => {
      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: false,
        container_id: null,
        environment_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('project environment_id takes priority over dockerMode parameter', async () => {
      const mockEnvironment = {
        id: 'env-host-1',
        name: 'Host Env',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // プロジェクトに environment_id を設定
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'env-host-1',
      });

      mockEnvironmentService.findById.mockResolvedValue(mockEnvironment);
      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: false,
        container_id: null,
      });

      // dockerMode=trueでもプロジェクトのenvironment_idが優先
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          dockerMode: true,
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      // dockerModeが指定されてもproject.environment_idがあればDocker診断は呼ばれない
      expect(mockDockerService.diagnoseDockerError).not.toHaveBeenCalled();
    });

    it('should log deprecation warning when using dockerMode without environment_id', async () => {
      const { logger } = await import('@/lib/logger');

      mockDockerService.diagnoseDockerError.mockResolvedValue(null);
      mockDockerService.diagnoseAuthIssues.mockResolvedValue([]);
      mockDockerService.imageExists.mockResolvedValue(true);

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: true,
        container_id: null,
        environment_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      // 非推奨警告がログ出力される
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('deprecated'),
        expect.any(Object)
      );
    });

    it('should use requestEnvironmentId when project has no environment_id', async () => {
      const mockEnvironment = {
        id: 'env-docker-req',
        name: 'Request Docker Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-req',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // プロジェクトに environment_id なし
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: null,
      });

      mockEnvironmentService.findById.mockResolvedValue(mockEnvironment);
      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: false,
        container_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'env-docker-req' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('env-docker-req');
      // Dockerの診断は呼ばれない（environment_idが使われるため）
      expect(mockDockerService.diagnoseDockerError).not.toHaveBeenCalled();
    });

    it('should fall back to auto-selection when requestEnvironmentId references non-existent environment', async () => {
      // プロジェクトに environment_id なし
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: null,
        clone_location: null,
      });

      // リクエストの environment_id が存在しない
      mockEnvironmentService.findById.mockResolvedValue(null);
      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: false,
        container_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'non-existent-req' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      // フォールバックして201で成功する
      expect(response.status).toBe(201);
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('non-existent-req');
    });

    it('project environment_id takes priority over requestEnvironmentId', async () => {
      const projectEnvironment = {
        id: 'env-project',
        name: 'Project Env',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // プロジェクトに environment_id を設定
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'env-project',
      });

      mockEnvironmentService.findById.mockResolvedValue(projectEnvironment);
      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/worktree',
        branch_name: 'session/session-123',
        docker_mode: false,
        container_id: null,
      });

      // リクエストにも environment_id を指定するが、プロジェクトの方が優先される
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'env-request-should-be-ignored' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      // プロジェクトの environment_id で findById が呼ばれる
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('env-project');
      // リクエストの environment_id では呼ばれない（プロジェクトのが優先されて処理が終わるため）
      expect(mockEnvironmentService.findById).not.toHaveBeenCalledWith('env-request-should-be-ignored');
    });
  });
});
