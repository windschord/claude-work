import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { PUT } from '../[id]/route';

/**
 * POST /api/environments および PUT /api/environments/:id は廃止されました（410 Gone）。
 * skipPermissions の検証は廃止エンドポイントでは不要なため、
 * このテストは 410 Gone を確認するテストに変更されました。
 *
 * skipPermissions の検証は以下で行われます（プロジェクト作成時の自動環境作成）:
 * - POST /api/projects → 環境を自動作成
 * - PUT /api/projects/[project_id]/environment → 環境設定更新
 */
describe('環境APIの廃止確認 (410 Gone)', () => {
  describe('POST /api/environments', () => {
    it('skipPermissions=true でも 410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Docker Env',
          type: 'DOCKER',
          config: { skipPermissions: true, imageName: 'test', imageTag: 'latest' },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(410);
    });

    it('skipPermissions=false でも 410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Docker Env',
          type: 'DOCKER',
          config: { skipPermissions: false, imageName: 'test', imageTag: 'latest' },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(410);
    });

    it('HOST タイプでも 410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Host Env',
          type: 'HOST',
          config: { skipPermissions: true },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(410);
    });
  });

  describe('PUT /api/environments/:id', () => {
    it('skipPermissions=true でも 410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/test-env-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { skipPermissions: true },
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
    });

    it('skipPermissions=false でも 410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/test-env-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { skipPermissions: false },
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
    });

    it('HOST 環境でも 410 Gone を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/environments/test-env-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { skipPermissions: true },
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
    });
  });
});
