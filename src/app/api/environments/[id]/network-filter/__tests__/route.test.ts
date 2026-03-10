import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.hoisted でモック関数を先に初期化
const {
  mockGetFilterConfig,
  mockUpdateFilterConfig,
  mockTestConnection,
  mockGetDefaultTemplates,
  mockApplyTemplates,
} = vi.hoisted(() => {
  return {
    mockGetFilterConfig: vi.fn(),
    mockUpdateFilterConfig: vi.fn(),
    mockTestConnection: vi.fn(),
    mockGetDefaultTemplates: vi.fn(),
    mockApplyTemplates: vi.fn(),
  };
});

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    getFilterConfig: (environmentId: string) => mockGetFilterConfig(environmentId),
    updateFilterConfig: (environmentId: string, enabled: boolean) =>
      mockUpdateFilterConfig(environmentId, enabled),
    testConnection: (environmentId: string, target: string, port?: number) =>
      mockTestConnection(environmentId, target, port),
    getDefaultTemplates: () => mockGetDefaultTemplates(),
    applyTemplates: (environmentId: string, rules: unknown) =>
      mockApplyTemplates(environmentId, rules),
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

// 各ルートからインポート
import { GET as getFilterConfig, PUT as putFilterConfig } from '../route';
import { POST as postFilterTest } from '../test/route';
import { GET as getTemplates } from '../../network-rules/templates/route';
import { POST as postApplyTemplates } from '../../network-rules/templates/apply/route';

const baseConfig = {
  id: 'config-uuid',
  environment_id: 'env-uuid',
  enabled: false,
  created_at: new Date('2026-03-03T00:00:00Z'),
  updated_at: new Date('2026-03-03T00:00:00Z'),
};

const baseRule = {
  id: 'rule-uuid',
  environment_id: 'env-uuid',
  target: 'api.anthropic.com',
  port: 443,
  description: 'Claude API',
  enabled: true,
  created_at: new Date('2026-03-03T00:00:00Z'),
  updated_at: new Date('2026-03-03T00:00:00Z'),
};

const defaultTemplates = [
  {
    category: 'Anthropic API',
    rules: [{ target: 'api.anthropic.com', port: 443, description: 'Claude API' }],
  },
  {
    category: 'npm',
    rules: [
      { target: '*.npmjs.org', port: 443, description: 'npm registry' },
      { target: '*.npmjs.com', port: 443, description: 'npm registry' },
    ],
  },
];

describe('/api/environments/[id]/network-filter および templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== GET /api/environments/[id]/network-filter ====================

  describe('GET /api/environments/[id]/network-filter', () => {
    it('フィルタリング設定を返す（200）', async () => {
      mockGetFilterConfig.mockResolvedValue(baseConfig);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter'
      );
      const response = await getFilterConfig(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config.id).toBe('config-uuid');
      expect(data.config.environment_id).toBe('env-uuid');
      expect(data.config.enabled).toBe(false);
      expect(mockGetFilterConfig).toHaveBeenCalledWith('env-uuid');
    });

    it('未設定時はconfig: nullを返す', async () => {
      mockGetFilterConfig.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter'
      );
      const response = await getFilterConfig(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toBeNull();
    });
  });

  // ==================== PUT /api/environments/[id]/network-filter ====================

  describe('PUT /api/environments/[id]/network-filter', () => {
    it('フィルタリングを有効にして200を返す', async () => {
      const enabledConfig = { ...baseConfig, enabled: true };
      mockUpdateFilterConfig.mockResolvedValue(enabledConfig);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter',
        {
          method: 'PUT',
          body: JSON.stringify({ enabled: true }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await putFilterConfig(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config.enabled).toBe(true);
      expect(mockUpdateFilterConfig).toHaveBeenCalledWith('env-uuid', true);
    });

    it('フィルタリングを無効にして200を返す', async () => {
      mockUpdateFilterConfig.mockResolvedValue(baseConfig);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter',
        {
          method: 'PUT',
          body: JSON.stringify({ enabled: false }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await putFilterConfig(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config.enabled).toBe(false);
      expect(mockUpdateFilterConfig).toHaveBeenCalledWith('env-uuid', false);
    });

    it('enabledフィールドがない場合400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter',
        {
          method: 'PUT',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await putFilterConfig(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(mockUpdateFilterConfig).not.toHaveBeenCalled();
    });
  });

  // ==================== POST /api/environments/[id]/network-filter/test ====================

  describe('POST /api/environments/[id]/network-filter/test', () => {
    it('許可される宛先でallowed: trueを返す', async () => {
      mockTestConnection.mockResolvedValue({
        allowed: true,
        matchedRule: {
          id: 'rule-uuid',
          target: 'api.anthropic.com',
          port: 443,
          description: 'Claude API',
        },
        note: 'dry-run',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter/test',
        {
          method: 'POST',
          body: JSON.stringify({ target: 'api.anthropic.com', port: 443 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await postFilterTest(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result.allowed).toBe(true);
      expect(data.result.matchedRule).toBeDefined();
      expect(mockTestConnection).toHaveBeenCalledWith('env-uuid', 'api.anthropic.com', 443);
    });

    it('ブロックされる宛先でallowed: falseを返す', async () => {
      mockTestConnection.mockResolvedValue({ allowed: false, note: 'dry-run' });

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter/test',
        {
          method: 'POST',
          body: JSON.stringify({ target: 'malicious.example.com' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await postFilterTest(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result.allowed).toBe(false);
      expect(data.result.matchedRule).toBeUndefined();
      expect(mockTestConnection).toHaveBeenCalledWith('env-uuid', 'malicious.example.com', undefined);
    });

    it('targetが未指定の場合400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-filter/test',
        {
          method: 'POST',
          body: JSON.stringify({ port: 443 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await postFilterTest(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(mockTestConnection).not.toHaveBeenCalled();
    });
  });

  // ==================== GET /api/environments/[id]/network-rules/templates ====================

  describe('GET /api/environments/[id]/network-rules/templates', () => {
    it('デフォルトテンプレート一覧を返す（200）', async () => {
      mockGetDefaultTemplates.mockReturnValue(defaultTemplates);

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/templates'
      );
      const response = await getTemplates(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].category).toBe('Anthropic API');
      expect(data.templates[0].rules).toHaveLength(1);
      expect(mockGetDefaultTemplates).toHaveBeenCalled();
    });
  });

  // ==================== POST /api/environments/[id]/network-rules/templates/apply ====================

  describe('POST /api/environments/[id]/network-rules/templates/apply', () => {
    it('テンプレートルールを一括追加して201を返す', async () => {
      mockApplyTemplates.mockResolvedValue({
        created: 2,
        skipped: 0,
        rules: [baseRule, { ...baseRule, id: 'rule-uuid-2', target: '*.github.com' }],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/templates/apply',
        {
          method: 'POST',
          body: JSON.stringify({
            rules: [
              { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
              { target: '*.github.com', port: 443, description: 'GitHub' },
            ],
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await postApplyTemplates(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.created).toBe(2);
      expect(data.skipped).toBe(0);
      expect(data.rules).toHaveLength(2);
      expect(mockApplyTemplates).toHaveBeenCalledWith('env-uuid', [
        { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
        { target: '*.github.com', port: 443, description: 'GitHub' },
      ]);
    });

    it('重複ルールをスキップしてskipped数を返す', async () => {
      mockApplyTemplates.mockResolvedValue({
        created: 1,
        skipped: 1,
        rules: [baseRule],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/templates/apply',
        {
          method: 'POST',
          body: JSON.stringify({
            rules: [
              { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
              { target: '*.github.com', port: 443, description: 'GitHub' },
            ],
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await postApplyTemplates(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.created).toBe(1);
      expect(data.skipped).toBe(1);
      expect(data.rules).toHaveLength(1);
    });

    it('rulesが空配列の場合400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/environments/env-uuid/network-rules/templates/apply',
        {
          method: 'POST',
          body: JSON.stringify({ rules: [] }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await postApplyTemplates(request, {
        params: Promise.resolve({ id: 'env-uuid' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(mockApplyTemplates).not.toHaveBeenCalled();
    });
  });
});
