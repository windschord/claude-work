import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { PortChecker } from '@/services/port-checker';

const mockCheckPorts = vi.fn().mockResolvedValue([
  { port: 3000, status: 'available' },
  { port: 8080, status: 'in_use', usedBy: 'nginx', source: 'os' },
]);

vi.mock('@/services/port-checker', () => ({
  PortChecker: vi.fn().mockImplementation(function () {
    return { checkPorts: mockCheckPorts };
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/environments/check-ports', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/environments/check-ports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('有効なポートリストで200とresults配列を返す', async () => {
      const request = createRequest({ ports: [3000, 8080] });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('results');
      expect(Array.isArray(json.results)).toBe(true);
      expect(json.results).toHaveLength(2);
      expect(json.results[0]).toEqual({ port: 3000, status: 'available' });
      expect(json.results[1]).toEqual({ port: 8080, status: 'in_use', usedBy: 'nginx', source: 'os' });
    });

    it('excludeEnvironmentId付きで200を返し、PortCheckerに正しく渡される', async () => {
      const request = createRequest({ ports: [3000, 8080], excludeEnvironmentId: 'env-123' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('results');
      expect(mockCheckPorts).toHaveBeenCalledWith({
        ports: [3000, 8080],
        excludeEnvironmentId: 'env-123',
      });
    });
  });

  describe('バリデーション', () => {
    it('portsが空配列の場合400を返す', async () => {
      const request = createRequest({ ports: [] });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('error');
    });

    it('portsが配列でない場合400を返す', async () => {
      const request = createRequest({ ports: '3000' });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('error');
    });

    it('ポート数が20を超える場合400を返す', async () => {
      const ports = Array.from({ length: 21 }, (_, i) => 3000 + i);
      const request = createRequest({ ports });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('error');
    });

    it('無効なポート番号(0)の場合400を返す', async () => {
      const request = createRequest({ ports: [0] });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('error');
    });

    it('excludeEnvironmentIdが文字列でない場合400を返す', async () => {
      const request = createRequest({ ports: [3000], excludeEnvironmentId: 123 });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('excludeEnvironmentId must be a string');
    });

    it('範囲外ポート(70000)の場合400を返す', async () => {
      const request = createRequest({ ports: [70000] });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('error');
    });
  });

  describe('エラー系', () => {
    it('PortCheckerが例外をスローした場合500を返す', async () => {
      vi.mocked(PortChecker).mockImplementationOnce(function () {
        return { checkPorts: vi.fn().mockRejectedValue(new Error('Port check failed')) };
      });

      const request = createRequest({ ports: [3000] });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json).toHaveProperty('error');
    });
  });
});
