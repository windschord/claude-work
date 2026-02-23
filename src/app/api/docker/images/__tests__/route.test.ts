import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// DockerClientモックを作成
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    listImages: vi.fn(),
  },
}));

vi.mock('@/services/docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// テスト対象
import { GET } from '../route';

describe('/api/docker/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/docker/images', () => {
    it('should return list of docker images', async () => {
      mockDockerClient.listImages.mockResolvedValue([
        {
          RepoTags: ['node:18-alpine'],
          Id: 'sha256:abc123def456789012345678901234567890123456789012345678901234',
          Size: 104857600, // ~100MB
          Created: 1704067200, // 2024-01-01T12:00:00Z
        },
        {
          RepoTags: ['ubuntu:22.04'],
          Id: 'sha256:def456abc789012345678901234567890123456789012345678901234567',
          Size: 209715200, // ~200MB
          Created: 1704153600, // 2024-01-02T12:00:00Z
        },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.images).toHaveLength(2);
      expect(data.images[0]).toEqual({
        repository: 'node',
        tag: '18-alpine',
        id: 'abc123def456',
        size: expect.stringContaining('MB'),
        created: expect.any(String),
      });
      expect(data.images[1]).toEqual({
        repository: 'ubuntu',
        tag: '22.04',
        id: 'def456abc789',
        size: expect.stringContaining('MB'),
        created: expect.any(String),
      });
    });

    it('should exclude images with <none> tag', async () => {
      mockDockerClient.listImages.mockResolvedValue([
        {
          RepoTags: ['node:18-alpine'],
          Id: 'sha256:abc123def456789012345678901234567890123456789012345678901234',
          Size: 104857600,
          Created: 1704067200,
        },
        {
          RepoTags: ['<none>:<none>'],
          Id: 'sha256:orphan1234567890123456789012345678901234567890123456789012',
          Size: 52428800,
          Created: 1704063600,
        },
        {
          RepoTags: ['ubuntu:<none>'],
          Id: 'sha256:orphan2345678901234567890123456789012345678901234567890123',
          Size: 78643200,
          Created: 1704060000,
        },
        {
          RepoTags: ['<none>:latest'],
          Id: 'sha256:orphan3456789012345678901234567890123456789012345678901234',
          Size: 83886080,
          Created: 1704056400,
        },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.images).toHaveLength(1);
      expect(data.images[0].repository).toBe('node');
      expect(data.images[0].tag).toBe('18-alpine');
    });

    it('should return 503 when docker daemon is unavailable', async () => {
      mockDockerClient.listImages.mockRejectedValue(
        new Error('Cannot connect to the Docker daemon')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Cannot connect to the Docker daemon');
    });

    it('should handle empty image list', async () => {
      mockDockerClient.listImages.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.images).toHaveLength(0);
    });

    it('should handle command timeout', async () => {
      mockDockerClient.listImages.mockRejectedValue(
        new Error('Command timed out')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Command timed out');
    });
  });
});
