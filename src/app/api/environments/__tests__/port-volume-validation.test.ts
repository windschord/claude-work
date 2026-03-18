import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from '../route';
import { PUT } from '../[id]/route';

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/environments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createPutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/environments/test-env-id', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * NOTE: /api/environments エンドポイントはTASK-009で廃止されました（410 Gone）。
 * 環境はプロジェクトに1対1で紐付けられるようになり、以下のエンドポイントに移行しました:
 * - GET/PUT: /api/projects/[project_id]/environment
 * - POST: プロジェクト作成時に自動作成 (POST /api/projects)
 * - DELETE: プロジェクト削除時に自動削除 (DELETE /api/projects/[project_id])
 *
 * このテストファイルは廃止済みエンドポイントが正しく410を返すことを確認します。
 */
describe('Environment API - 廃止済みエンドポイント（410 Gone）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/environments - 廃止済み', () => {
    it('不正なポート番号（0）のリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          portMappings: [
            { hostPort: 0, containerPort: 8080, protocol: 'tcp' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('不正なポート番号（65536）のリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          portMappings: [
            { hostPort: 8080, containerPort: 65536, protocol: 'tcp' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('正常なportMappings付きconfigのリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          portMappings: [
            { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
            { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
    });

    it('portMappingsなしのconfigでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
    });
  });

  describe('POST /api/environments - volumeMounts validation - 廃止済み', () => {
    it('相対パス（hostPath）のリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          volumeMounts: [
            { hostPath: 'relative/path', containerPath: '/data', accessMode: 'rw' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('相対パス（containerPath）のリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: 'relative/path', accessMode: 'rw' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('システムコンテナパス（/workspace）のリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/workspace', accessMode: 'rw' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('システムコンテナパス（/home/node/.claude）のリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/home/node/.claude', accessMode: 'rw' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('正常なvolumeMounts付きconfigのリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/data', accessMode: 'rw' },
            { hostPath: '/home/user/logs', containerPath: '/logs', accessMode: 'ro' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
    });
  });

  describe('POST /api/environments - portMappings + volumeMounts combined - 廃止済み', () => {
    it('正常なportMappingsとvolumeMountsの両方を含むconfigのリクエストでも410を返す', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
          portMappings: [
            { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
          ],
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/data', accessMode: 'rw' },
          ],
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(410);
    });
  });

  describe('PUT /api/environments/:id - portMappings validation - 廃止済み', () => {
    it('不正なポート番号（0）のリクエストでも410を返す', async () => {
      const req = createPutRequest({
        config: {
          portMappings: [
            { hostPort: 0, containerPort: 8080, protocol: 'tcp' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('不正なポート番号（65536）のリクエストでも410を返す', async () => {
      const req = createPutRequest({
        config: {
          portMappings: [
            { hostPort: 8080, containerPort: 65536, protocol: 'tcp' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('正常なportMappings付きconfigのリクエストでも410を返す', async () => {
      const req = createPutRequest({
        config: {
          portMappings: [
            { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
    });
  });

  describe('PUT /api/environments/:id - volumeMounts validation - 廃止済み', () => {
    it('相対パスのリクエストでも410を返す', async () => {
      const req = createPutRequest({
        config: {
          volumeMounts: [
            { hostPath: 'relative/path', containerPath: '/data', accessMode: 'rw' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('システムコンテナパス重複のリクエストでも410を返す', async () => {
      const req = createPutRequest({
        config: {
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/workspace', accessMode: 'rw' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.deprecated).toBe(true);
    });

    it('正常なvolumeMounts付きconfigのリクエストでも410を返す', async () => {
      const req = createPutRequest({
        config: {
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/data', accessMode: 'rw' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(410);
    });
  });
});
