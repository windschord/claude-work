import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetAllKeys, mockRegisterKey } = vi.hoisted(() => ({
  mockGetAllKeys: vi.fn(),
  mockRegisterKey: vi.fn(),
}));

vi.mock('@/services/ssh-key-service', () => {
  return {
    SshKeyService: class {
      getAllKeys = mockGetAllKeys;
      registerKey = mockRegisterKey;
    },
    DuplicateSshKeyNameError: class extends Error {
      name = 'DuplicateSshKeyNameError';
    },
    InvalidSshKeyError: class extends Error {
      name = 'InvalidSshKeyError';
    },
    SshKeyEncryptionError: class extends Error {
      name = 'SshKeyEncryptionError';
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

import { GET, POST } from '../route';

describe('/api/ssh-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ssh-keys', () => {
    it('SSH鍵一覧を取得できる', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'GitHub Personal',
          publicKey: 'ssh-rsa AAAA...',
          hasPassphrase: false,
          createdAt: new Date('2026-02-19T12:00:00Z'),
          updatedAt: new Date('2026-02-19T12:00:00Z'),
        },
        {
          id: 'key-2',
          name: 'Work Bitbucket',
          publicKey: 'ssh-ed25519 AAAA...',
          hasPassphrase: true,
          createdAt: new Date('2026-02-20T12:00:00Z'),
          updatedAt: new Date('2026-02-20T12:00:00Z'),
        },
      ];

      mockGetAllKeys.mockResolvedValue(mockKeys);

      const request = new NextRequest('http://localhost:3000/api/ssh-keys');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys).toHaveLength(2);
      expect(data.keys[0]).toEqual(
        expect.objectContaining({
          id: 'key-1',
          name: 'GitHub Personal',
          public_key: 'ssh-rsa AAAA...',
        })
      );
      expect(data.keys[1]).toEqual(
        expect.objectContaining({
          id: 'key-2',
          name: 'Work Bitbucket',
          public_key: 'ssh-ed25519 AAAA...',
        })
      );
    });

    it('SSH鍵が存在しない場合、空配列を返す', async () => {
      mockGetAllKeys.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/ssh-keys');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys).toEqual([]);
    });

    it('サーバーエラー時は500を返す', async () => {
      mockGetAllKeys.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/ssh-keys', () => {
    it('SSH鍵を登録できる', async () => {
      const registeredKey = {
        id: 'key-new',
        name: 'New-Key',
        publicKey: 'ssh-rsa AAAA...',
        hasPassphrase: false,
        createdAt: new Date('2026-02-21T12:00:00Z'),
        updatedAt: new Date('2026-02-21T12:00:00Z'),
      };

      mockRegisterKey.mockResolvedValue(registeredKey);

      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New-Key',
          private_key: 'dummy-private-key',
          public_key: 'ssh-rsa AAAA...',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.key).toEqual(
        expect.objectContaining({
          id: 'key-new',
          name: 'New-Key',
          public_key: 'ssh-rsa AAAA...',
        })
      );
      expect(mockRegisterKey).toHaveBeenCalledWith({
        name: 'New-Key',
        privateKey: 'dummy-private-key',
        publicKey: 'ssh-rsa AAAA...',
        hasPassphrase: false,
      });
    });

    it('パスフレーズ付きの鍵を登録できる', async () => {
      const registeredKey = {
        id: 'key-new',
        name: 'Passphrase-Key',
        publicKey: 'ssh-rsa AAAA...',
        hasPassphrase: true,
        createdAt: new Date('2026-02-21T12:00:00Z'),
        updatedAt: new Date('2026-02-21T12:00:00Z'),
      };

      mockRegisterKey.mockResolvedValue(registeredKey);

      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Passphrase-Key',
          private_key: 'dummy-private-key',
          passphrase: 'my-secret',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockRegisterKey).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPassphrase: true,
        })
      );
    });

    it('nameが未指定の場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          private_key: 'dummy-private-key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('nameにスペースが含まれる場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Name With Spaces',
          private_key: 'dummy-private-key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('英数字、ハイフン、アンダースコア');
    });

    it('nameが101文字以上の場合は400を返す', async () => {
      const longName = 'a'.repeat(101);
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: longName,
          private_key: 'dummy-private-key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('英数字、ハイフン、アンダースコア');
    });

    it('public_keyが空文字の場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-key',
          private_key: 'dummy-private-key',
          public_key: '',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('public_key');
    });

    it('public_keyが空白のみの場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'test-key',
          private_key: 'dummy-private-key',
          public_key: '   ',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('public_key');
    });

    it('private_keyが未指定の場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Key-Name',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('名前が重複している場合は409を返す', async () => {
      const { DuplicateSshKeyNameError } = await import('@/services/ssh-key-service');
      mockRegisterKey.mockRejectedValue(new DuplicateSshKeyNameError('Existing Key'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Existing-Key',
          private_key: 'dummy-private-key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe('DUPLICATE_SSH_KEY_NAME');
    });

    it('無効な秘密鍵形式の場合は400を返す', async () => {
      const { InvalidSshKeyError } = await import('@/services/ssh-key-service');
      mockRegisterKey.mockRejectedValue(new InvalidSshKeyError('Invalid format'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bad-Key',
          private_key: 'not a valid key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_SSH_KEY');
    });

    it('暗号化エラーの場合は500を返す', async () => {
      const { SshKeyEncryptionError } = await import('@/services/ssh-key-service');
      mockRegisterKey.mockRejectedValue(new SshKeyEncryptionError('Encryption failed'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Key-Name',
          private_key: 'dummy-private-key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('ENCRYPTION_ERROR');
    });

    it('不正なJSONの場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockRegisterKey.mockRejectedValue(new Error('Unknown error'));

      const request = new NextRequest('http://localhost:3000/api/ssh-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Key-Name',
          private_key: 'dummy-private-key',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
