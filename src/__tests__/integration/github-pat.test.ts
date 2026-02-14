import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモック関数を初期化
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

// Drizzle DBモック
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

// EncryptionServiceモック
vi.mock('@/services/encryption-service', () => ({
  EncryptionService: class MockEncryptionService {
    encrypt = mockEncrypt;
    decrypt = mockDecrypt;
    isKeyConfigured = vi.fn().mockReturnValue(true);
  },
}));

import {
  GitHubPATService,
  PATNotFoundError,
  PATEncryptionError,
} from '@/services/github-pat-service';

describe('GitHub PAT Management Integration', () => {
  let service: GitHubPATService;

  // テスト用のPATレコード
  const basePATRecord = {
    id: 'pat-integration-1',
    name: 'Integration Test PAT',
    description: 'PAT for integration testing',
    encrypted_token: 'iv_base64:authTag_base64:encrypted_base64',
    is_active: true,
    created_at: new Date('2026-02-13T10:00:00Z'),
    updated_at: new Date('2026-02-13T10:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubPATService();
  });

  it('should complete full PAT lifecycle: create -> list -> update -> toggle -> delete', async () => {
    // ===== Step 1: PAT作成 =====
    mockEncrypt.mockResolvedValue('iv_base64:authTag_base64:encrypted_base64');
    mockDbInsertGet.mockReturnValue(basePATRecord);

    const created = await service.create({
      name: 'Integration Test PAT',
      token: 'ghp_1234567890123456789012345678901234567890',
      description: 'PAT for integration testing',
    });

    expect(created.id).toBe('pat-integration-1');
    expect(created.name).toBe('Integration Test PAT');
    expect(created.description).toBe('PAT for integration testing');
    expect(created.isActive).toBe(true);
    // 暗号化トークンがレスポンスに含まれないこと
    expect(created).not.toHaveProperty('encrypted_token');
    expect(created).not.toHaveProperty('encryptedToken');
    // encryptが呼び出されたこと
    expect(mockEncrypt).toHaveBeenCalledWith(
      'ghp_1234567890123456789012345678901234567890'
    );

    // ===== Step 2: PAT一覧取得 =====
    const secondPATRecord = {
      id: 'pat-integration-2',
      name: 'Second PAT',
      description: null,
      encrypted_token: 'iv2:authTag2:encrypted2',
      is_active: true,
      created_at: new Date('2026-02-13T11:00:00Z'),
      updated_at: new Date('2026-02-13T11:00:00Z'),
    };
    mockDbSelectAll.mockReturnValue([basePATRecord, secondPATRecord]);

    const list = await service.list();

    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('pat-integration-1');
    expect(list[1].id).toBe('pat-integration-2');
    // 暗号化トークンがどの結果にも含まれないこと
    for (const pat of list) {
      expect(pat).not.toHaveProperty('encrypted_token');
      expect(pat).not.toHaveProperty('encryptedToken');
    }

    // ===== Step 3: PAT更新 =====
    const updatedRecord = {
      ...basePATRecord,
      name: 'Updated Integration PAT',
      description: 'Updated description',
      updated_at: new Date('2026-02-13T12:00:00Z'),
    };
    mockDbSelectGet.mockReturnValue(basePATRecord);
    mockDbUpdateGet.mockReturnValue(updatedRecord);

    const updated = await service.update('pat-integration-1', {
      name: 'Updated Integration PAT',
      description: 'Updated description',
    });

    expect(updated.id).toBe('pat-integration-1');
    expect(updated.name).toBe('Updated Integration PAT');
    expect(updated.description).toBe('Updated description');

    // ===== Step 4: PAT有効/無効切り替え =====
    mockDbSelectGet.mockReturnValue(updatedRecord);
    mockDbUpdateGet.mockReturnValue({
      ...updatedRecord,
      is_active: false,
      updated_at: new Date('2026-02-13T13:00:00Z'),
    });

    const toggled = await service.toggleActive('pat-integration-1');

    expect(toggled.isActive).toBe(false);
    expect(toggled.id).toBe('pat-integration-1');

    // ===== Step 5: PAT削除 =====
    mockDbSelectGet.mockReturnValue({
      ...updatedRecord,
      is_active: false,
    });

    await expect(service.delete('pat-integration-1')).resolves.toBeUndefined();
    expect(mockDbDeleteRun).toHaveBeenCalled();
  });

  it('should retrieve PAT token via decryptToken for clone operations', async () => {
    mockDbSelectGet.mockReturnValue(basePATRecord);
    mockDecrypt.mockResolvedValue('ghp_1234567890123456789012345678901234567890');

    const token = await service.decryptToken('pat-integration-1');

    expect(token).toBe('ghp_1234567890123456789012345678901234567890');
    expect(mockDecrypt).toHaveBeenCalledWith('iv_base64:authTag_base64:encrypted_base64');
  });

  it('should handle PAT not found errors consistently across operations', async () => {
    mockDbSelectGet.mockReturnValue(undefined);

    // getByIdはnullを返す（エラーではない）
    const result = await service.getById('non-existent-id');
    expect(result).toBeNull();

    // update, delete, toggleActive, decryptTokenはPATNotFoundErrorをスロー
    await expect(
      service.update('non-existent-id', { name: 'test' })
    ).rejects.toThrow(PATNotFoundError);

    await expect(
      service.delete('non-existent-id')
    ).rejects.toThrow(PATNotFoundError);

    await expect(
      service.toggleActive('non-existent-id')
    ).rejects.toThrow(PATNotFoundError);

    await expect(
      service.decryptToken('non-existent-id')
    ).rejects.toThrow(PATNotFoundError);
  });

  it('should handle encryption errors during PAT creation', async () => {
    mockEncrypt.mockRejectedValue(new Error('Encryption key not configured'));

    await expect(
      service.create({
        name: 'Test PAT',
        token: 'ghp_test_token_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      })
    ).rejects.toThrow(PATEncryptionError);
  });

  it('should handle decryption errors when retrieving PAT token', async () => {
    mockDbSelectGet.mockReturnValue(basePATRecord);
    mockDecrypt.mockRejectedValue(new Error('Decryption failed'));

    await expect(
      service.decryptToken('pat-integration-1')
    ).rejects.toThrow(PATEncryptionError);
  });

  it('should return empty list when no PATs exist', async () => {
    mockDbSelectAll.mockReturnValue([]);

    const list = await service.list();

    expect(list).toEqual([]);
  });

  it('should handle multiple PAT toggle operations', async () => {
    // 有効 -> 無効
    mockDbSelectGet.mockReturnValue(basePATRecord);
    mockDbUpdateGet.mockReturnValue({
      ...basePATRecord,
      is_active: false,
      updated_at: new Date('2026-02-13T12:00:00Z'),
    });

    const firstToggle = await service.toggleActive('pat-integration-1');
    expect(firstToggle.isActive).toBe(false);

    // 無効 -> 有効
    mockDbSelectGet.mockReturnValue({
      ...basePATRecord,
      is_active: false,
    });
    mockDbUpdateGet.mockReturnValue({
      ...basePATRecord,
      is_active: true,
      updated_at: new Date('2026-02-13T13:00:00Z'),
    });

    const secondToggle = await service.toggleActive('pat-integration-1');
    expect(secondToggle.isActive).toBe(true);
  });

  it('should create PAT without description', async () => {
    const recordWithoutDescription = {
      ...basePATRecord,
      description: null,
    };
    mockEncrypt.mockResolvedValue('iv:authTag:encrypted');
    mockDbInsertGet.mockReturnValue(recordWithoutDescription);

    const created = await service.create({
      name: 'PAT Without Description',
      token: 'ghp_nodescription_xxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    expect(created.description).toBeNull();
  });
});
