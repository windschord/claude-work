import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ホイストされたモックを作成
const { mockExec } = vi.hoisted(() => ({
  mockExec: vi.fn(),
}));

// child_processモジュールをモック
vi.mock('child_process', async () => {
  const mockExports = {
    exec: mockExec,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

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
      const dockerOutput = [
        '{"Repository":"node","Tag":"18-alpine","ID":"abc123","Size":"100MB","CreatedAt":"2024-01-01 12:00:00"}',
        '{"Repository":"ubuntu","Tag":"22.04","ID":"def456","Size":"200MB","CreatedAt":"2024-01-02 12:00:00"}',
      ].join('\n');

      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(null, { stdout: dockerOutput, stderr: '' });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.images).toHaveLength(2);
      expect(data.images[0]).toEqual({
        repository: 'node',
        tag: '18-alpine',
        id: 'abc123',
        size: '100MB',
        created: '2024-01-01 12:00:00',
      });
      expect(data.images[1]).toEqual({
        repository: 'ubuntu',
        tag: '22.04',
        id: 'def456',
        size: '200MB',
        created: '2024-01-02 12:00:00',
      });
    });

    it('should exclude images with <none> tag', async () => {
      const dockerOutput = [
        '{"Repository":"node","Tag":"18-alpine","ID":"abc123","Size":"100MB","CreatedAt":"2024-01-01 12:00:00"}',
        '{"Repository":"<none>","Tag":"<none>","ID":"orphan1","Size":"50MB","CreatedAt":"2024-01-01 11:00:00"}',
        '{"Repository":"ubuntu","Tag":"<none>","ID":"orphan2","Size":"75MB","CreatedAt":"2024-01-01 10:00:00"}',
        '{"Repository":"<none>","Tag":"latest","ID":"orphan3","Size":"80MB","CreatedAt":"2024-01-01 09:00:00"}',
      ].join('\n');

      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(null, { stdout: dockerOutput, stderr: '' });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.images).toHaveLength(1);
      expect(data.images[0].repository).toBe('node');
      expect(data.images[0].tag).toBe('18-alpine');
    });

    it('should return 503 when docker daemon is unavailable', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(new Error('Cannot connect to the Docker daemon'), { stdout: '', stderr: '' });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Docker daemon not available');
    });

    it('should handle empty image list', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(null, { stdout: '', stderr: '' });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.images).toHaveLength(0);
    });

    it('should handle command timeout', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(new Error('Command timed out'), { stdout: '', stderr: '' });
          return {} as ReturnType<typeof mockExec>;
        }
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Docker daemon not available');
    });
  });
});
