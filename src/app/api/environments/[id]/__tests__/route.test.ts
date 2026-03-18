import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../route';

/**
 * /api/environments/[id] は廃止されました（410 Gone）。
 * GET /api/projects/[project_id]/environment を使用してください。
 */
describe('/api/environments/[id] (deprecated - 410 Gone)', () => {
  describe('GET /api/environments/:id', () => {
    it('410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1');
      const response = await GET(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.deprecated).toBe(true);
      expect(data.error).toContain('廃止');
    });

    it('Deprecation ヘッダーが付与される', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1');
      const response = await GET(request, { params: Promise.resolve({ id: 'env-1' }) });

      expect(response.headers.get('Deprecation')).toBe('true');
      expect(response.headers.get('Sunset')).toBeTruthy();
    });

    it('代替エンドポイントの情報が含まれる', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1');
      const response = await GET(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(data.alternatives).toBeDefined();
    });
  });

  describe('PUT /api/environments/:id', () => {
    it('410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.deprecated).toBe(true);
      expect(data.error).toContain('廃止');
    });

    it('Deprecation ヘッダーが付与される', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'env-1' }) });

      expect(response.headers.get('Deprecation')).toBe('true');
      expect(response.headers.get('Sunset')).toBeTruthy();
    });

    it('代替エンドポイントの情報が含まれる', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(data.alternatives).toBeDefined();
    });
  });

  describe('DELETE /api/environments/:id', () => {
    it('410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.deprecated).toBe(true);
      expect(data.error).toContain('廃止');
    });

    it('Deprecation ヘッダーが付与される', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'env-1' }) });

      expect(response.headers.get('Deprecation')).toBe('true');
      expect(response.headers.get('Sunset')).toBeTruthy();
    });

    it('代替エンドポイントの情報が含まれる', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/env-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'env-1' }) });
      const data = await response.json();

      expect(data.alternatives).toBeDefined();
    });
  });
});
