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
        environment_id: 'env-docker-1',
      });

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'env-docker-1' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      expect(mockEnvironmentService.findById).toHaveBeenCalledWith('env-docker-1');
    });

    it('should return 400 for non-existent environment_id', async () => {
      mockEnvironmentService.findById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Claude', environment_id: 'non-existent' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Environment not found');
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

    it('environment_id takes priority over dockerMode parameter', async () => {
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
        environment_id: 'env-host-1',
      });

      // environment_idとdockerMode両方指定した場合、environment_idが優先
      const request = new NextRequest('http://localhost/api/projects/project-1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          environment_id: 'env-host-1',
          dockerMode: true,
        }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ project_id: 'project-1' }),
      });

      expect(response.status).toBe(201);
      // dockerModeが指定されてもenvironment_idがあればDocker診断は呼ばれない
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
  });
});
