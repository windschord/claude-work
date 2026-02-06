/**
 * CLI ユーティリティ関数
 *
 * テスト可能にするため、cli.ts から抽出した関数群
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * Next.jsビルドが存在し、完全かどうかを確認
 * BUILD_ID、static、serverディレクトリの存在を検証
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns ビルドが完全な場合はtrue、それ以外はfalse
 */
export function checkNextBuild(projectRoot: string): boolean {
  const nextDir = path.join(projectRoot, '.next');
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  const staticDir = path.join(nextDir, 'static');
  const serverDir = path.join(nextDir, 'server');

  // 必須ファイル・ディレクトリが全て存在するか確認
  if (!fs.existsSync(nextDir)) {
    return false;
  }

  if (!fs.existsSync(buildIdPath)) {
    console.log('Build incomplete: BUILD_ID not found');
    return false;
  }

  if (!fs.existsSync(staticDir)) {
    console.log('Build incomplete: static directory not found');
    return false;
  }

  if (!fs.existsSync(serverDir)) {
    console.log('Build incomplete: server directory not found');
    return false;
  }

  return true;
}

/**
 * drizzle-ormがインストールされているか確認
 *
 * projectRoot/node_modules/drizzle-orm を最初に確認し、
 * 見つからない場合は上位ディレクトリの node_modules も探索する。
 * npx実行時はパッケージがフラットにインストールされるため、
 * drizzle-orm が親の node_modules に配置されるケースに対応。
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns drizzle-ormが存在する場合はtrue
 */
export function checkDrizzle(projectRoot: string): boolean {
  let current = path.resolve(projectRoot);
  const root = path.parse(current).root;

  while (current !== root) {
    const drizzlePath = path.join(current, 'node_modules', 'drizzle-orm');
    if (fs.existsSync(drizzlePath)) {
      return true;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return false;
}

/**
 * node_modules/.bin ディレクトリを探索する
 *
 * projectRoot から上位ディレクトリを辿り、node_modules/.bin を探す。
 * npx実行時はバイナリが親の node_modules/.bin に配置されるケースに対応。
 * 見つからない場合は projectRoot/node_modules/.bin をフォールバックとして返す。
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns node_modules/.bin ディレクトリのパス
 */
export function findBinDir(projectRoot: string): string {
  const fallback = path.join(projectRoot, 'node_modules', '.bin');
  let current = path.resolve(projectRoot);
  const root = path.parse(current).root;

  while (current !== root) {
    const binDir = path.join(current, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      return binDir;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return fallback;
}

/**
 * データベースファイルが存在するか確認
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns データベースが存在する場合はtrue
 */
export function checkDatabase(projectRoot: string): boolean {
  const dbPath = path.join(projectRoot, 'data', 'claudework.db');
  return fs.existsSync(dbPath);
}

/**
 * better-sqlite3を使ってデータベースを直接初期化する
 *
 * drizzle-kitに依存せず、CREATE TABLE IF NOT EXISTSで全テーブルを作成する。
 * スキーマはsrc/db/schema.tsのDrizzle定義と一致させている。
 *
 * @param dbPath - SQLiteデータベースファイルのパス
 * @returns 成功した場合はtrue、失敗した場合はfalse
 */
export function initializeDatabase(dbPath: string): boolean {
  let db: InstanceType<typeof Database> | null = null;
  try {
    db = new Database(dbPath);

    // WALモードを有効化（パフォーマンス向上）
    db.pragma('journal_mode = WAL');

    // 外部キー制約を有効化
    db.pragma('foreign_keys = ON');

    // 全テーブルをトランザクション内で作成
    db.transaction(() => {
      // Project テーブル
      db!.exec(`
        CREATE TABLE IF NOT EXISTS "Project" (
          "id" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "path" text NOT NULL,
          "remote_url" text,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // Project.path のユニーク制約
      db!.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Project_path_unique" ON "Project" ("path");
      `);

      // ExecutionEnvironment テーブル
      db!.exec(`
        CREATE TABLE IF NOT EXISTS "ExecutionEnvironment" (
          "id" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "type" text NOT NULL,
          "description" text,
          "config" text NOT NULL,
          "auth_dir_path" text,
          "is_default" integer NOT NULL DEFAULT 0,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // Session テーブル
      db!.exec(`
        CREATE TABLE IF NOT EXISTS "Session" (
          "id" text PRIMARY KEY NOT NULL,
          "project_id" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "status" text NOT NULL,
          "worktree_path" text NOT NULL,
          "branch_name" text NOT NULL,
          "resume_session_id" text,
          "last_activity_at" integer,
          "pr_url" text,
          "pr_number" integer,
          "pr_status" text,
          "pr_updated_at" integer,
          "docker_mode" integer NOT NULL DEFAULT 0,
          "container_id" text,
          "environment_id" text REFERENCES "ExecutionEnvironment"("id") ON DELETE SET NULL,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // Message テーブル
      db!.exec(`
        CREATE TABLE IF NOT EXISTS "Message" (
          "id" text PRIMARY KEY NOT NULL,
          "session_id" text NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE,
          "role" text NOT NULL,
          "content" text NOT NULL,
          "sub_agents" text,
          "created_at" integer NOT NULL
        );
      `);

      // Prompt テーブル
      db!.exec(`
        CREATE TABLE IF NOT EXISTS "Prompt" (
          "id" text PRIMARY KEY NOT NULL,
          "content" text NOT NULL,
          "used_count" integer NOT NULL DEFAULT 1,
          "last_used_at" integer NOT NULL,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // Prompt.content のユニーク制約
      db!.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_content_unique" ON "Prompt" ("content");
      `);

      // RunScript テーブル
      db!.exec(`
        CREATE TABLE IF NOT EXISTS "RunScript" (
          "id" text PRIMARY KEY NOT NULL,
          "project_id" text NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "description" text,
          "command" text NOT NULL,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // RunScript.project_id のインデックス
      db!.exec(`
        CREATE INDEX IF NOT EXISTS "run_scripts_project_id_idx" ON "RunScript" ("project_id");
      `);
    })();

    db.close();
    return true;
  } catch (error) {
    if (db) {
      try {
        db.close();
      } catch {
        // close時のエラーは無視
      }
    }
    console.error('Failed to initialize database:', error);
    return false;
  }
}
