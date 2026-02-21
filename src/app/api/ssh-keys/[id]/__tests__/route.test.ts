import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDeleteKey } = vi.hoisted(() => ({
  mockDeleteKey: vi.fn(),
}));

vi.mock('@/services/ssh-key-service', () => {
  return {
    SshKeyService: class {
      deleteKey = mockDeleteKey;
    },
    SshKeyNotFoundError: class extends Error {
      name = 'SshKeyNotFoundError';
    },
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

import { DELETE } from '../route';

describe('/api/ssh-keys/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DELETE /api/ssh-keys/:id', () => {
    it('SSH鍵を削除できる', async () => {
      mockDeleteKey.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/ssh-keys/key-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'key-1' }) });

      expect(response.status).toBe(204);
      expect(mockDeleteKey).toHaveBeenCalledWith('key-1');
    });

    it('存在しないIDの場合は404を返す', async () => {
      const { SshKeyNotFoundError } = await import('@/services/ssh-key-service');
      mockDeleteKey.mockRejectedValue(new SshKeyNotFoundError('non-existent'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys/non-existent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockDeleteKey.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys/key-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'key-1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
