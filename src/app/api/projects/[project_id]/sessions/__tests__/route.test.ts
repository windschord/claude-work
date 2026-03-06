import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted()でモックオブジェクトを先に定義
const { _mockDbSelect, _mockDbInsert, _mockDbUpdate, mockGitService, mockDockerService, mockEnvironmentService, mockDockerGitService } = vi.hoisted(() => ({
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
  mockDockerGitService: {
    createWorktree: vi.fn(),
  },
}));

// Drizzleモック
vi.mock('@/lib/db', () => {
  const mockSelectGet = vi.fn();
  const mockSelectAll = vi.fn();
  const mockInsertGet = vi.fn();
  const mockInsertRun = vi.fn();
  const mockInsertValues = vi.fn();
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
        values: mockInsertValues.mockImplementation(() => ({
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
      _mockInsertValues: mockInsertValues,
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

// DockerGitServiceモック
vi.mock('@/services/docker-git-service', () => ({
  DockerGitService: class MockDockerGitService {
    createWorktree = mockDockerGitService.createWorktree;
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
  _mockInsertValues: ReturnType<typeof vi.fn>;
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
      environment_id: 'env-docker-1',
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
    mockDockerGitService.createWorktree.mockResolvedValue({ success: true, worktreePath: '/repo/.worktrees/session-name' });

    // デフォルト環境モック
    mockEnvironmentService.findById.mockResolvedValue({
      id: 'env-docker-1',
      name: 'Docker Env',
      type: 'DOCKER',
      description: null,
      config: '{}',
      auth_dir_path: '/data/environments/env-docker-1',
      created_at: new Date(),
      updated_at: new Date(),
    });
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

    it('should create session ignoring dockerMode=true when project has environment_id', async () => {
      // プロジェクトに environment_id がある場合、dockerMode は無視される
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      // プロジェクトに environment_id があるため、レガシーDockerMode パスには入らない
      expect(mockDockerService.diagnoseDockerError).not.toHaveBeenCalled();
      expect(mockDockerService.imageExists).not.toHaveBeenCalled();
    });

    it('should return 400 when dockerMode=true but project has no environment_id', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('実行環境が設定されていません');
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

    it('should return 400 when project environment_id references non-existent environment', async () => {
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

      // プロジェクトのenvironment_idが存在しない環境を参照している場合は400エラー
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('プロジェクトに設定された実行環境が見つかりません');
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should return 400 when project has no environment_id', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
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

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('実行環境が設定されていません');
    });

    it('project environment_id takes priority over dockerMode parameter', async () => {
      const mockEnvironment = {
        id: 'env-host-1',
        name: 'Host Env',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
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

    it('should return 400 when using dockerMode without project environment_id', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', dockerMode: true }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('実行環境が設定されていません');
    });

    it('should return 400 when project has no environment_id regardless of request environment_id', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'env-docker-req' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      expect(mockEnvironmentService.findById).not.toHaveBeenCalled();
    });

    it('should return 400 when project has no environment_id even with non-existent request environment_id', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: null,
        clone_location: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'non-existent-req' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      expect(mockEnvironmentService.findById).not.toHaveBeenCalled();
    });

    it('project environment_id takes priority over requestEnvironmentId', async () => {
      const projectEnvironment = {
        id: 'env-project',
        name: 'Project Env',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
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

    it('should return 400 when environment_id is not a string', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 123 }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('environment_id must be a non-empty string');
    });

    it('should return 400 when environment_id is an empty string', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: '' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('environment_id must be a non-empty string');
    });
  });

  describe('POST - Docker volume validation', () => {
    it('clone_location=docker かつ docker_volume_id=null の場合 400エラーを返す', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'env-docker-1',
        clone_location: 'docker',
        docker_volume_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Docker volume not configured');
      expect(json.message).toContain('Dockerボリュームが設定されていません');
      expect(mockDockerGitService.createWorktree).not.toHaveBeenCalled();
    });

    it('clone_location=docker かつ docker_volume_id が設定済みの場合は正常処理される', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'env-docker-1',
        clone_location: 'docker',
        docker_volume_id: 'cw-repo-test',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      // バリデーションを通過しセッションが正常に作成される
      expect(response.status).toBe(201);
      expect(mockDockerGitService.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          dockerVolumeId: 'cw-repo-test',
        }),
      );
    });

    it('clone_location=host の場合 docker_volume_id=null でもエラーにならない', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        environment_id: 'env-docker-1',
        clone_location: 'host',
        docker_volume_id: null,
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      // clone_location=host の場合はボリュームバリデーションをスキップしてセッションが正常に作成される
      expect(response.status).toBe(201);
      expect(mockDockerGitService.createWorktree).not.toHaveBeenCalled();
    });
  });

  describe('worktree option', () => {
    it('should skip worktree creation when session claude_code_options has worktree: true', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        claude_code_options: '{}',
        environment_id: 'env-docker-1',
      });

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/project',
        branch_name: '',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: { worktree: true },
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockGitService.createWorktree).not.toHaveBeenCalled();
    });

    it('should skip worktree creation when project claude_code_options has worktree: true', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        claude_code_options: '{"worktree":true}',
        environment_id: 'env-docker-1',
      });

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/project',
        branch_name: '',
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
      expect(mockGitService.createWorktree).not.toHaveBeenCalled();
    });

    it('should insert session with project path as worktree_path and empty branch_name when worktree is true', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        claude_code_options: '{}',
        environment_id: 'env-docker-1',
      });

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/project',
        branch_name: '',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: { worktree: true },
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      const insertPayload = mockDb._mockInsertValues.mock.calls[0][0];
      expect(insertPayload.worktree_path).toBe('/path/to/project');
      expect(insertPayload.branch_name).toBe('');
    });

    it('should insert session with project path as worktree_path and empty branch_name when worktree is string', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        claude_code_options: '{}',
        environment_id: 'env-docker-1',
      });

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/project',
        branch_name: '',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: { worktree: 'my-feature' },
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      const insertPayload = mockDb._mockInsertValues.mock.calls[0][0];
      expect(insertPayload.worktree_path).toBe('/path/to/project');
      expect(insertPayload.branch_name).toBe('');
    });

    it('should set worktree_path to project path when session worktree option is string', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        claude_code_options: '{}',
        environment_id: 'env-docker-1',
      });

      mockDb._mockInsertGet.mockReturnValue({
        id: 'session-1',
        project_id: 'project-1',
        name: 'happy-panda',
        status: 'initializing',
        worktree_path: '/path/to/project',
        branch_name: '',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          claude_code_options: { worktree: 'my-feature' },
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockGitService.createWorktree).not.toHaveBeenCalled();
    });

    it('should create worktree normally when worktree option is not set', async () => {
      mockDb._mockSelectGet.mockReturnValue({
        id: 'project-1',
        name: 'Test Project',
        path: '/path/to/project',
        claude_code_options: '{}',
        environment_id: 'env-docker-1',
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
      expect(mockGitService.createWorktree).toHaveBeenCalled();
    });
  });
});
