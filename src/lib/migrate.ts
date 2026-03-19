/**
 * Drizzle ORM標準のマイグレーション実行モジュール
 *
 * drizzle-orm/better-sqlite3/migrator の migrate() を使用して、
 * drizzle/ ディレクトリに配置されたSQLマイグレーションファイルを適用する。
 * __drizzle_migrations テーブルで適用済みマイグレーションを自動追跡する。
 */

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleDb = BetterSQLite3Database<any>;

/**
 * データベースマイグレーションを実行する
 *
 * Drizzle ORM の migrate() を使用して、未適用のマイグレーションを順番に適用する。
 * 既に適用済みのマイグレーションはスキップされる。
 * ベースラインマイグレーションは IF NOT EXISTS を使用しているため、
 * 既存テーブルがあっても安全に実行できる。
 *
 * @param db - Drizzle DBインスタンス（better-sqlite3）
 * @param migrationsFolder - マイグレーションファイルが格納されたディレクトリパス
 * @throws マイグレーション失敗時にエラーをthrow
 */
export function runMigrations(
  db: AnyDrizzleDb,
  migrationsFolder: string,
): void {
  logger.info('Running database migrations...', { migrationsFolder });

  try {
    migrate(db, { migrationsFolder });
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Database migration failed', {
      error: error instanceof Error ? error.message : String(error),
      migrationsFolder,
    });
    throw error;
  }
}
