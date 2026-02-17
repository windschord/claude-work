/**
 * CLI ユーティリティ関数
 *
 * テスト可能にするため、cli.ts から抽出した関数群
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';

/**
 * 現在のスキーマバージョン
 *
 * バージョン履歴:
 * - v0: 初期状態（user_versionのデフォルト値）
 * - v1: 初期テーブル作成
 * - v2: claude_code_options, custom_env_vars カラム追加
 */
const CURRENT_DB_VERSION = 3;

/**
 * package.json の位置からパッケージルートを特定する
 *
 * startDir から親ディレクトリを辿り、package.json が存在する最初のディレクトリを返す。
 * TypeScriptソース（src/bin/）でも、コンパイル済み（dist/src/bin/）でも正しく動作する。
 *
 * @param startDir - 探索を開始するディレクトリ
 * @returns パッケージルートのパス
 * @throws {Error} package.json が見つからない場合
 */
function findPackageRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(`Could not find package root (no package.json found from ${startDir})`);
}

/**
 * drizzle-kit pushを使用してデータベーススキーマを同期する
 *
 * src/db/schema.ts の定義に基づき drizzle-kit push を実行し、
 * データベースのスキーマを最新状態に同期する。
 * CLI起動時に自動的に呼び出される。
 *
 * @param databaseUrl - データベースファイルのURL（例: file:../data/claudework.db）
 * @throws {Error} DATABASE_URLが未設定、またはdrizzle-kit pushが失敗した場合
 *
 * @example
 * ```typescript
 * syncSchema(process.env.DATABASE_URL!);
 * ```
 */
export function syncSchema(databaseUrl: string): void {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log('🔄 スキーマ同期中...');

  // パッケージルートをpackage.jsonの位置で特定する
  // process.cwd() はsystemd実行時にパッケージ外のディレクトリになるため使用しない
  const packageRoot = findPackageRoot(__dirname);

  // drizzle-kit は node_modules 内の TypeScript ファイルを処理できないため、
  // コンパイル済みの JS スキーマを参照する一時 JSON 設定ファイルを /tmp に生成する
  const schemaPath = path.join(packageRoot, 'dist', 'src', 'db', 'schema.js');
  const dbPath = databaseUrl.startsWith('file://')
    ? databaseUrl.slice('file://'.length)
    : databaseUrl.replace(/^file:/, '');
  // 設定ファイルはpackageRoot内に生成する。
  // drizzle-kitは設定ファイルの置き場所を起点にdrizzle-ormを探すため、
  // /tmp/に置くとnode_modules/drizzle-ormが見つからずエラーになる。
  const tmpConfig = path.join(packageRoot, `drizzle-push-config-${process.pid}.json`);

  try {
    fs.writeFileSync(
      tmpConfig,
      JSON.stringify({
        schema: schemaPath,
        dialect: 'sqlite',
        dbCredentials: { url: dbPath },
      })
    );

    // cwd をパッケージルートに設定することで、drizzle-kit が drizzle-orm を
    // パッケージの node_modules から解決できるようにする
    const result = spawnSync('npx', ['drizzle-kit', 'push', `--config=${tmpConfig}`], {
      stdio: 'inherit',
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    if (result.error) {
      throw new Error(`Failed to execute drizzle-kit: ${result.error.message}`);
    }

    if (result.signal) {
      throw new Error(`drizzle-kit push was killed by signal ${result.signal}`);
    }

    if (result.status !== 0) {
      throw new Error(`drizzle-kit push failed with exit code ${result.status}`);
    }
  } finally {
    try { fs.unlinkSync(tmpConfig); } catch { /* 一時ファイル削除失敗は無視 */ }
  }

  console.log('✅ スキーマ同期完了');
}

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
 */
function createInitialTables(db: InstanceType<typeof Database>): void {
  // Project テーブル
  db.exec(`
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
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Project_path_unique" ON "Project" ("path");
  `);

  // ExecutionEnvironment テーブル
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

  // Session テーブル
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
      "environment_id" text REFERENCES "ExecutionEnvironment"("id") ON DELETE SET NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );
  `);

  // Message テーブル
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

  // Prompt テーブル
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

  // Prompt.content のユニーク制約
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_content_unique" ON "Prompt" ("content");
  `);

  // RunScript テーブル
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

  // RunScript.project_id のインデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS "run_scripts_project_id_idx" ON "RunScript" ("project_id");
  `);
}

/**
 * claude_code_options カラムを追加（v1 → v2）
 */
function addClaudeCodeOptionsColumns(db: InstanceType<typeof Database>): void {
  // Project テーブル
  safeAddColumn(db, 'Project', 'claude_code_options', 'TEXT NOT NULL DEFAULT "{}"');
  safeAddColumn(db, 'Project', 'custom_env_vars', 'TEXT NOT NULL DEFAULT "{}"');

  // Session テーブル
  safeAddColumn(db, 'Session', 'claude_code_options', 'TEXT');
  safeAddColumn(db, 'Session', 'custom_env_vars', 'TEXT');
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
