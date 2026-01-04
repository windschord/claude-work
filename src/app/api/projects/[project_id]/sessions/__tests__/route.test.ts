import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted()でモックオブジェクトを先に定義
const { mockPrisma, mockGitService, mockDockerService } = vi.hoisted(() => ({
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
    isDockerAvailable: vi.fn(),
    imageExists: vi.fn(),
    buildImage: vi.fn(),
    diagnoseDockerError: vi.fn(),
    diagnoseAuthIssues: vi.fn(),
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
      mockDockerService.diagnoseAuthIssues.mockReturnValue([]);
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
      mockDockerService.diagnoseAuthIssues.mockReturnValue([]);
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
      mockDockerService.diagnoseAuthIssues.mockReturnValue([]);
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
});
