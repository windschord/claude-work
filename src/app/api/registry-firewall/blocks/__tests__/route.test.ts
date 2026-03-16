import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const mockGetBlocks = vi.fn();

vi.mock('@/services/registry-firewall-client', () => ({
  getRegistryFirewallClient: () => ({
    getBlocks: (limit?: number) => mockGetBlocks(limit),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createRequest(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/registry-firewall/blocks');
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

describe('GET /api/registry-firewall/blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlocks.mockResolvedValue({
      blocks: [
        {
          timestamp: '2026-03-15T10:30:00Z',
          package_name: 'evil-pkg',
          registry: 'npm',
          reason: 'OSV: GHSA-xxxx-yyyy-zzzz',
          severity: 'critical',
        },
      ],
      total: 1,
    });
  });

  describe('正常系', () => {
    it('limitパラメータなしでブロックログを200で返す', async () => {
      const request = createRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('blocks');
      expect(json).toHaveProperty('total');
      expect(Array.isArray(json.blocks)).toBe(true);
      expect(mockGetBlocks).toHaveBeenCalledWith(10);
    });

    it('limitパラメータありでブロックログを200で返す', async () => {
      const request = createRequest({ limit: '20' });
      const response = await GET(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockGetBlocks).toHaveBeenCalledWith(20);
    });

    it('limitが最大値(100)を超える場合は100に丸める', async () => {
      const request = createRequest({ limit: '200' });
      const response = await GET(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockGetBlocks).toHaveBeenCalledWith(100);
    });

    it('limitが最小値(1)を下回る場合は1に丸める', async () => {
      const request = createRequest({ limit: '0' });
      const response = await GET(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockGetBlocks).toHaveBeenCalledWith(1);
    });

    it('limitが非数値の場合、デフォルト値10が使用される', async () => {
      mockGetBlocks.mockResolvedValueOnce({ blocks: [], total: 0 });

      const request = new NextRequest('http://localhost/api/registry-firewall/blocks?limit=abc');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetBlocks).toHaveBeenCalledWith(10);
    });

    it('registry-firewall停止時は空のブロックログを返す', async () => {
      mockGetBlocks.mockResolvedValueOnce({ blocks: [], total: 0 });

      const request = createRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.blocks).toEqual([]);
      expect(json.total).toBe(0);
    });
  });

  describe('エラー系', () => {
    it('getBlocksが例外をスローした場合、500を返す', async () => {
      mockGetBlocks.mockRejectedValue(new Error('Unexpected error'));

      const request = createRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json).toHaveProperty('error');
    });
  });
});
