import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * db.ts の実装をテスト
 *
 * DATABASE_URL環境変数のバリデーションロジックと
 * PrismaClientのインスタンス化をテストします。
 */
describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('DATABASE_URLが設定されていない場合、エラーをスローする', async () => {
    delete process.env.DATABASE_URL;

    await expect(async () => {
      await import('./db');
    }).rejects.toThrow('DATABASE_URL environment variable is not set');
  });

  it('DATABASE_URLが空文字の場合、エラーをスローする', async () => {
    process.env.DATABASE_URL = '';

    await expect(async () => {
      await import('./db');
    }).rejects.toThrow('DATABASE_URL environment variable is not set');
  });

  it('DATABASE_URLが設定されている場合、エラーをスローしない', async () => {
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    await expect(async () => {
      const db = await import('./db');
      expect(db.prisma).toBeDefined();
    }).resolves.not.toThrow();
  });
});
