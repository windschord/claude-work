import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Hoisted mocks
const { mockReadFileSync, mockWriteFileSync, mockRandomBytes } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockRandomBytes: vi.fn(),
}));

// fsをモック
vi.mock('fs', () => {
  const mockExports = {
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

// cryptoをモック
vi.mock('crypto', () => {
  const mockExports = {
    randomBytes: mockRandomBytes,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

// data-dirをモック
vi.mock('../data-dir', () => ({
  getDataDir: () => '/mock/data',
}));

import { ensureEncryptionKey } from '../encryption-key-init';

// テスト用の有効な32バイトBase64キー
const VALID_KEY = Buffer.alloc(32, 'a').toString('base64');

describe('ensureEncryptionKey', () => {
  const originalEnv = process.env;
  const expectedKeyFilePath = path.join('/mock/data', 'encryption.key');

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ENCRYPTION_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('環境変数が設定済みの場合', () => {
    it('有効なキーならバリデーション後にそのまま使用し、envを返す', () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;

      const result = ensureEncryptionKey();

      expect(result).toBe('env');
      expect(process.env.ENCRYPTION_KEY).toBe(VALID_KEY);
      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('前後に空白があってもtrimして使用する', () => {
      process.env.ENCRYPTION_KEY = `  ${VALID_KEY}  `;

      const result = ensureEncryptionKey();

      expect(result).toBe('env');
      expect(process.env.ENCRYPTION_KEY).toBe(VALID_KEY);
    });

    it('不正なキー（32バイトでない）の場合はエラーをthrowする', () => {
      process.env.ENCRYPTION_KEY = 'short-key';

      expect(() => ensureEncryptionKey()).toThrow('Invalid ENCRYPTION_KEY from env');
    });

    it('空のキーの場合はエラーをthrowする', () => {
      process.env.ENCRYPTION_KEY = '   ';

      expect(() => ensureEncryptionKey()).toThrow('key is empty');
    });
  });

  describe('キーファイルが存在する場合', () => {
    it('有効なキーを読み込んでprocess.env.ENCRYPTION_KEYに設定し、fileを返す', () => {
      mockReadFileSync.mockReturnValue(VALID_KEY);

      const result = ensureEncryptionKey();

      expect(result).toBe('file');
      expect(mockReadFileSync).toHaveBeenCalledWith(expectedKeyFilePath, 'utf-8');
      expect(process.env.ENCRYPTION_KEY).toBe(VALID_KEY);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('ファイルのキーに前後の空白があってもtrimして使用する', () => {
      mockReadFileSync.mockReturnValue(`${VALID_KEY}\n`);

      const result = ensureEncryptionKey();

      expect(result).toBe('file');
      expect(process.env.ENCRYPTION_KEY).toBe(VALID_KEY);
    });

    it('ファイルのキーが不正な場合はエラーをthrowする', () => {
      mockReadFileSync.mockReturnValue('invalid-key');

      expect(() => ensureEncryptionKey()).toThrow('Invalid ENCRYPTION_KEY from file');
    });
  });

  describe('キーファイルが存在しない場合（ENOENT）', () => {
    beforeEach(() => {
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockReadFileSync.mockImplementationOnce(() => { throw enoentError; });
    });

    it('キーを生成してファイルに書き込みgeneratedを返す', () => {
      const fakeRandomBytes = Buffer.alloc(32, 'a');
      const expectedBase64Key = fakeRandomBytes.toString('base64');
      mockRandomBytes.mockReturnValue(fakeRandomBytes);
      mockWriteFileSync.mockReturnValue(undefined);

      const result = ensureEncryptionKey();

      expect(result).toBe('generated');
      expect(mockRandomBytes).toHaveBeenCalledWith(32);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expectedKeyFilePath,
        expectedBase64Key,
        { mode: 0o600, flag: 'wx' }
      );
      expect(process.env.ENCRYPTION_KEY).toBe(expectedBase64Key);
    });

    it('生成されたキーがBase64エンコードされた32バイトであること', () => {
      const fakeRandomBytes = Buffer.from('abcdefghijklmnopqrstuvwxyz012345');
      const expectedBase64Key = fakeRandomBytes.toString('base64');
      mockRandomBytes.mockReturnValue(fakeRandomBytes);
      mockWriteFileSync.mockReturnValue(undefined);

      ensureEncryptionKey();

      const setKey = process.env.ENCRYPTION_KEY!;
      const decoded = Buffer.from(setKey, 'base64');
      expect(decoded.length).toBe(32);
      expect(setKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(setKey).toBe(expectedBase64Key);
    });

    it('writeFileSyncにflag wxが指定されること', () => {
      const fakeRandomBytes = Buffer.alloc(32, 'x');
      mockRandomBytes.mockReturnValue(fakeRandomBytes);
      mockWriteFileSync.mockReturnValue(undefined);

      ensureEncryptionKey();

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expectedKeyFilePath,
        expect.any(String),
        { mode: 0o600, flag: 'wx' }
      );
    });
  });

  describe('レースコンディション: 書き込み時にEEXIST', () => {
    it('別プロセスが先にファイルを作成した場合、そのファイルを読み込んでfileを返す', () => {
      // 最初のreadFileSync: ENOENT
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockReadFileSync.mockImplementationOnce(() => { throw enoentError; });

      // writeFileSync: EEXIST (別プロセスが先に作成)
      const eexistError = new Error('EEXIST') as NodeJS.ErrnoException;
      eexistError.code = 'EEXIST';
      mockWriteFileSync.mockImplementationOnce(() => { throw eexistError; });

      // 2回目のreadFileSync: 別プロセスが書き込んだキーを読み込み
      mockReadFileSync.mockReturnValueOnce(VALID_KEY);
      mockRandomBytes.mockReturnValue(Buffer.alloc(32, 'a'));

      const result = ensureEncryptionKey();

      expect(result).toBe('file');
      expect(process.env.ENCRYPTION_KEY).toBe(VALID_KEY);
    });
  });

  describe('予期しないエラー', () => {
    it('readFileSyncでENOENT以外のエラーの場合はre-throwする', () => {
      const permError = new Error('EACCES') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockReadFileSync.mockImplementationOnce(() => { throw permError; });

      expect(() => ensureEncryptionKey()).toThrow('EACCES');
    });

    it('writeFileSyncでEEXIST以外のエラーの場合はre-throwする', () => {
      // 最初のreadFileSync: ENOENT
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockReadFileSync.mockImplementationOnce(() => { throw enoentError; });

      // writeFileSync: EACCES
      const permError = new Error('EACCES') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockWriteFileSync.mockImplementationOnce(() => { throw permError; });
      mockRandomBytes.mockReturnValue(Buffer.alloc(32, 'a'));

      expect(() => ensureEncryptionKey()).toThrow('EACCES');
    });
  });
});
