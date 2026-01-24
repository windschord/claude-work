import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs/promises';

// Mock environment service
vi.mock('@/services/environment-service', () => ({
  environmentService: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

import { environmentService } from '@/services/environment-service';
import { POST, DELETE } from '../route';

// Helper to create mock file with text() method
function createMockFile(content: string, name: string): File {
  const file = {
    name,
    text: vi.fn().mockResolvedValue(content),
    size: content.length,
    type: 'text/plain',
  } as unknown as File;
  return file;
}

// Helper to create mock request with formData
function createMockPostRequest(id: string, fileContent: string | null): NextRequest {
  const mockFormData = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'dockerfile' && fileContent !== null) {
        return createMockFile(fileContent, 'Dockerfile');
      }
      return null;
    }),
  };

  const request = {
    formData: vi.fn().mockResolvedValue(mockFormData),
    method: 'POST',
    url: `http://localhost/api/environments/${id}/dockerfile`,
  } as unknown as NextRequest;

  return request;
}

function createMockDeleteRequest(id: string): NextRequest {
  return {
    method: 'DELETE',
    url: `http://localhost/api/environments/${id}/dockerfile`,
  } as unknown as NextRequest;
}

describe('Dockerfile API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/environments/:id/dockerfile', () => {
    it('should upload Dockerfile and save to environment directory', async () => {
      const mockEnvironment = {
        id: 'env-123',
        name: 'Test Docker Env',
        type: 'DOCKER',
        config: '{}',
      };

      vi.mocked(environmentService.findById).mockResolvedValue(mockEnvironment as never);
      vi.mocked(environmentService.update).mockResolvedValue(mockEnvironment as never);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const dockerfileContent = 'FROM ubuntu:22.04\nRUN apt-get update';

      const request = createMockPostRequest('env-123', dockerfileContent);

      const response = await POST(request, { params: Promise.resolve({ id: 'env-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.path).toBe('data/environments/env-123/Dockerfile');

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(environmentService.update).toHaveBeenCalledWith('env-123', {
        config: { dockerfileUploaded: true, imageSource: 'dockerfile' },
      });
    });

    it('should return 404 when environment not found', async () => {
      vi.mocked(environmentService.findById).mockResolvedValue(null as never);

      const request = createMockPostRequest('not-found', 'content');

      const response = await POST(request, { params: Promise.resolve({ id: 'not-found' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Environment not found');
    });

    it('should return 400 when environment is not DOCKER type', async () => {
      const mockEnvironment = {
        id: 'env-123',
        name: 'Test Host Env',
        type: 'HOST',
        config: '{}',
      };

      vi.mocked(environmentService.findById).mockResolvedValue(mockEnvironment as never);

      const request = createMockPostRequest('env-123', 'content');

      const response = await POST(request, { params: Promise.resolve({ id: 'env-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('DOCKER');
    });

    it('should return 400 when no file provided', async () => {
      const mockEnvironment = {
        id: 'env-123',
        name: 'Test Docker Env',
        type: 'DOCKER',
        config: '{}',
      };

      vi.mocked(environmentService.findById).mockResolvedValue(mockEnvironment as never);

      const request = createMockPostRequest('env-123', null);

      const response = await POST(request, { params: Promise.resolve({ id: 'env-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('dockerfile');
    });
  });

  describe('DELETE /api/environments/:id/dockerfile', () => {
    it('should delete Dockerfile and update config', async () => {
      const mockEnvironment = {
        id: 'env-123',
        name: 'Test Docker Env',
        type: 'DOCKER',
        config: JSON.stringify({ dockerfileUploaded: true, imageSource: 'dockerfile' }),
      };

      vi.mocked(environmentService.findById).mockResolvedValue(mockEnvironment as never);
      vi.mocked(environmentService.update).mockResolvedValue(mockEnvironment as never);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const request = createMockDeleteRequest('env-123');

      const response = await DELETE(request, { params: Promise.resolve({ id: 'env-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      expect(fs.unlink).toHaveBeenCalled();
      expect(environmentService.update).toHaveBeenCalledWith('env-123', {
        config: expect.objectContaining({
          dockerfileUploaded: false,
          imageSource: 'existing',
        }),
      });
    });

    it('should handle non-existent file gracefully', async () => {
      const mockEnvironment = {
        id: 'env-123',
        name: 'Test Docker Env',
        type: 'DOCKER',
        config: '{}',
      };

      vi.mocked(environmentService.findById).mockResolvedValue(mockEnvironment as never);
      vi.mocked(environmentService.update).mockResolvedValue(mockEnvironment as never);
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));

      const request = createMockDeleteRequest('env-123');

      const response = await DELETE(request, { params: Promise.resolve({ id: 'env-123' }) });
      const data = await response.json();

      // Should still succeed even if file doesn't exist
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when environment not found', async () => {
      vi.mocked(environmentService.findById).mockResolvedValue(null as never);

      const request = createMockDeleteRequest('not-found');

      const response = await DELETE(request, { params: Promise.resolve({ id: 'not-found' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Environment not found');
    });

    it('should return 400 when environment is not DOCKER type', async () => {
      const mockEnvironment = {
        id: 'env-123',
        name: 'Test Host Env',
        type: 'HOST',
        config: '{}',
      };

      vi.mocked(environmentService.findById).mockResolvedValue(mockEnvironment as never);

      const request = createMockDeleteRequest('env-123');

      const response = await DELETE(request, { params: Promise.resolve({ id: 'env-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('DOCKER');
    });
  });
});
