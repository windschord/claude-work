import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { EncryptionService } from './encryption-service';

// ==================== Error Classes ====================

export class SshKeyNotFoundError extends Error {
  constructor(id: string) {
    super(`SSH key not found: ${id}`);
    this.name = 'SshKeyNotFoundError';
  }
}

export class DuplicateSshKeyNameError extends Error {
  constructor(name: string) {
    super(`SSH key name already exists: ${name}`);
    this.name = 'DuplicateSshKeyNameError';
  }
}

export class InvalidSshKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSshKeyError';
  }
}

export class SshKeyEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SshKeyEncryptionError';
  }
}

// ==================== Type Definitions ====================

export interface RegisterKeyInput {
  name: string;
  publicKey: string;
  privateKey: string;
  hasPassphrase: boolean;
}

export interface SshKeySummary {
  id: string;
  name: string;
  publicKey: string;
  hasPassphrase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Service Class ====================

const PRIVATE_KEY_PATTERNS = [
  /^-----BEGIN OPENSSH PRIVATE KEY-----/m,
  /^-----BEGIN RSA PRIVATE KEY-----/m,
  /^-----BEGIN EC PRIVATE KEY-----/m,
  /^-----BEGIN DSA PRIVATE KEY-----/m,
  /^-----BEGIN PRIVATE KEY-----/m,
];

export class SshKeyService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  private toSummary(record: typeof schema.sshKeys.$inferSelect): SshKeySummary {
    return {
      id: record.id,
      name: record.name,
      publicKey: record.public_key,
      hasPassphrase: record.has_passphrase,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  validateKeyFormat(privateKey: string): boolean {
    if (!privateKey || privateKey.trim().length === 0) {
      return false;
    }
    return PRIVATE_KEY_PATTERNS.some((pattern) => pattern.test(privateKey));
  }

  async registerKey(input: RegisterKeyInput): Promise<SshKeySummary> {
    // Check for duplicate name
    const existing = db
      .select()
      .from(schema.sshKeys)
      .where(eq(schema.sshKeys.name, input.name))
      .get();

    if (existing) {
      throw new DuplicateSshKeyNameError(input.name);
    }

    // Validate key format
    if (!this.validateKeyFormat(input.privateKey)) {
      throw new InvalidSshKeyError('Invalid SSH private key format');
    }

    // Encrypt private key
    let encryptedPrivateKey: string;
    try {
      encryptedPrivateKey = await this.encryptionService.encrypt(input.privateKey);
    } catch (error) {
      throw new SshKeyEncryptionError(
        `Failed to encrypt SSH private key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Extract IV from encrypted format (iv:authTag:encrypted)
    const iv = encryptedPrivateKey.split(':')[0];

    const record = db
      .insert(schema.sshKeys)
      .values({
        name: input.name,
        public_key: input.publicKey,
        private_key_encrypted: encryptedPrivateKey,
        encryption_iv: iv,
        has_passphrase: input.hasPassphrase,
      })
      .returning()
      .get();

    return this.toSummary(record);
  }

  async getAllKeys(): Promise<SshKeySummary[]> {
    const records = db
      .select()
      .from(schema.sshKeys)
      .orderBy(desc(schema.sshKeys.created_at))
      .all();

    return records.map((record) => this.toSummary(record));
  }

  async getKeyById(id: string): Promise<SshKeySummary | null> {
    const record = db
      .select()
      .from(schema.sshKeys)
      .where(eq(schema.sshKeys.id, id))
      .get();

    if (!record) {
      return null;
    }

    return this.toSummary(record);
  }

  async deleteKey(id: string): Promise<void> {
    const existing = db
      .select()
      .from(schema.sshKeys)
      .where(eq(schema.sshKeys.id, id))
      .get();

    if (!existing) {
      throw new SshKeyNotFoundError(id);
    }

    db.delete(schema.sshKeys)
      .where(eq(schema.sshKeys.id, id))
      .run();
  }

  async decryptPrivateKey(id: string): Promise<string> {
    const record = db
      .select()
      .from(schema.sshKeys)
      .where(eq(schema.sshKeys.id, id))
      .get();

    if (!record) {
      throw new SshKeyNotFoundError(id);
    }

    try {
      return await this.encryptionService.decrypt(record.private_key_encrypted);
    } catch (error) {
      throw new SshKeyEncryptionError(
        `Failed to decrypt SSH private key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
