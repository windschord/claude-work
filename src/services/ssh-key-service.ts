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

export class SshKeyService {
  // TODO: implement
  async registerKey(_input: RegisterKeyInput): Promise<SshKeySummary> {
    throw new Error('Not implemented');
  }

  // TODO: implement
  async getAllKeys(): Promise<SshKeySummary[]> {
    throw new Error('Not implemented');
  }

  // TODO: implement
  async getKeyById(_id: string): Promise<SshKeySummary | null> {
    throw new Error('Not implemented');
  }

  // TODO: implement
  async deleteKey(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // TODO: implement
  validateKeyFormat(_privateKey: string): boolean {
    throw new Error('Not implemented');
  }

  // TODO: implement
  async decryptPrivateKey(_id: string): Promise<string> {
    throw new Error('Not implemented');
  }
}
