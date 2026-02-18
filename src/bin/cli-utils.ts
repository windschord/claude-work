/**
 * CLI ユーティリティ関数
 *
 * テスト可能にするため、cli.ts から抽出した関数群
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * 現在のスキーマバージョン
 *
 * バージョン履歴:
 * - v0: 初期状態（user_versionのデフォルト値）
 * - v1: 初期テーブル作成
 * - v2: claude_code_options, custom_env_vars カラム追加
 * - v3: GitHubPATテーブル作成
 * - v4: Projectに clone_location, docker_volume_id, environment_id を追加
 *       Sessionに active_connections, destroy_at, session_state を追加
 *       Sessionインデックス (session_state, destroy_at, last_activity_at) を追加
 */
const CURRENT_DB_VERSION = 4;

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
 * データベースファイルが存在し、テーブルが初期化されているか確認
 *
 * DATABASE_URL環境変数が外部パスを指している場合、そちらもチェックする。
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns データベースが存在し、テーブルが初期化されている場合はtrue
 */
export function checkDatabase(projectRoot: string): boolean {
  const defaultDbPath = path.join(projectRoot, 'data', 'claudework.db');

  // DATABASE_URLが外部パスを指している場合、そちらもチェック
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim() !== '') {
    let envDbPath: string | null = null;
    if (databaseUrl.startsWith('file://')) {
      const { fileURLToPath } = require('url');
      envDbPath = fileURLToPath(databaseUrl);
    } else if (databaseUrl.startsWith('file:')) {
      envDbPath = databaseUrl.replace(/^file:/, '');
    }

    if (envDbPath && path.resolve(envDbPath) !== path.resolve(defaultDbPath)) {
      // 外部DBが存在しない、またはテーブルが未初期化なら false を返す
      if (!fs.existsSync(envDbPath) || !isDatabaseInitialized(envDbPath)) {
        return false;
      }
    }
  }

  return fs.existsSync(defaultDbPath);
}

/**
 * データベースにテーブルが初期化されているか確認
 *
 * @param dbPath - SQLiteデータベースファイルのパス
 * @returns テーブルが存在する場合はtrue
 */
function isDatabaseInitialized(dbPath: string): boolean {
  let db: InstanceType<typeof Database> | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const row = db.prepare(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='Project'"
    ).get() as { cnt: number } | undefined;
    return (row?.cnt ?? 0) > 0;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/**
 * DBマイグレーションを実行
 *
 * PRAGMA user_versionでバージョン管理を行い、
 * 必要に応じてスキーマを更新する。
 *
 * @param dbPath - SQLiteデータベースファイルのパス
 * @returns 成功した場合はtrue、失敗した場合はfalse
 */
export function migrateDatabase(dbPath: string): boolean {
  let db: InstanceType<typeof Database> | null = null;
  try {
    db = new Database(dbPath);

    // WALモードを有効化（パフォーマンス向上）
    db.pragma('journal_mode = WAL');

    // 外部キー制約を有効化
    db.pragma('foreign_keys = ON');

    // 現在のDBバージョンを取得
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
    let version = row.user_version;

    console.log(`Database version: ${version}, Target: ${CURRENT_DB_VERSION}`);

    if (version >= CURRENT_DB_VERSION) {
      console.log('Database is up to date.');
      db.close();
      return true;
    }

    // トランザクション内でマイグレーション実行
    const runMigration = db.transaction(() => {
      // バージョン 0 → 1: 初期テーブル作成
      if (version < 1) {
        console.log('Migrating to v1: Creating initial tables...');
        createInitialTables(db!);
        version = 1;
      }

      // バージョン 1 → 2: カラム追加
      if (version < 2) {
        console.log('Migrating to v2: Adding claude_code_options columns...');
        addClaudeCodeOptionsColumns(db!);
        version = 2;
      }

      // バージョン 2 → 3: GitHubPATテーブル作成
      if (version < 3) {
        console.log('Migrating to v3: Creating GitHubPAT table...');
        createGitHubPATTable(db!);
        version = 3;
      }

      // バージョン 3 → 4: 欠けているカラム・インデックスを追加
      if (version < 4) {
        migrateV3ToV4(db!);
        version = 4;
      }

      // バージョン番号を更新
      db!.exec(`PRAGMA user_version = ${version}`);
    });

    runMigration();
    console.log(`Database migrated to version ${version}`);

    db.close();
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    if (db) {
      try {
        db.close();
      } catch {
        // close時のエラーは無視
      }
    }
    return false;
  }
}

/**
 * 初期テーブルを作成（v0 → v1）
 *
 * 最新スキーマの全カラム・全インデックスを含む完全版。
 * 新規DBはv0からv1→v2→v3→v4と段階的にマイグレーションされるが、
 * v1で全カラムを作成しておくことで後続マイグレーションはスキップされる。
 */
function createInitialTables(db: InstanceType<typeof Database>): void {
  // Project テーブル（最新スキーマに合わせた完全版）
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Project" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "path" text NOT NULL,
      "remote_url" text,
      "claude_code_options" text NOT NULL DEFAULT '{}',
      "custom_env_vars" text NOT NULL DEFAULT '{}',
      "clone_location" text DEFAULT 'docker',
      "docker_volume_id" text,
      "environment_id" text REFERENCES "ExecutionEnvironment"("id") ON DELETE SET NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Project_path_unique" ON "Project" ("path");
  `);

  // ExecutionEnvironment テーブル（変更なし）
  db.exec(`
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

  // Session テーブル（最新スキーマに合わせた完全版）
  db.exec(`
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
      "claude_code_options" text,
      "custom_env_vars" text,
      "environment_id" text REFERENCES "ExecutionEnvironment"("id") ON DELETE SET NULL,
      "active_connections" integer NOT NULL DEFAULT 0,
      "destroy_at" integer,
      "session_state" text NOT NULL DEFAULT 'ACTIVE',
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS "sessions_session_state_idx" ON "Session" ("session_state");`);
  db.exec(`CREATE INDEX IF NOT EXISTS "sessions_destroy_at_idx" ON "Session" ("destroy_at");`);
  db.exec(`CREATE INDEX IF NOT EXISTS "sessions_last_activity_at_idx" ON "Session" ("last_activity_at");`);

  // Message テーブル（変更なし）
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Message" (
      "id" text PRIMARY KEY NOT NULL,
      "session_id" text NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE,
      "role" text NOT NULL,
      "content" text NOT NULL,
      "sub_agents" text,
      "created_at" integer NOT NULL
    );
  `);

  // Prompt テーブル（変更なし）
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Prompt" (
      "id" text PRIMARY KEY NOT NULL,
      "content" text NOT NULL,
      "used_count" integer NOT NULL DEFAULT 1,
      "last_used_at" integer NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_content_unique" ON "Prompt" ("content");
  `);

  // RunScript テーブル（変更なし）
  db.exec(`
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS "run_scripts_project_id_idx" ON "RunScript" ("project_id");
  `);
}

/**
 * claude_code_options カラムを追加（v1 → v2）
 */
function addClaudeCodeOptionsColumns(db: InstanceType<typeof Database>): void {
  // Project テーブル
  safeAddColumn(db, 'Project', 'claude_code_options', "TEXT NOT NULL DEFAULT '{}'");
  safeAddColumn(db, 'Project', 'custom_env_vars', "TEXT NOT NULL DEFAULT '{}'");

  // Session テーブル
  safeAddColumn(db, 'Session', 'claude_code_options', 'TEXT');
  safeAddColumn(db, 'Session', 'custom_env_vars', 'TEXT');
}

/**
 * GitHubPATテーブルを作成（v2 → v3）
 */
function createGitHubPATTable(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "GitHubPAT" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "encrypted_token" text NOT NULL,
      "is_active" integer NOT NULL DEFAULT 1,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );
  `);
}

/**
 * 欠けているカラム・インデックスを追加（v3 → v4）
 *
 * schema.tsにあるがmigrateDatabase()に欠けていたカラム・インデックスを追加する:
 * - Project: clone_location, docker_volume_id, environment_id
 * - Session: last_activity_at, active_connections, destroy_at, session_state
 * - Sessionインデックス: session_state, destroy_at, last_activity_at
 */
function migrateV3ToV4(db: InstanceType<typeof Database>): void {
  console.log('Migrating to v4: Adding missing columns and indexes...');

  // Project テーブルの欠けているカラムを追加
  safeAddColumn(db, 'Project', 'clone_location', "TEXT DEFAULT 'docker'");
  safeAddColumn(db, 'Project', 'docker_volume_id', 'TEXT');
  safeAddColumn(db, 'Project', 'environment_id', 'TEXT');
  // 注: SQLiteはALTER TABLE ADD COLUMN でFK制約を追加できないため省略

  // Session テーブルの欠けているカラムを追加
  // last_activity_at は v1 のミニマルテーブルには存在しない場合があるため追加
  safeAddColumn(db, 'Session', 'last_activity_at', 'INTEGER');
  safeAddColumn(db, 'Session', 'active_connections', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'Session', 'destroy_at', 'INTEGER');
  safeAddColumn(db, 'Session', 'session_state', "TEXT NOT NULL DEFAULT 'ACTIVE'");

  // インデックスを追加（存在しない場合のみ）
  db.exec(`CREATE INDEX IF NOT EXISTS "sessions_session_state_idx" ON "Session" ("session_state");`);
  db.exec(`CREATE INDEX IF NOT EXISTS "sessions_destroy_at_idx" ON "Session" ("destroy_at");`);
  db.exec(`CREATE INDEX IF NOT EXISTS "sessions_last_activity_at_idx" ON "Session" ("last_activity_at");`);
}

/**
 * カラムを安全に追加（既存の場合はスキップ）
 */
function safeAddColumn(
  db: InstanceType<typeof Database>,
  table: string,
  column: string,
  definition: string
): void {
  try {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    console.log(`  Added ${table}.${column}`);
  } catch (e) {
    // "duplicate column name" エラーは無視
    const errorMessage = String(e);
    if (errorMessage.includes('duplicate column')) {
      console.log(`  ${table}.${column} already exists, skipping`);
    } else {
      throw e;
    }
  }
}

/**
 * データベースを初期化またはマイグレーション
 *
 * PRAGMA user_versionを使用してバージョン管理を行い、
 * 必要に応じてスキーマを更新する。
 *
 * @param dbPath - SQLiteデータベースファイルのパス
 * @returns 成功した場合はtrue、失敗した場合はfalse
 */
export function initializeDatabase(dbPath: string): boolean {
  return migrateDatabase(dbPath);
}
