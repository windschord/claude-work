import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモックを先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockDbInsertGet,
  mockDbDeleteRun,
  mockEncrypt,
  mockDecrypt,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockDbInsertGet: vi.fn(),
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
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockDbDeleteRun,
      })),
    })),
  },
  schema: {
    sshKeys: {
      id: 'id',
      name: 'name',
      public_key: 'public_key',
      private_key_encrypted: 'private_key_encrypted',
      encryption_iv: 'encryption_iv',
      has_passphrase: 'has_passphrase',
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
  SshKeyService,
  SshKeyNotFoundError,
  DuplicateSshKeyNameError,
  InvalidSshKeyError,
  SshKeyEncryptionError,
} from '../ssh-key-service';

// テスト用のSSH鍵サンプル
const SAMPLE_RSA_PRIVATE_KEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
NhAAAAAwEAAQAAAYEA0example1234567890abcdefghijklmnopqrstuvwxyz
-----END OPENSSH PRIVATE KEY-----`;

const SAMPLE_RSA_PUBLIC_KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDT... user@host';

const SAMPLE_ED25519_PRIVATE_KEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBexample1234567890abcdefghij
-----END OPENSSH PRIVATE KEY-----`;

const SAMPLE_ED25519_PUBLIC_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... user@host';

const SAMPLE_ECDSA_PRIVATE_KEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAaAAAABNlY2RzYS
1zaGEyLW5pc3RwMjU2AAAACG5pc3RwMjU2example
-----END OPENSSH PRIVATE KEY-----`;

// PEM形式のRSA秘密鍵
const SAMPLE_PEM_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0example1234567890abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;

describe('SshKeyService', () => {
  let service: SshKeyService;

  const mockSshKeyRecord = {
    id: 'ssh-key-uuid-1',
    name: 'GitHub Personal',
    public_key: SAMPLE_RSA_PUBLIC_KEY,
    private_key_encrypted: 'iv:authTag:encryptedData',
    encryption_iv: 'mock-iv-base64',
    has_passphrase: false,
    created_at: new Date('2026-02-19T12:00:00Z'),
    updated_at: new Date('2026-02-19T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SshKeyService();
  });

  // ==================== registerKey ====================

  describe('registerKey', () => {
    it('SSH鍵を暗号化して保存し、公開鍵情報を含む結果を返す', async () => {
      mockEncrypt.mockResolvedValue('iv:authTag:encryptedData');
      mockDbInsertGet.mockReturnValue(mockSshKeyRecord);
      // 名前重複チェック用: 既存レコードなし
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.registerKey({
        name: 'GitHub Personal',
        publicKey: SAMPLE_RSA_PUBLIC_KEY,
        privateKey: SAMPLE_RSA_PRIVATE_KEY,
        hasPassphrase: false,
      });

      expect(mockEncrypt).toHaveBeenCalledWith(SAMPLE_RSA_PRIVATE_KEY);
      expect(result).toEqual({
        id: 'ssh-key-uuid-1',
        name: 'GitHub Personal',
        publicKey: SAMPLE_RSA_PUBLIC_KEY,
        hasPassphrase: false,
        createdAt: mockSshKeyRecord.created_at,
        updatedAt: mockSshKeyRecord.updated_at,
      });
      // 暗号化された秘密鍵が結果に含まれないことを確認
      expect(result).not.toHaveProperty('private_key_encrypted');
      expect(result).not.toHaveProperty('privateKeyEncrypted');
      expect(result).not.toHaveProperty('privateKey');
    });

    it('パスフレーズ付きの鍵を登録できる', async () => {
      const recordWithPassphrase = {
        ...mockSshKeyRecord,
        has_passphrase: true,
      };
      mockEncrypt.mockResolvedValue('iv:authTag:encryptedData');
      mockDbInsertGet.mockReturnValue(recordWithPassphrase);
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.registerKey({
        name: 'GitHub Personal',
        publicKey: SAMPLE_RSA_PUBLIC_KEY,
        privateKey: SAMPLE_RSA_PRIVATE_KEY,
        hasPassphrase: true,
      });

      expect(result.hasPassphrase).toBe(true);
    });

    it('名前が重複している場合、DuplicateSshKeyNameErrorをスローする', async () => {
      // 名前重複チェック用: 既存レコードあり
      mockDbSelectGet.mockReturnValue(mockSshKeyRecord);

      await expect(
        service.registerKey({
          name: 'GitHub Personal',
          publicKey: SAMPLE_RSA_PUBLIC_KEY,
          privateKey: SAMPLE_RSA_PRIVATE_KEY,
          hasPassphrase: false,
        })
      ).rejects.toThrow(DuplicateSshKeyNameError);
    });

    it('暗号化に失敗した場合、SshKeyEncryptionErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);
      mockEncrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(
        service.registerKey({
          name: 'New Key',
          publicKey: SAMPLE_RSA_PUBLIC_KEY,
          privateKey: SAMPLE_RSA_PRIVATE_KEY,
          hasPassphrase: false,
        })
      ).rejects.toThrow(SshKeyEncryptionError);
    });

    it('無効な秘密鍵形式の場合、InvalidSshKeyErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(
        service.registerKey({
          name: 'Bad Key',
          publicKey: SAMPLE_RSA_PUBLIC_KEY,
          privateKey: 'this is not a valid ssh key',
          hasPassphrase: false,
        })
      ).rejects.toThrow(InvalidSshKeyError);
    });
  });

  // ==================== getAllKeys ====================

  describe('getAllKeys', () => {
    it('全てのSSH鍵をサマリ形式で返す（秘密鍵を含まない）', async () => {
      const mockRecords = [
        mockSshKeyRecord,
        {
          ...mockSshKeyRecord,
          id: 'ssh-key-uuid-2',
          name: 'Work Bitbucket',
          public_key: SAMPLE_ED25519_PUBLIC_KEY,
          has_passphrase: true,
        },
      ];
      mockDbSelectAll.mockReturnValue(mockRecords);

      const result = await service.getAllKeys();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'ssh-key-uuid-1',
        name: 'GitHub Personal',
        publicKey: SAMPLE_RSA_PUBLIC_KEY,
        hasPassphrase: false,
        createdAt: mockSshKeyRecord.created_at,
        updatedAt: mockSshKeyRecord.updated_at,
      });
      expect(result[1]).toEqual({
        id: 'ssh-key-uuid-2',
        name: 'Work Bitbucket',
        publicKey: SAMPLE_ED25519_PUBLIC_KEY,
        hasPassphrase: true,
        createdAt: mockSshKeyRecord.created_at,
        updatedAt: mockSshKeyRecord.updated_at,
      });
      // 秘密鍵情報が含まれないことを確認
      for (const key of result) {
        expect(key).not.toHaveProperty('private_key_encrypted');
        expect(key).not.toHaveProperty('privateKeyEncrypted');
        expect(key).not.toHaveProperty('encryption_iv');
      }
    });

    it('SSH鍵が存在しない場合、空配列を返す', async () => {
      mockDbSelectAll.mockReturnValue([]);

      const result = await service.getAllKeys();

      expect(result).toEqual([]);
    });
  });

  // ==================== getKeyById ====================

  describe('getKeyById', () => {
    it('指定IDのSSH鍵をサマリ形式で返す', async () => {
      mockDbSelectGet.mockReturnValue(mockSshKeyRecord);

      const result = await service.getKeyById('ssh-key-uuid-1');

      expect(result).toEqual({
        id: 'ssh-key-uuid-1',
        name: 'GitHub Personal',
        publicKey: SAMPLE_RSA_PUBLIC_KEY,
        hasPassphrase: false,
        createdAt: mockSshKeyRecord.created_at,
        updatedAt: mockSshKeyRecord.updated_at,
      });
    });

    it('存在しないIDの場合、nullを返す', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.getKeyById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  // ==================== deleteKey ====================

  describe('deleteKey', () => {
    it('指定IDのSSH鍵を削除する', async () => {
      mockDbSelectGet.mockReturnValue(mockSshKeyRecord);

      await expect(service.deleteKey('ssh-key-uuid-1')).resolves.toBeUndefined();
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });

    it('存在しないIDの場合、SshKeyNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.deleteKey('non-existent-id')).rejects.toThrow(SshKeyNotFoundError);
    });
  });

  // ==================== validateKeyFormat ====================

  describe('validateKeyFormat', () => {
    it('OpenSSH形式のRSA秘密鍵を有効と判定する', () => {
      expect(service.validateKeyFormat(SAMPLE_RSA_PRIVATE_KEY)).toBe(true);
    });

    it('OpenSSH形式のEd25519秘密鍵を有効と判定する', () => {
      expect(service.validateKeyFormat(SAMPLE_ED25519_PRIVATE_KEY)).toBe(true);
    });

    it('OpenSSH形式のECDSA秘密鍵を有効と判定する', () => {
      expect(service.validateKeyFormat(SAMPLE_ECDSA_PRIVATE_KEY)).toBe(true);
    });

    it('PEM形式のRSA秘密鍵を有効と判定する', () => {
      expect(service.validateKeyFormat(SAMPLE_PEM_PRIVATE_KEY)).toBe(true);
    });

    it('無効な文字列を無効と判定する', () => {
      expect(service.validateKeyFormat('not a key')).toBe(false);
    });

    it('空文字列を無効と判定する', () => {
      expect(service.validateKeyFormat('')).toBe(false);
    });

    it('公開鍵を秘密鍵として渡した場合、無効と判定する', () => {
      expect(service.validateKeyFormat(SAMPLE_RSA_PUBLIC_KEY)).toBe(false);
    });

    it('PEM形式のEC秘密鍵を有効と判定する', () => {
      const ecPemKey = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIODg4OTg5ODk4OTg5ODk4OTg5ODk4OTg5ODk4OTg5ODkoAcGBSuBBAAi
-----END EC PRIVATE KEY-----`;
      expect(service.validateKeyFormat(ecPemKey)).toBe(true);
    });

    it('DSA秘密鍵を有効と判定する', () => {
      const dsaPemKey = `-----BEGIN DSA PRIVATE KEY-----
MIIBugIBAAKBgQD0example
-----END DSA PRIVATE KEY-----`;
      expect(service.validateKeyFormat(dsaPemKey)).toBe(true);
    });
  });

  // ==================== decryptPrivateKey ====================

  describe('decryptPrivateKey', () => {
    it('指定IDのSSH秘密鍵を復号化して返す', async () => {
      mockDbSelectGet.mockReturnValue(mockSshKeyRecord);
      mockDecrypt.mockResolvedValue(SAMPLE_RSA_PRIVATE_KEY);

      const result = await service.decryptPrivateKey('ssh-key-uuid-1');

      expect(mockDecrypt).toHaveBeenCalledWith('iv:authTag:encryptedData');
      expect(result).toBe(SAMPLE_RSA_PRIVATE_KEY);
    });

    it('存在しないIDの場合、SshKeyNotFoundErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.decryptPrivateKey('non-existent-id')).rejects.toThrow(SshKeyNotFoundError);
    });

    it('復号化に失敗した場合、SshKeyEncryptionErrorをスローする', async () => {
      mockDbSelectGet.mockReturnValue(mockSshKeyRecord);
      mockDecrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(service.decryptPrivateKey('ssh-key-uuid-1')).rejects.toThrow(SshKeyEncryptionError);
    });
  });
});
