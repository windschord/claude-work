import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// モック
const mockFindById = vi.fn();

vi.mock('@/services/environment-service', () => ({
  environmentService: {
    findById: (id: string) => mockFindById(id),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// AdapterFactory モック
const mockRemoveDockerAdapter = vi.fn();
const mockGetAdapter = vi.fn();

vi.mock('@/services/adapter-factory', () => ({
  AdapterFactory: {
    removeDockerAdapter: (id: string) => mockRemoveDockerAdapter(id),
    getAdapter: (env: unknown) => mockGetAdapter(env),
  },
}));

// db モック: select().from().innerJoin().where().all() チェーン
const mockAll = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ all: mockAll });
const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
  schema: {
    sessions: {
      id: 'sessions.id',
      name: 'sessions.name',
      status: 'sessions.status',
      container_id: 'sessions.container_id',
      project_id: 'sessions.project_id',
      worktree_path: 'sessions.worktree_path',
      session_state: 'sessions.session_state',
    },
    projects: {
      id: 'projects.id',
      environment_id: 'projects.environment_id',
    },
  },
}));

// drizzle-orm のモック
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', left: a, right: b })),
  isNotNull: vi.fn((a) => ({ type: 'isNotNull', column: a })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', conditions: args })),
}));

// テスト対象のインポートはモック設定後に行う
import { POST } from '../route';

describe('/api/environments/[id]/apply', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // デフォルトのチェーンを再設定
    mockAll.mockReturnValue([]);
    mockWhere.mockReturnValue({ all: mockAll });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  describe('POST /api/environments/:id/apply', () => {
    it('存在しない環境IDで404が返る', async () => {
      mockFindById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/environments/non-existent/apply', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('環境が見つかりません');
      expect(mockFindById).toHaveBeenCalledWith('non-existent');
      // AdapterFactoryは呼ばれない
      expect(mockRemoveDockerAdapter).not.toHaveBeenCalled();
    });

    it('実行中セッションがない場合、applied: 0を返す', async () => {
      const environment = {
        id: 'env-1',
        name: 'Docker Env',
        type: 'DOCKER',
        description: 'Test',
        config: '{}',
        auth_dir_path: '/data/environments/env-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindById.mockResolvedValue(environment);
      mockAll.mockReturnValue([]);

      const request = new NextRequest('http://localhost:3000/api/environments/env-1/apply', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.applied).toBe(0);
      expect(data.failed).toBe(0);
      expect(data.sessions).toEqual([]);
      // キャッシュ削除は呼ばれる
      expect(mockRemoveDockerAdapter).toHaveBeenCalledWith('env-1');
    });

    it('実行中セッションがある場合、再起動される', async () => {
      const environment = {
        id: 'env-docker-1',
        name: 'Docker Env',
        type: 'DOCKER',
        description: 'Docker environment',
        config: '{"imageName":"my-image"}',
        auth_dir_path: '/data/environments/env-docker-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const sessions = [
        {
          id: 'session-1',
          name: 'Test Session 1',
          status: 'running',
          container_id: 'container-abc123',
          worktree_path: '/worktrees/session-1',
        },
        {
          id: 'session-2',
          name: 'Test Session 2',
          status: 'running',
          container_id: 'container-def456',
          worktree_path: '/worktrees/session-2',
        },
      ];

      const mockAdapter = {
        restartSession: vi.fn().mockResolvedValue(undefined),
        hasSession: vi.fn().mockReturnValue(true),
      };

      mockFindById.mockResolvedValue(environment);
      mockAll.mockReturnValue(sessions);
      mockGetAdapter.mockReturnValue(mockAdapter);

      const request = new NextRequest('http://localhost:3000/api/environments/env-docker-1/apply', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'env-docker-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.applied).toBe(2);
      expect(data.failed).toBe(0);
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0]).toEqual({
        id: 'session-1',
        name: 'Test Session 1',
        status: 'restarted',
      });
      expect(data.sessions[1]).toEqual({
        id: 'session-2',
        name: 'Test Session 2',
        status: 'restarted',
      });
      // キャッシュ削除が呼ばれる
      expect(mockRemoveDockerAdapter).toHaveBeenCalledWith('env-docker-1');
      // アダプター取得が呼ばれる（キャッシュ削除後の新しいアダプター）
      expect(mockGetAdapter).toHaveBeenCalledWith(environment);
      // 各セッションの再起動が呼ばれる
      expect(mockAdapter.restartSession).toHaveBeenCalledTimes(2);
      expect(mockAdapter.restartSession).toHaveBeenCalledWith('session-1', '/worktrees/session-1');
      expect(mockAdapter.restartSession).toHaveBeenCalledWith('session-2', '/worktrees/session-2');
    });

    it('再起動失敗時、failed数が増える', async () => {
      const environment = {
        id: 'env-docker-2',
        name: 'Docker Env 2',
        type: 'DOCKER',
        description: 'Docker environment',
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-2',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const sessions = [
        {
          id: 'session-ok',
          name: 'OK Session',
          status: 'running',
          container_id: 'container-ok',
          worktree_path: '/worktrees/session-ok',
        },
        {
          id: 'session-fail',
          name: 'Fail Session',
          status: 'running',
          container_id: 'container-fail',
          worktree_path: '/worktrees/session-fail',
        },
      ];

      const mockAdapter = {
        restartSession: vi.fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Container start failed')),
        hasSession: vi.fn().mockReturnValue(true),
      };

      mockFindById.mockResolvedValue(environment);
      mockAll.mockReturnValue(sessions);
      mockGetAdapter.mockReturnValue(mockAdapter);

      const request = new NextRequest('http://localhost:3000/api/environments/env-docker-2/apply', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'env-docker-2' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.applied).toBe(1);
      expect(data.failed).toBe(1);
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0]).toEqual({
        id: 'session-ok',
        name: 'OK Session',
        status: 'restarted',
      });
      expect(data.sessions[1]).toEqual({
        id: 'session-fail',
        name: 'Fail Session',
        status: 'failed',
        error: 'Container start failed',
      });
    });

    it('サーバーエラーを処理する', async () => {
      mockFindById.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/environments/env-1/apply', {
        method: 'POST',
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('環境設定の即時適用に失敗しました');
    });
  });
});
