import { PrismaClient, Prisma } from '@prisma/client';

// Set default DATABASE_URL for tests if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./data/test.db';
}

/**
 * グローバルスコープでPrisma Clientインスタンスを保持するための型定義
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Clientのインスタンスを作成
 *
 * 開発環境ではクエリ、エラー、警告をログ出力し、
 * 本番環境ではエラーのみをログ出力します。
 *
 * @returns 設定されたPrisma Clientインスタンス
 */
function createPrismaClient() {
  const options: Prisma.PrismaClientOptions = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  };

  return new PrismaClient(options);
}

/**
 * Prisma Clientのシングルトンインスタンス
 *
 * Next.jsの開発モードでHot Reloadが発生しても同じインスタンスを使い回すため、
 * グローバルスコープに保存します。本番環境では毎回新しいインスタンスを作成します。
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
