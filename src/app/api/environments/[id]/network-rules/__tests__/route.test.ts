import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted でモック関数とカスタムエラークラスを先に初期化
const { mockGetRules, mockCreateRule, mockUpdateRule, mockDeleteRule, MockValidationError } =
  vi.hoisted(() => {
    class MockValidationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
      }
    }
    return {
      mockGetRules: vi.fn(),
      mockCreateRule: vi.fn(),
      mockUpdateRule: vi.fn(),
      mockDeleteRule: vi.fn(),
      MockValidationError,
    };
  });

vi.mock('@/services/network-filter-service', () => ({
  ValidationError: MockValidationError,
  networkFilterService: {
    getRules: (environmentId: string) => mockGetRules(environmentId),
    createRule: (environmentId: string, input: unknown) => mockCreateRule(environmentId, input),
    updateRule: (ruleId: string, input: unknown) => mockUpdateRule(ruleId, input),
    deleteRule: (ruleId: string) => mockDeleteRule(ruleId),
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

// GET・POST は network-rules/route.ts からインポート
// PUT・DELETE は network-rules/[ruleId]/route.ts からインポート
import { GET, POST } from '../route';
import { PUT, DELETE } from '../[ruleId]/route';

const baseRule = {
  id: 'rule-uuid',
  environment_id: 'env-uuid',
  target: '*.github.com',
  port: 443,
  description: 'GitHub',
  enabled: true,
  created_at: new Date('2026-03-03T00:00:00Z'),
  updated_at: new Date('2026-03-03T00:00:00Z'),
};

describe('/api/environments/[id]/network-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // PUT/DELETE のスコープチェック（getRules）用デフォルト設定
    mockGetRules.mockResolvedValue([baseRule]);
  });

  // ==================== GET /api/environments/[id]/network-rules ====================

  describe('GET /api/environments/[id]/network-rules', () => {
    it('ルール一覧を返す（200）', async () => {
      mockGetRules.mockResolvedValue([baseRule]);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules'
      );
      const response = await GET(request, { params: Promise.resolve({ id: 'env-uuid' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rules).toHaveLength(1);
      expect(data.rules[0].id).toBe('rule-uuid');
      expect(mockGetRules).toHaveBeenCalledWith('env-uuid');
    });

    it('環境が存在しない場合404を返す', async () => {
      mockGetRules.mockRejectedValue(new Error('Environment not found'));

      const request = new NextRequest(
        'http://localhost:3000/api/environments/non-existent/network-rules'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Environment not found');
    });
  });

  // ==================== POST /api/environments/[id]/network-rules ====================

  describe('POST /api/environments/[id]/network-rules', () => {
    it('ルールを作成して201を返す', async () => {
      mockCreateRule.mockResolvedValue(baseRule);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules',
        {
          method: 'POST',
          body: JSON.stringify({ target: '*.github.com', port: 443, description: 'GitHub' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'env-uuid' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.rule.id).toBe('rule-uuid');
      expect(mockCreateRule).toHaveBeenCalledWith('env-uuid', {
        target: '*.github.com',
        port: 443,
        description: 'GitHub',
      });
    });

    it('不正なtarget形式で400を返す', async () => {
      mockCreateRule.mockRejectedValue(new MockValidationError('Invalid target format'));

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules',
        {
          method: 'POST',
          body: JSON.stringify({ target: '!!!invalid!!!' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'env-uuid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });

    it('リクエストボディが空で400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'env-uuid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });
  });

  // ==================== PUT /api/environments/[id]/network-rules/[ruleId] ====================

  describe('PUT /api/environments/[id]/network-rules/[ruleId]', () => {
    it('ルールを更新して200を返す', async () => {
      const updatedRule = { ...baseRule, target: 'api.anthropic.com', description: 'Claude API' };
      mockUpdateRule.mockResolvedValue(updatedRule);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/rule-uuid',
        {
          method: 'PUT',
          body: JSON.stringify({ target: 'api.anthropic.com', description: 'Claude API' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'env-uuid', ruleId: 'rule-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rule.target).toBe('api.anthropic.com');
      expect(mockUpdateRule).toHaveBeenCalledWith('rule-uuid', {
        target: 'api.anthropic.com',
        description: 'Claude API',
      });
    });

    it('ルールが存在しない場合404を返す', async () => {
      mockUpdateRule.mockRejectedValue(new Error('Rule not found'));

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/non-existent',
        {
          method: 'PUT',
          body: JSON.stringify({ enabled: false }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'env-uuid', ruleId: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Rule not found');
    });
  });

  // ==================== DELETE /api/environments/[id]/network-rules/[ruleId] ====================

  describe('DELETE /api/environments/[id]/network-rules/[ruleId]', () => {
    it('ルールを削除して204を返す', async () => {
      mockDeleteRule.mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/rule-uuid',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'env-uuid', ruleId: 'rule-uuid' }),
      });

      expect(response.status).toBe(204);
      expect(mockDeleteRule).toHaveBeenCalledWith('rule-uuid');
    });

    it('ルールが存在しない場合404を返す', async () => {
      mockDeleteRule.mockRejectedValue(new Error('Rule not found'));

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/non-existent',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'env-uuid', ruleId: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Rule not found');
    });
  });
});
