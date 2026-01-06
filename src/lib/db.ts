import { PrismaClient, Prisma } from '@prisma/client';

/**
 * グローバルスコープでPrisma Clientインスタンスを保持するための型定義
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * DATABASE_URL環境変数を検証
 * ビルド時（NEXT_PHASEが設定されている時）はスキップ
 */
function validateDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const isBuilding = !!process.env.NEXT_PHASE;

  if (!isBuilding && (!databaseUrl || databaseUrl.trim() === '')) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please set it in your .env file. ' +
      'Example: DATABASE_URL=file:../data/claudework.db'
    );
  }
}

/**
 * Prisma Clientのインスタンスを取得
 *
 * 開発環境ではクエリ、エラー、警告をログ出力し、
 * 本番環境ではエラーのみをログ出力します。
 *
 * @returns 設定されたPrisma Clientインスタンス
 */
function getPrismaClient(): PrismaClient {
  // ビルド時はダミーのクライアントを返す（実際には使われない）
  if (process.env.NEXT_PHASE) {
    return {} as PrismaClient;
  }

  validateDatabaseUrl();

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const options: Prisma.PrismaClientOptions = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  };

  const client = new PrismaClient(options);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

/**
 * Prisma Clientのシングルトンインスタンス
 *
 * Next.jsの開発モードでHot Reloadが発生しても同じインスタンスを使い回すため、
 * グローバルスコープに保存します。本番環境では毎回新しいインスタンスを作成します。
 *
 * 注意: ビルド時（NEXT_PHASEが設定されている時）はダミーオブジェクトが返されます。
 */
export const prisma = getPrismaClient();

export default prisma;
