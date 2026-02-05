import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

// 型の再エクスポート（他のファイルから @/lib/db 経由でインポート可能）
export type {
  Project,
  Session,
  Message,
  Prompt,
  RunScript,
  ExecutionEnvironment,
  NewProject,
  NewSession,
  NewMessage,
  NewPrompt,
  NewRunScript,
  NewExecutionEnvironment,
} from '@/db/schema';

// DATABASE_URL環境変数の検証
const envDatabaseUrl = process.env.DATABASE_URL;

if (!envDatabaseUrl || envDatabaseUrl.trim() === '') {
  throw new Error(
    'DATABASE_URL environment variable is not set. ' +
    'Please set it in your .env file. ' +
    'Example: DATABASE_URL=file:../data/claudework.db'
  );
}

// file:プレフィックスを除去してパスを取得
const dbPath = envDatabaseUrl.replace(/^file:/, '');

// データベースディレクトリが存在しない場合は作成
const dbDir = path.dirname(dbPath);
if (dbDir && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/**
 * グローバルスコープでDrizzle DBインスタンスを保持するための型定義
 */
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

/**
 * Drizzle DBのインスタンスを作成
 *
 * better-sqlite3を使用してSQLiteに接続し、WALモードを有効化します。
 *
 * @returns 設定されたDrizzle DBインスタンス
 */
function createDb() {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}

/**
 * Drizzle DBのシングルトンインスタンス
 *
 * Next.jsの開発モードでHot Reloadが発生しても同じインスタンスを使い回すため、
 * グローバルスコープに保存します。本番環境では毎回新しいインスタンスを作成します。
 */
export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

// スキーマの再エクスポート
export { schema };

// デフォルトエクスポート
export default db;
