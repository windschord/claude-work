import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

/**
 * /api/environments は廃止されました（410 Gone）。
 * GET /api/projects/[project_id]/environment を使用してください。
 */
describe('/api/environments (deprecated - 410 Gone)', () => {
  describe('GET /api/environments', () => {
    it('410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.deprecated).toBe(true);
      expect(data.error).toContain('廃止');
    });

    it('Deprecation ヘッダーが付与される', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);

      expect(response.headers.get('Deprecation')).toBe('true');
    });

    it('代替エンドポイントの情報が含まれる', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments');
      const response = await GET(request);
      const data = await response.json();

      expect(data.alternatives).toBeDefined();
    });
  });

  describe('POST /api/environments', () => {
    it('410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', type: 'HOST', config: {} }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.deprecated).toBe(true);
      expect(data.error).toContain('廃止');
    });

    it('Deprecation ヘッダーが付与される', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.headers.get('Deprecation')).toBe('true');
    });

    it('代替エンドポイントの情報が含まれる', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.alternatives).toBeDefined();
    });
  });
});
