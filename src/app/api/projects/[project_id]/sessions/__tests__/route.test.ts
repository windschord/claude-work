import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted()でモックオブジェクトを先に定義
const { mockPrisma, mockGitService, mockDockerService, mockEnvironmentService } = vi.hoisted(() => ({
  mockPrisma: {
    project: {
      findUnique: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    prompt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
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

// Prismaモック
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
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

describe('POST /api/projects/[project_id]/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      path: '/path/to/project',
    });

    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.findMany.mockResolvedValue([]);
    mockPrisma.session.create.mockResolvedValue({
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
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            docker_mode: false,
          }),
        })
      );
    });

    it('should create session with dockerMode=true when specified and Docker available', async () => {
      mockDockerService.diagnoseDockerError.mockResolvedValue(null); // No error = Docker available
      mockDockerService.diagnoseAuthIssues.mockResolvedValue([]);
      mockDockerService.imageExists.mockResolvedValue(true);

      mockPrisma.session.create.mockResolvedValue({
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
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            docker_mode: true,
          }),
        })
      );
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

      mockPrisma.session.create.mockResolvedValue({
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
      mockPrisma.session.create.mockResolvedValue({
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
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            environment_id: 'env-docker-1',
          }),
        })
      );
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
      mockPrisma.session.create.mockResolvedValue({
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
      // environment_idは指定されていないのでnull
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            environment_id: null,
            docker_mode: false,
          }),
        })
      );
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
      mockPrisma.session.create.mockResolvedValue({
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
      // environment_idが設定され、dockerModeは無視される
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            environment_id: 'env-host-1',
            docker_mode: false,
          }),
        })
      );
      // dockerModeが指定されてもenvironment_idがあればDocker診断は呼ばれない
      expect(mockDockerService.diagnoseDockerError).not.toHaveBeenCalled();
    });

    it('should log deprecation warning when using dockerMode without environment_id', async () => {
      const { logger } = await import('@/lib/logger');

      mockDockerService.diagnoseDockerError.mockResolvedValue(null);
      mockDockerService.diagnoseAuthIssues.mockResolvedValue([]);
      mockDockerService.imageExists.mockResolvedValue(true);

      mockPrisma.session.create.mockResolvedValue({
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
