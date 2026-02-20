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
      config: '{"skipPermissions":true}',
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
import { environmentService } from '@/services/environment-service';

function createRequest(body: unknown): NextRequest {
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

describe('Environment API skipPermissions validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/environments', () => {
    it('should accept config.skipPermissions=true for DOCKER type', async () => {
      const req = createRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: { skipPermissions: true, imageName: 'test', imageTag: 'latest' },
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('should accept config.skipPermissions=false for DOCKER type', async () => {
      const req = createRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: { skipPermissions: false, imageName: 'test', imageTag: 'latest' },
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('should reject non-boolean config.skipPermissions for DOCKER type', async () => {
      const req = createRequest({
        name: 'Docker Env',
        type: 'DOCKER',
        config: { skipPermissions: 'true', imageName: 'test', imageTag: 'latest' },
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('skipPermissions');
    });

    it('should silently remove config.skipPermissions for HOST type', async () => {
      const req = createRequest({
        name: 'Host Env',
        type: 'HOST',
        config: { skipPermissions: true },
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
      // environmentService.createに渡されたconfigにskipPermissionsが含まれていないことを確認
      const createCall = vi.mocked(environmentService.create).mock.calls[0][0];
      expect(createCall.config).not.toHaveProperty('skipPermissions');
    });
  });

  describe('PUT /api/environments/:id', () => {
    it('should accept config.skipPermissions=true for DOCKER environment', async () => {
      const req = createPutRequest({
        config: { skipPermissions: true },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(200);
    });

    it('should accept config.skipPermissions=false for DOCKER environment', async () => {
      const req = createPutRequest({
        config: { skipPermissions: false },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(200);
    });

    it('should reject non-boolean config.skipPermissions for DOCKER environment', async () => {
      const req = createPutRequest({
        config: { skipPermissions: 'true' },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('skipPermissions');
    });

    it('should silently remove config.skipPermissions for HOST environment', async () => {
      vi.mocked(environmentService.findById).mockResolvedValueOnce({
        id: 'test-env-id',
        name: 'Host Env',
        type: 'HOST',
        config: '{}',
        is_default: false,
        description: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const req = createPutRequest({
        config: { skipPermissions: true },
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'test-env-id' }) });
      expect(response.status).toBe(200);
      // environmentService.updateに渡されたconfigにskipPermissionsが含まれていないことを確認
      const updateCall = vi.mocked(environmentService.update).mock.calls[0][1];
      expect(updateCall.config).not.toHaveProperty('skipPermissions');
    });
  });
});
