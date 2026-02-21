import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// db モック: select().from().where().innerJoin().all() チェーン
const mockAll = vi.fn();
const mockInnerJoin = vi.fn().mockReturnValue({ all: mockAll });
const mockWhere = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
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
import { GET } from '../route';

describe('/api/environments/[id]/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのチェーンを再設定
    mockAll.mockReturnValue([]);
    mockInnerJoin.mockReturnValue({ all: mockAll });
    mockWhere.mockReturnValue({ innerJoin: mockInnerJoin });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/environments/:id/sessions', () => {
    it('存在しない環境IDで404が返る', async () => {
      mockFindById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/environments/non-existent/sessions');
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('環境が見つかりません');
      expect(mockFindById).toHaveBeenCalledWith('non-existent');
      // DBクエリは実行されない
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('セッションがない場合、空配列と count: 0 を返す', async () => {
      const environment = {
        id: 'env-1',
        name: 'Docker Env',
        type: 'DOCKER',
        description: 'Test',
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindById.mockResolvedValue(environment);
      mockAll.mockReturnValue([]);

      const request = new NextRequest('http://localhost:3000/api/environments/env-1/sessions');
      const response = await GET(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toEqual([]);
      expect(data.count).toBe(0);
      expect(mockFindById).toHaveBeenCalledWith('env-1');
      expect(mockSelect).toHaveBeenCalled();
    });

    it('実行中セッション（container_id が non-null）がある場合、一覧を返す', async () => {
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
        },
        {
          id: 'session-2',
          name: 'Test Session 2',
          status: 'running',
          container_id: 'container-def456',
        },
      ];

      mockFindById.mockResolvedValue(environment);
      mockAll.mockReturnValue(sessions);

      const request = new NextRequest('http://localhost:3000/api/environments/env-docker-1/sessions');
      const response = await GET(request, { params: Promise.resolve({ id: 'env-docker-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0].id).toBe('session-1');
      expect(data.sessions[0].container_id).toBe('container-abc123');
      expect(data.sessions[1].id).toBe('session-2');
      expect(data.count).toBe(2);
      expect(mockFindById).toHaveBeenCalledWith('env-docker-1');
    });

    it('サーバーエラーを処理する', async () => {
      mockFindById.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/environments/env-1/sessions');
      const response = await GET(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('セッション一覧の取得に失敗しました');
    });
  });
});
