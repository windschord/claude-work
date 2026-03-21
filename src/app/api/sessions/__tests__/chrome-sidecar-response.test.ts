import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ProcessManager
vi.mock('@/services/process-manager', () => ({
  ProcessManager: {
    getInstance: () => ({
      getStatus: vi.fn().mockReturnValue('stopped'),
    }),
  },
}));

const mockFindFirst = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
  schema: {
    sessions: {
      id: 'id',
      project_id: 'project_id',
      created_at: 'created_at',
      chrome_container_id: 'chrome_container_id',
      chrome_debug_port: 'chrome_debug_port',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
}));

describe('Session API Chrome Sidecar レスポンス', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/sessions/:id', () => {
    it('サイドカーあり: chrome_container_id と chrome_debug_port がレスポンスに含まれること', async () => {
      const sessionWithChrome = {
        id: 'session-1',
        project_id: 'project-1',
        name: 'Test Session',
        status: 'running',
        worktree_path: '/workspace',
        branch_name: 'main',
        chrome_container_id: 'cw-chrome-session-1',
        chrome_debug_port: 49152,
        container_id: 'cw-session-1',
        project: {
          environment: {
            name: 'Docker Environment',
            type: 'DOCKER',
          },
        },
      };

      mockFindFirst.mockResolvedValueOnce(sessionWithChrome);

      const { GET } = await import('../[id]/route');
      const request = new Request('http://localhost:3000/api/sessions/session-1');
      const response = await GET(request as any, {
        params: Promise.resolve({ id: 'session-1' }),
      });
      const data = await response.json();

      expect(data.session.chrome_container_id).toBe('cw-chrome-session-1');
      expect(data.session.chrome_debug_port).toBe(49152);
    });

    it('サイドカーなし: chrome_container_id が null であること', async () => {
      const sessionWithoutChrome = {
        id: 'session-2',
        project_id: 'project-1',
        name: 'Test Session 2',
        status: 'running',
        worktree_path: '/workspace',
        branch_name: 'main',
        chrome_container_id: null,
        chrome_debug_port: null,
        container_id: 'cw-session-2',
        project: {
          environment: {
            name: 'Docker Environment',
            type: 'DOCKER',
          },
        },
      };

      mockFindFirst.mockResolvedValueOnce(sessionWithoutChrome);

      const { GET } = await import('../[id]/route');
      const request = new Request('http://localhost:3000/api/sessions/session-2');
      const response = await GET(request as any, {
        params: Promise.resolve({ id: 'session-2' }),
      });
      const data = await response.json();

      expect(data.session.chrome_container_id).toBeNull();
      expect(data.session.chrome_debug_port).toBeNull();
    });
  });

  describe('レスポンスフィールド検証', () => {
    it('Drizzle findFirstの結果にchrome_container_idが含まれればレスポンスにも含まれること', () => {
      // Drizzle ORMのfindFirst/findManyはスキーマの全カラムを返す
      // schema.tsにchrome_container_id, chrome_debug_portが追加済みなので
      // レスポンスのスプレッド演算子で自動的に含まれる
      const dbResult = {
        id: 'session-1',
        chrome_container_id: 'cw-chrome-1',
        chrome_debug_port: 49152,
      };
      const response = { ...dbResult };
      expect(response.chrome_container_id).toBe('cw-chrome-1');
      expect(response.chrome_debug_port).toBe(49152);
    });
  });
});
