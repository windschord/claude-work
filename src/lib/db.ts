import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, Prisma } from '../../prisma/generated/prisma/client';

// 型の再エクスポート（他のファイルから @/lib/db 経由でインポート可能）
export type {
  Project,
  Session,
  Message,
  Prompt,
  RunScript,
  ExecutionEnvironment,
} from '../../prisma/generated/prisma/client';

// DATABASE_URL環境変数の検証
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.trim() === '') {
  throw new Error(
    'DATABASE_URL environment variable is not set. ' +
    'Please set it in your .env file. ' +
    'Example: DATABASE_URL=file:../data/claudework.db'
  );
}

// SQLite アダプターを作成
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

/**
 * グローバルスコープでPrisma Clientインスタンスを保持するための型定義
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Clientのインスタンスを作成
 *
 * Prisma 7 ではアダプターパターンを使用してデータベースに接続します。
 *
 * @returns 設定されたPrisma Clientインスタンス
 */
function createPrismaClient() {
  return new PrismaClient({ adapter });
}

/**
 * Prisma Clientのシングルトンインスタンス
 *
 * Next.jsの開発モードでHot Reloadが発生しても同じインスタンスを使い回すため、
 * グローバルスコープに保存します。本番環境では毎回新しいインスタンスを作成します。
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Prisma 名前空間も再エクスポート
export { Prisma };

export default prisma;
