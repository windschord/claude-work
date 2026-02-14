import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモックを先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockDbInsertGet,
  mockDbUpdateGet,
  mockDbDeleteRun,
  mockEncrypt,
  mockDecrypt,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockDbInsertGet: vi.fn(),
  mockDbUpdateGet: vi.fn(),
  mockDbDeleteRun: vi.fn(),
  mockEncrypt: vi.fn(),
  mockDecrypt: vi.fn(),
}));

// Drizzle DBのモック
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbSelectGet,
          all: mockDbSelectAll,
        })),
        orderBy: vi.fn(() => ({
          all: mockDbSelectAll,
        })),
        get: mockDbSelectGet,
        all: mockDbSelectAll,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockDbInsertGet,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockDbUpdateGet,
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockDbDeleteRun,
      })),
    })),
  },
  schema: {
    githubPats: {
      id: 'id',
      name: 'name',
      description: 'description',
      encrypted_token: 'encrypted_token',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
  desc: vi.fn((col) => ({ column: col, direction: 'desc' })),
}));

// EncryptionServiceのモック
vi.mock('../encryption-service', () => ({
  EncryptionService: class MockEncryptionService {
    encrypt = mockEncrypt;
    decrypt = mockDecrypt;
  },
}));

import {
  GitHubPATService,
  PATNotFoundError,
  PATEncryptionError,
} from '../github-pat-service';

describe('GitHubPATService', () => {
  let service: GitHubPATService;

  const mockPATRecord = {
    id: 'pat-uuid-1',
    name: 'My GitHub PAT',
    description: 'Personal projects',
    encrypted_token: 'iv:authTag:encrypted',
    is_active: true,
    created_at: new Date('2026-02-13T12:00:00Z'),
    updated_at: new Date('2026-02-13T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubPATService();
  });

  describe('create', () => {
    it('PATを暗号化して保存し、暗号化トークンを含まない結果を返す', async () => {
      mockEncrypt.mockResolvedValue('iv:authTag:encrypted');
      mockDbInsertGet.mockReturnValue(mockPATRecord);

      const result = await service.create({
        name: 'My GitHub PAT',
        token: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'Personal projects',
      });

      expect(mockEncrypt).toHaveBeenCalledWith('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(result).toEqual({
        id: 'pat-uuid-1',
        name: 'My GitHub PAT',
        description: 'Personal projects',
        isActive: true,
        createdAt: mockPATRecord.created_at,
        updatedAt: mockPATRecord.updated_at,
      });
      // encrypted_tokenが結果に含まれないことを確認
      expect(result).not.toHaveProperty('encrypted_token');
      expect(result).not.toHaveProperty('encryptedToken');
    });

    it('暗号化に失敗した場合、PATEncryptionErrorをスローする', async () => {
      mockEncrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(
        service.create({
          name: 'My PAT',
          token: 'ghp_test_token_xxxx',
        })
      ).rejects.toThrow(PATEncryptionError);
    });
  });

  describe('list', () => {
    it('全てのPATをサマリ形式で返す（暗号化トークンを含まない）', async () => {
      const mockRecords = [
        mockPATRecord,
        {
          ...mockPATRecord,
          id: 'pat-uuid-2',
          name: 'Work PAT',
          description: null,
          is_active: false,
        },
      ];
      mockDbSelectAll.mockReturnValue(mockRecords);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'pat-uuid-1',
        name: 'My GitHub PAT',
        description: 'Personal projects',
        isActive: true,
        createdAt: mockPATRecord.created_at,
        updatedAt: mockPATRecord.updated_at,
      });
      expect(result[1]).toEqual({
        id: 'pat-uuid-2',
        name: 'Work PAT',
        description: null,
        isActive: false,
        createdAt: mockPATRecord.created_at,
        updatedAt: mockPATRecord.updated_at,
      });
      // encrypted_tokenがどの結果にも含まれないことを確認
      for (const pat of result) {
        expect(pat).not.toHaveProperty('encrypted_token');
        expect(pat).not.toHaveProperty('encryptedToken');
      }
    });

    it('PATが存在しない場合、空配列を返す', async () => {
      mockDbSelectAll.mockReturnValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('指定IDのPATをサマリ形式で返す', async () => {
      mockDbSelectGet.mockReturnValue(mockPATRecord);

      const result = await service.getById('pat-uuid-1');

      expect(result).toEqual({
        id: 'pat-uuid-1',
        name: 'My GitHub PAT',
        description: 'Personal projects',
        isActive: true,
        createdAt: mockPATRecord.created_at,
        updatedAt: mockPATRecord.updated_at,
      });
    });

    it('存在しないIDの場合、nullを返す', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.getById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('PATの名前と説明を更新する', async () => {
      const updatedRecord = {
        ...mockPATRecord,
        name: 'Updated PAT',
        description: 'Updated description',
        updated_at: new Date('2026-02-13T14:00:00Z'),
      };
      mockDbSelectGet.mockReturnValue(mockPATRecord);
      mockDbUpdateGet.mockReturnValue(updatedRecord);

      const result = await service.update('pat-uuid-1', {
        name: 'Updated PAT',
        description: 'Updated description',
      });

      expect(result).toEqual({
        id: 'pat-uuid-1',
        name: 'Updated PAT',
        description: 'Updated description',
        isActive: true,
        createdAt: mockPATRecord.created_at,
        updatedAt: updatedRecord.updated_at,
      });
    });

    it('存在しないIDの場合、PATNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(
        service.update('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow(PATNotFoundError);
    });
  });

  describe('delete', () => {
    it('指定IDのPATを削除する', async () => {
      mockDbSelectGet.mockReturnValue(mockPATRecord);

      await expect(service.delete('pat-uuid-1')).resolves.toBeUndefined();
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });

    it('存在しないIDの場合、PATNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.delete('non-existent-id')).rejects.toThrow(PATNotFoundError);
    });
  });

  describe('toggleActive', () => {
    it('有効なPATを無効にする', async () => {
      mockDbSelectGet.mockReturnValue(mockPATRecord);
      mockDbUpdateGet.mockReturnValue({
        ...mockPATRecord,
        is_active: false,
        updated_at: new Date('2026-02-13T14:00:00Z'),
      });

      const result = await service.toggleActive('pat-uuid-1');

      expect(result.isActive).toBe(false);
    });

    it('無効なPATを有効にする', async () => {
      mockDbSelectGet.mockReturnValue({ ...mockPATRecord, is_active: false });
      mockDbUpdateGet.mockReturnValue({
        ...mockPATRecord,
        is_active: true,
        updated_at: new Date('2026-02-13T14:00:00Z'),
      });

      const result = await service.toggleActive('pat-uuid-1');

      expect(result.isActive).toBe(true);
    });

    it('存在しないIDの場合、PATNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.toggleActive('non-existent-id')).rejects.toThrow(PATNotFoundError);
    });
  });

  describe('decryptToken', () => {
    it('指定IDのPATトークンを復号化して返す', async () => {
      mockDbSelectGet.mockReturnValue(mockPATRecord);
      mockDecrypt.mockResolvedValue('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      const result = await service.decryptToken('pat-uuid-1');

      expect(mockDecrypt).toHaveBeenCalledWith('iv:authTag:encrypted');
      expect(result).toBe('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('存在しないIDの場合、PATNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.decryptToken('non-existent-id')).rejects.toThrow(PATNotFoundError);
    });

    it('復号化に失敗した場合、PATEncryptionErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(mockPATRecord);
      mockDecrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(service.decryptToken('pat-uuid-1')).rejects.toThrow(PATEncryptionError);
    });
  });
});
