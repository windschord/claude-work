import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { EncryptionService } from './encryption-service';

// ==================== エラークラス ====================

export class PATNotFoundError extends Error {
  constructor(id: string) {
    super(`PAT not found: ${id}`);
    this.name = 'PATNotFoundError';
  }
}

export class PATEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PATEncryptionError';
  }
}

// ==================== 型定義 ====================

export interface CreatePATInput {
  name: string;
  token: string;
  description?: string;
}

export interface UpdatePATInput {
  name?: string;
  description?: string;
}

export interface GitHubPATSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== サービスクラス ====================

export class GitHubPATService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * DBレコードからサマリ形式に変換（暗号化トークンを除外）
   */
  private toSummary(record: typeof schema.githubPats.$inferSelect): GitHubPATSummary {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      isActive: record.is_active,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * PAT作成（暗号化して保存）
   */
  async create(data: CreatePATInput): Promise<GitHubPATSummary> {
    let encryptedToken: string;
    try {
      encryptedToken = await this.encryptionService.encrypt(data.token);
    } catch (error) {
      throw new PATEncryptionError(
        `Failed to encrypt PAT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const record = db
      .insert(schema.githubPats)
      .values({
        name: data.name,
        description: data.description ?? null,
        encrypted_token: encryptedToken,
      })
      .returning()
      .get();

    return this.toSummary(record);
  }

  /**
   * PAT一覧取得（復号化せず）
   */
  async list(): Promise<GitHubPATSummary[]> {
    const records = db
      .select()
      .from(schema.githubPats)
      .orderBy(desc(schema.githubPats.created_at))
      .all();

    return records.map((record) => this.toSummary(record));
  }

  /**
   * PAT詳細取得（復号化せず）
   */
  async getById(id: string): Promise<GitHubPATSummary | null> {
    const record = db
      .select()
      .from(schema.githubPats)
      .where(eq(schema.githubPats.id, id))
      .get();

    if (!record) {
      return null;
    }

    return this.toSummary(record);
  }

  /**
   * PAT更新（名前、説明のみ）
   */
  async update(id: string, data: UpdatePATInput): Promise<GitHubPATSummary> {
    const existing = db
      .select()
      .from(schema.githubPats)
      .where(eq(schema.githubPats.id, id))
      .get();

    if (!existing) {
      throw new PATNotFoundError(id);
    }

    const record = db
      .update(schema.githubPats)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updated_at: new Date(),
      })
      .where(eq(schema.githubPats.id, id))
      .returning()
      .get();

    return this.toSummary(record);
  }

  /**
   * PAT削除
   */
  async delete(id: string): Promise<void> {
    const existing = db
      .select()
      .from(schema.githubPats)
      .where(eq(schema.githubPats.id, id))
      .get();

    if (!existing) {
      throw new PATNotFoundError(id);
    }

    db.delete(schema.githubPats)
      .where(eq(schema.githubPats.id, id))
      .run();
  }

  /**
   * PAT有効/無効切り替え
   */
  async toggleActive(id: string): Promise<GitHubPATSummary> {
    const existing = db
      .select()
      .from(schema.githubPats)
      .where(eq(schema.githubPats.id, id))
      .get();

    if (!existing) {
      throw new PATNotFoundError(id);
    }

    const record = db
      .update(schema.githubPats)
      .set({
        is_active: !existing.is_active,
        updated_at: new Date(),
      })
      .where(eq(schema.githubPats.id, id))
      .returning()
      .get();

    return this.toSummary(record);
  }

  /**
   * PAT復号化（clone時のみ使用）
   */
  async decryptToken(id: string): Promise<string> {
    const record = db
      .select()
      .from(schema.githubPats)
      .where(eq(schema.githubPats.id, id))
      .get();

    if (!record) {
      throw new PATNotFoundError(id);
    }

    try {
      return await this.encryptionService.decrypt(record.encrypted_token);
    } catch (error) {
      throw new PATEncryptionError(
        `Failed to decrypt PAT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
