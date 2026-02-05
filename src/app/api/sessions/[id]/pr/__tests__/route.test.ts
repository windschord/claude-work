import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => []),
          run: vi.fn(),
        })),
      })),
    })),
  },
  schema: {
    sessions: { id: 'id' },
  },
}));

vi.mock('@/services/gh-cli', () => ({
  createPR: vi.fn(),
  getPRStatus: vi.fn(),
  extractPRNumber: vi.fn(),
}));

import { db } from '@/lib/db';
import { createPR, getPRStatus, extractPRNumber } from '@/services/gh-cli';

const mockDb = db as unknown as {
  query: {
    sessions: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  update: ReturnType<typeof vi.fn>;
};

const mockCreatePR = createPR as unknown as ReturnType<typeof vi.fn>;
const mockGetPRStatus = getPRStatus as unknown as ReturnType<typeof vi.fn>;
const mockExtractPRNumber = extractPRNumber as unknown as ReturnType<typeof vi.fn>;

describe('PR API Route', () => {
  const mockSession = {
    id: 'session-123',
    project_id: 'project-456',
    name: 'test-session',
    status: 'running',
    worktree_path: '/path/to/.worktrees/test-session',
    branch_name: 'claude-work/test-session',
    pr_url: null,
    pr_number: null,
    pr_status: null,
    project: {
      path: '/path/to/project',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/sessions/[id]/pr', () => {
    it('PRを正常に作成できる', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue(mockSession);
      mockCreatePR.mockReturnValue('https://github.com/owner/repo/pull/123');
      mockExtractPRNumber.mockReturnValue(123);

      const mockUpdateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue([{
              ...mockSession,
              pr_url: 'https://github.com/owner/repo/pull/123',
              pr_number: 123,
              pr_status: 'open',
            }]),
          }),
        }),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Test PR',
            body: 'Test description',
          }),
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: 'session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.pr_url).toBe('https://github.com/owner/repo/pull/123');
      expect(data.pr_number).toBe(123);
      expect(data.pr_status).toBe('open');
    });

    it('セッションが見つからない場合は404を返す', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Test PR',
          }),
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: 'session-123' }) });

      expect(response.status).toBe(404);
    });

    it('タイトルが未指定の場合は400を返す', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: 'session-123' }) });

      expect(response.status).toBe(400);
    });

    it('gh CLI未インストール時に503を返す', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue(mockSession);
      mockCreatePR.mockImplementation(() => {
        const error = new Error('GitHub CLI (gh) is not installed') as NodeJS.ErrnoException;
        error.code = 'GH_NOT_INSTALLED';
        throw error;
      });

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Test PR',
          }),
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: 'session-123' }) });

      expect(response.status).toBe(503);
    });

    it('既にPRが存在する場合は409を返す', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue({
        ...mockSession,
        pr_url: 'https://github.com/owner/repo/pull/100',
        pr_number: 100,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Test PR',
          }),
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: 'session-123' }) });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/sessions/[id]/pr', () => {
    it('PRステータスを正常に取得できる', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue({
        ...mockSession,
        pr_url: 'https://github.com/owner/repo/pull/123',
        pr_number: 123,
        pr_status: 'open',
      });
      mockGetPRStatus.mockReturnValue({ state: 'open', merged: false });

      const mockUpdateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn(),
          }),
        }),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr'
      );

      const response = await GET(request, { params: Promise.resolve({ id: 'session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pr_status).toBe('open');
    });

    it('PRが存在しない場合は404を返す', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/sessions/session-123/pr'
      );

      const response = await GET(request, { params: Promise.resolve({ id: 'session-123' }) });

      expect(response.status).toBe(404);
    });

  });
});
