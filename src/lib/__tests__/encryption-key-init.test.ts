import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Hoisted mocks
const { mockExistsSync, mockReadFileSync, mockWriteFileSync, mockRandomBytes } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockRandomBytes: vi.fn(),
}));

// fsをモック
vi.mock('fs', () => {
  const mockExports = {
    existsSync: mockExistsSync,
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

  it('環境変数ENCRYPTION_KEYが設定済みの場合、ファイル読み書きせずにそのまま使用する', () => {
    const existingKey = 'already-set-key-value';
    process.env.ENCRYPTION_KEY = existingKey;

    ensureEncryptionKey();

    expect(process.env.ENCRYPTION_KEY).toBe(existingKey);
    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('キーファイルが存在する場合、読み込んでprocess.env.ENCRYPTION_KEYに設定する', () => {
    const storedKey = 'stored-key-from-file';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(storedKey);

    ensureEncryptionKey();

    expect(mockExistsSync).toHaveBeenCalledWith(expectedKeyFilePath);
    expect(mockReadFileSync).toHaveBeenCalledWith(expectedKeyFilePath, 'utf-8');
    expect(process.env.ENCRYPTION_KEY).toBe(storedKey);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('環境変数もキーファイルもない場合、キーを生成してファイルに書き込みprocess.envに設定する', () => {
    const fakeRandomBytes = Buffer.alloc(32, 'a');
    const expectedBase64Key = fakeRandomBytes.toString('base64');
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(fakeRandomBytes);

    ensureEncryptionKey();

    expect(mockRandomBytes).toHaveBeenCalledWith(32);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expectedKeyFilePath,
      expectedBase64Key,
      expect.objectContaining({ mode: 0o600 })
    );
    expect(process.env.ENCRYPTION_KEY).toBe(expectedBase64Key);
  });

  it('生成されたキーがBase64エンコードされた32バイトであること', () => {
    const fakeRandomBytes = Buffer.from(
      'abcdefghijklmnopqrstuvwxyz012345' // 32バイト
    );
    const expectedBase64Key = fakeRandomBytes.toString('base64');
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(fakeRandomBytes);

    ensureEncryptionKey();

    const setKey = process.env.ENCRYPTION_KEY!;
    // Base64デコードして32バイトであることを検証
    const decoded = Buffer.from(setKey, 'base64');
    expect(decoded.length).toBe(32);
    // Base64として有効な文字列であることを検証
    expect(setKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(setKey).toBe(expectedBase64Key);
  });

  it('キーファイルのパーミッションが0o600で書き込まれること', () => {
    const fakeRandomBytes = Buffer.alloc(32, 'x');
    mockExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(fakeRandomBytes);

    ensureEncryptionKey();

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expectedKeyFilePath,
      expect.any(String),
      { mode: 0o600 }
    );
  });
});
