import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 環境変数のモック用
const VALID_KEY_BASE64 = Buffer.from('a'.repeat(32)).toString('base64');

describe('EncryptionService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isKeyConfigured', () => {
    it('ENCRYPTION_KEYが設定されている場合、trueを返す', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();
      expect(service.isKeyConfigured()).toBe(true);
    });

    it('ENCRYPTION_KEYが設定されていない場合、falseを返す', async () => {
      delete process.env.ENCRYPTION_KEY;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();
      expect(service.isKeyConfigured()).toBe(false);
    });

    it('ENCRYPTION_KEYが空文字列の場合、falseを返す', async () => {
      process.env.ENCRYPTION_KEY = '';
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();
      expect(service.isKeyConfigured()).toBe(false);
    });
  });

  describe('Error classes', () => {
    it('EncryptionKeyNotFoundErrorのnameとmessageが正しい', async () => {
      const { EncryptionKeyNotFoundError } = await import('../encryption-service');
      const error = new EncryptionKeyNotFoundError();
      expect(error.name).toBe('EncryptionKeyNotFoundError');
      expect(error.message).toBe('ENCRYPTION_KEY environment variable is not configured');
      expect(error).toBeInstanceOf(Error);
    });

    it('EncryptionErrorのnameが正しい', async () => {
      const { EncryptionError } = await import('../encryption-service');
      const error = new EncryptionError('test message');
      expect(error.name).toBe('EncryptionError');
      expect(error.message).toBe('test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('DecryptionErrorのnameが正しい', async () => {
      const { DecryptionError } = await import('../encryption-service');
      const error = new DecryptionError('test message');
      expect(error.name).toBe('DecryptionError');
      expect(error.message).toBe('test message');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('encrypt', () => {
    it('平文を暗号化し、iv:authTag:encrypted 形式のbase64文字列を返す', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();

      const plainText = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const encrypted = await service.encrypt(plainText);

      // 形式チェック: iv:authTag:encrypted（すべてbase64）
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // 各パートがbase64として有効か確認
      for (const part of parts) {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
        expect(part.length).toBeGreaterThan(0);
      }

      // IVは16バイト（base64で24文字）
      const ivBuffer = Buffer.from(parts[0], 'base64');
      expect(ivBuffer.length).toBe(16);

      // Auth tagは16バイト（base64で24文字）
      const authTagBuffer = Buffer.from(parts[1], 'base64');
      expect(authTagBuffer.length).toBe(16);
    });

    it('同じ平文でも毎回異なる暗号文を生成する（IVがランダムなため）', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();

      const plainText = 'ghp_test_token_12345';
      const encrypted1 = await service.encrypt(plainText);
      const encrypted2 = await service.encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('ENCRYPTION_KEYが未設定の場合、EncryptionKeyNotFoundErrorをスローする', async () => {
      delete process.env.ENCRYPTION_KEY;
      const { EncryptionService, EncryptionKeyNotFoundError } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.encrypt('test')).rejects.toThrow(EncryptionKeyNotFoundError);
      await expect(service.encrypt('test')).rejects.toThrow('ENCRYPTION_KEY environment variable is not configured');
    });

    it('ENCRYPTION_KEYが無効な長さの場合、EncryptionErrorをスローする', async () => {
      // 16バイトのキー(AES-128)を設定 → 32バイト必須なのでエラー
      process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(16)).toString('base64');
      const { EncryptionService, EncryptionError } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.encrypt('test')).rejects.toThrow(EncryptionError);
      await expect(service.encrypt('test')).rejects.toThrow(/Invalid ENCRYPTION_KEY length/);
      await expect(service.encrypt('test')).rejects.toThrow(/expected 32 bytes/);
    });

    it('ENCRYPTION_KEYが短すぎる場合、正確なバイト数をエラーメッセージに含む', async () => {
      process.env.ENCRYPTION_KEY = Buffer.from('short').toString('base64');
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.encrypt('test')).rejects.toThrow(/got 5 bytes/);
      await expect(service.encrypt('test')).rejects.toThrow(/openssl rand -base64 32/);
    });
  });

  describe('decrypt', () => {
    it('暗号化されたテキストを正しく復号化できる', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();

      const originalText = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const encrypted = await service.encrypt(originalText);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it('様々な長さの文字列を暗号化・復号化できる', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();

      const testCases = [
        'short',
        'github_pat_' + 'a'.repeat(82),
        'ghp_' + 'x'.repeat(36),
        'a'.repeat(1000),
      ];

      for (const text of testCases) {
        const encrypted = await service.encrypt(text);
        const decrypted = await service.decrypt(encrypted);
        expect(decrypted).toBe(text);
      }
    });

    it('不正な形式の暗号文はDecryptionErrorをスローする', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService, DecryptionError } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.decrypt('invalid-format')).rejects.toThrow(DecryptionError);
      await expect(service.decrypt('part1:part2')).rejects.toThrow(DecryptionError);
      await expect(service.decrypt('')).rejects.toThrow(DecryptionError);
    });

    it('不正な形式の暗号文のエラーメッセージが正しい', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.decrypt('invalid-format')).rejects.toThrow(
        'Invalid encrypted text format: expected iv:authTag:encrypted'
      );
    });

    it('4つ以上のパーツがある場合もDecryptionErrorをスローする', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService, DecryptionError } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.decrypt('a:b:c:d')).rejects.toThrow(DecryptionError);
    });

    it('改ざんされた暗号文はDecryptionErrorをスローする', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const { EncryptionService, DecryptionError } = await import('../encryption-service');
      const service = new EncryptionService();

      const originalText = 'ghp_test_token';
      const encrypted = await service.encrypt(originalText);
      const parts = encrypted.split(':');

      // 暗号文を改ざん
      const tamperedEncrypted = Buffer.from('tampered_data').toString('base64');
      const tampered = `${parts[0]}:${parts[1]}:${tamperedEncrypted}`;

      await expect(service.decrypt(tampered)).rejects.toThrow(DecryptionError);
      await expect(service.decrypt(tampered)).rejects.toThrow(/Failed to decrypt:/);
    });

    it('ENCRYPTION_KEYが未設定の場合、EncryptionKeyNotFoundErrorをスローする', async () => {
      delete process.env.ENCRYPTION_KEY;
      const { EncryptionService, EncryptionKeyNotFoundError } = await import('../encryption-service');
      const service = new EncryptionService();

      await expect(service.decrypt('dummy:dummy:dummy')).rejects.toThrow(EncryptionKeyNotFoundError);
    });

    it('異なるキーで暗号化されたデータは復号化できない', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY_BASE64;
      const mod1 = await import('../encryption-service');
      const service1 = new mod1.EncryptionService();

      const encrypted = await service1.encrypt('secret_token');

      // 異なるキーで復号化を試みる
      vi.resetModules();
      process.env.ENCRYPTION_KEY = Buffer.from('b'.repeat(32)).toString('base64');
      const mod2 = await import('../encryption-service');
      const service2 = new mod2.EncryptionService();

      await expect(service2.decrypt(encrypted)).rejects.toThrow(mod2.DecryptionError);
    });
  });
});
