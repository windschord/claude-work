import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export class EncryptionKeyNotFoundError extends Error {
  constructor() {
    super('ENCRYPTION_KEY environment variable is not configured');
    this.name = 'EncryptionKeyNotFoundError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class EncryptionService {
  private getKey(): Buffer {
    const keyBase64 = process.env.ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new EncryptionKeyNotFoundError();
    }
    const key = Buffer.from(keyBase64, 'base64');

    // AES-256-GCMは32バイト(256bit)鍵が必須
    if (key.length !== 32) {
      throw new EncryptionError(
        `Invalid ENCRYPTION_KEY length: expected 32 bytes (256 bits), got ${key.length} bytes. ` +
        `Please generate a valid key with: openssl rand -base64 32`
      );
    }

    return key;
  }

  isKeyConfigured(): boolean {
    const key = process.env.ENCRYPTION_KEY;
    return typeof key === 'string' && key.length > 0;
  }

  async encrypt(plainText: string): Promise<string> {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  async decrypt(encryptedText: string): Promise<string> {
    const key = this.getKey();

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new DecryptionError('Invalid encrypted text format: expected iv:authTag:encrypted');
    }

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = parts[2];

      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      if (error instanceof DecryptionError) {
        throw error;
      }
      throw new DecryptionError(
        `Failed to decrypt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
