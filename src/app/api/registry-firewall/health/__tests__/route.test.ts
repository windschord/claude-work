import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

const mockGetHealth = vi.fn();

vi.mock('@/services/registry-firewall-client', () => ({
  getRegistryFirewallClient: () => ({
    getHealth: () => mockGetHealth(),
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

describe('GET /api/registry-firewall/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('registry-firewallが正常な場合、ヘルスステータスを200で返す', async () => {
      const mockResponse = {
        status: 'healthy',
        registries: ['npm', 'pypi', 'go', 'cargo', 'docker'],
        version: '0.1.0',
      };
      mockGetHealth.mockResolvedValue(mockResponse);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual(mockResponse);
    });

    it('registry-firewall停止時、stoppedステータスを200で返す', async () => {
      const mockResponse = { status: 'stopped' };
      mockGetHealth.mockResolvedValue(mockResponse);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ status: 'stopped' });
    });

    it('registry-firewallが unhealthy の場合、unhealthyステータスを200で返す', async () => {
      const mockResponse = { status: 'unhealthy' };
      mockGetHealth.mockResolvedValue(mockResponse);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ status: 'unhealthy' });
    });
  });

  describe('エラー系', () => {
    it('getHealthが例外をスローした場合、500を返す', async () => {
      mockGetHealth.mockRejectedValue(new Error('Unexpected error'));

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json).toHaveProperty('error');
    });
  });
});
