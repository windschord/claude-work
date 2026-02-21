import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// environmentServiceをモック
vi.mock('@/services/environment-service', () => ({
  environmentService: {
    create: vi.fn().mockResolvedValue({
      id: 'test-env-id',
      name: 'Test Docker',
      type: 'DOCKER',
      config: '{}',
    }),
    findById: vi.fn().mockResolvedValue({
      id: 'test-env-id',
      name: 'Test Docker',
      type: 'DOCKER',
      config: '{}',
      is_default: false,
    }),
    update: vi.fn().mockResolvedValue({
      id: 'test-env-id',
      name: 'Updated',
      type: 'DOCKER',
      config: '{}',
    }),
    createAuthDirectory: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    checkStatus: vi.fn().mockResolvedValue({ available: true }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/data-dir', () => ({
  getEnvironmentsDir: vi.fn().mockReturnValue('/tmp/test-environments'),
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

describe('Environment API portMappings/volumeMounts validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/environments - portMappings validation', () => {
    it('不正なポート番号（0）で400エラーを返す', async () => {
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
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('不正なポート番号（65536）で400エラーを返す', async () => {
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
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('正常なportMappings付きconfigで環境を作成できる', async () => {
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
      expect(response.status).toBe(201);
    });

    it('portMappingsなしのconfigでも環境を作成できる', async () => {
      const req = createPostRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: {
          imageName: 'test',
          imageTag: 'latest',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/environments - volumeMounts validation', () => {
    it('相対パス（hostPath）で400エラーを返す', async () => {
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
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('相対パス（containerPath）で400エラーを返す', async () => {
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
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('システムコンテナパス（/workspace）で400エラーを返す', async () => {
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
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('システムコンテナパス（/home/node/.claude）で400エラーを返す', async () => {
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
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('正常なvolumeMounts付きconfigで環境を作成できる', async () => {
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
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/environments - portMappings + volumeMounts combined', () => {
    it('正常なportMappingsとvolumeMountsの両方を含むconfigで環境を作成できる', async () => {
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
      expect(response.status).toBe(201);
    });
  });

  describe('PUT /api/environments/:id - portMappings validation', () => {
    it('不正なポート番号（0）で400エラーを返す', async () => {
      const req = createPutRequest({
        config: {
          portMappings: [
            { hostPort: 0, containerPort: 8080, protocol: 'tcp' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('不正なポート番号（65536）で400エラーを返す', async () => {
      const req = createPutRequest({
        config: {
          portMappings: [
            { hostPort: 8080, containerPort: 65536, protocol: 'tcp' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('正常なportMappings付きconfigで環境を更新できる', async () => {
      const req = createPutRequest({
        config: {
          portMappings: [
            { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/environments/:id - volumeMounts validation', () => {
    it('相対パスで400エラーを返す', async () => {
      const req = createPutRequest({
        config: {
          volumeMounts: [
            { hostPath: 'relative/path', containerPath: '/data', accessMode: 'rw' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('システムコンテナパス重複で400エラーを返す', async () => {
      const req = createPutRequest({
        config: {
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/workspace', accessMode: 'rw' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('正常なvolumeMounts付きconfigで環境を更新できる', async () => {
      const req = createPutRequest({
        config: {
          volumeMounts: [
            { hostPath: '/home/user/data', containerPath: '/data', accessMode: 'rw' },
          ],
        },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(200);
    });
  });
});
