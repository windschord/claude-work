/**
 * cli-utils のテスト
 *
 * 注意: このテストはSQLiteデータベース操作を含むため、実際のファイルシステムを使用します。
 * better-sqlite3 が内部で fs を使用するため、fs のモック化は現実的ではありません。
 * テスト用の一時ディレクトリを作成・削除することで分離を保証しています。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkNextBuild, checkDrizzle, checkDatabase, findBinDir, initializeDatabase, migrateDatabase } from '../cli-utils';

describe('cli-utils', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'cli-utils-test-'));
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkNextBuild', () => {
    it('should return false when .next directory does not exist', () => {
      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return false when only .next directory exists (no BUILD_ID)', () => {
      mkdirSync(join(testDir, '.next'));
      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return false when BUILD_ID exists but static directory is missing', () => {
      const nextDir = join(testDir, '.next');
      mkdirSync(nextDir);
      writeFileSync(join(nextDir, 'BUILD_ID'), 'test-build-id');
      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return false when BUILD_ID and static exist but server directory is missing', () => {
      const nextDir = join(testDir, '.next');
      mkdirSync(nextDir);
      writeFileSync(join(nextDir, 'BUILD_ID'), 'test-build-id');
      mkdirSync(join(nextDir, 'static'));
      const result = checkNextBuild(testDir);
      expect(result).toBe(false);
    });

    it('should return true when all required files and directories exist', () => {
      const nextDir = join(testDir, '.next');
      mkdirSync(nextDir);
      writeFileSync(join(nextDir, 'BUILD_ID'), 'test-build-id');
      mkdirSync(join(nextDir, 'static'));
      mkdirSync(join(nextDir, 'server'));
      const result = checkNextBuild(testDir);
      expect(result).toBe(true);
    });
  });

  describe('checkDrizzle', () => {
    it('should return false when drizzle-orm does not exist', () => {
      const result = checkDrizzle(testDir);
      expect(result).toBe(false);
    });

    it('should return true when drizzle-orm directory exists', () => {
      const drizzleDir = join(testDir, 'node_modules', 'drizzle-orm');
      mkdirSync(drizzleDir, { recursive: true });
      const result = checkDrizzle(testDir);
      expect(result).toBe(true);
    });

    it('should return false when only node_modules exists', () => {
      mkdirSync(join(testDir, 'node_modules'));
      const result = checkDrizzle(testDir);
      expect(result).toBe(false);
    });

    it('should return true when drizzle-orm exists in parent node_modules (npx flat structure)', () => {
      const parentNodeModules = join(testDir, 'node_modules');
      mkdirSync(join(parentNodeModules, 'drizzle-orm'), { recursive: true });
      const projectRoot = join(parentNodeModules, 'claude-work');
      mkdirSync(projectRoot, { recursive: true });
      const result = checkDrizzle(projectRoot);
      expect(result).toBe(true);
    });

    it('should return false when drizzle-orm does not exist in any ancestor node_modules', () => {
      const parentNodeModules = join(testDir, 'node_modules');
      const projectRoot = join(parentNodeModules, 'claude-work');
      mkdirSync(projectRoot, { recursive: true });
      const result = checkDrizzle(projectRoot);
      expect(result).toBe(false);
    });
  });

  describe('findBinDir', () => {
    it('should return local .bin when it exists in projectRoot', () => {
      const binDir = join(testDir, 'node_modules', '.bin');
      mkdirSync(binDir, { recursive: true });
      const result = findBinDir(testDir);
      expect(result).toBe(binDir);
    });

    it('should return parent .bin when projectRoot has no .bin (npx flat structure)', () => {
      const parentNodeModules = join(testDir, 'node_modules');
      const parentBinDir = join(parentNodeModules, '.bin');
      mkdirSync(parentBinDir, { recursive: true });
      const projectRoot = join(parentNodeModules, 'claude-work');
      mkdirSync(projectRoot, { recursive: true });
      const result = findBinDir(projectRoot);
      expect(result).toBe(parentBinDir);
    });

    it('should return local .bin as fallback when not found anywhere', () => {
      const result = findBinDir(testDir);
      expect(result).toBe(join(testDir, 'node_modules', '.bin'));
    });
  });

  describe('checkDatabase', () => {
    it('should return false when database file does not exist', () => {
      const result = checkDatabase(testDir);
      expect(result).toBe(false);
    });

    it('should return true when database file exists', () => {
      const dataDir = join(testDir, 'data');
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'claudework.db'), '');
      const result = checkDatabase(testDir);
      expect(result).toBe(true);
    });

    it('should return false when data directory exists but database file does not', () => {
      mkdirSync(join(testDir, 'data'));
      const result = checkDatabase(testDir);
      expect(result).toBe(false);
    });
  });

  describe('initializeDatabase', () => {
    it('should create all required tables and return true', () => {
      const dbPath = join(testDir, 'test.db');
      const result = initializeDatabase(dbPath);
      expect(result).toBe(true);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as { name: string }[];
      const tableNames = tables.map((t: { name: string }) => t.name);

      expect(tableNames).toContain('Project');
      expect(tableNames).toContain('ExecutionEnvironment');
      expect(tableNames).toContain('Session');
      expect(tableNames).toContain('Message');
      expect(tableNames).toContain('Prompt');
      expect(tableNames).toContain('RunScript');
      db.close();
    });

    it('should create Project table with correct columns including new migration columns', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const columns = db.prepare("PRAGMA table_info('Project')").all() as {
        name: string; type: string; notnull: number; pk: number;
      }[];
      const columnNames = columns.map((c) => c.name);
      // v2マイグレーションで追加されるカラムを含む
      expect(columnNames).toEqual([
        'id', 'name', 'path', 'remote_url', 'created_at', 'updated_at',
        'claude_code_options', 'custom_env_vars',
      ]);

      const idCol = columns.find((c) => c.name === 'id');
      expect(idCol?.pk).toBe(1);
      expect(idCol?.type.toLowerCase()).toBe('text');

      const nameCol = columns.find((c) => c.name === 'name');
      expect(nameCol?.notnull).toBe(1);
      expect(nameCol?.type.toLowerCase()).toBe('text');

      const pathCol = columns.find((c) => c.name === 'path');
      expect(pathCol?.notnull).toBe(1);

      const remoteUrlCol = columns.find((c) => c.name === 'remote_url');
      expect(remoteUrlCol?.notnull).toBe(0);

      const createdAtCol = columns.find((c) => c.name === 'created_at');
      expect(createdAtCol?.notnull).toBe(1);
      expect(createdAtCol?.type.toLowerCase()).toBe('integer');

      const updatedAtCol = columns.find((c) => c.name === 'updated_at');
      expect(updatedAtCol?.notnull).toBe(1);

      // v2で追加されたカラム
      const claudeOptionsCol = columns.find((c) => c.name === 'claude_code_options');
      expect(claudeOptionsCol?.notnull).toBe(1);

      const customEnvCol = columns.find((c) => c.name === 'custom_env_vars');
      expect(customEnvCol?.notnull).toBe(1);
      db.close();
    });

    it('should create Project table with unique constraint on path', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const indexes = db.prepare(
        "SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='Project'"
      ).all() as { name: string; sql: string | null }[];
      const uniqueIndex = indexes.find((idx) => idx.sql && idx.sql.includes('path'));
      expect(uniqueIndex).toBeDefined();
      db.close();
    });

    it('should create ExecutionEnvironment table with correct columns', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const columns = db.prepare("PRAGMA table_info('ExecutionEnvironment')").all() as {
        name: string; type: string; notnull: number; dflt_value: string | null;
      }[];
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toEqual([
        'id', 'name', 'type', 'description', 'config',
        'auth_dir_path', 'is_default', 'created_at', 'updated_at',
      ]);

      const isDefaultCol = columns.find((c) => c.name === 'is_default');
      expect(isDefaultCol?.notnull).toBe(1);
      expect(isDefaultCol?.dflt_value).toBe('0');
      db.close();
    });

    it('should create Session table with correct columns and foreign keys', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const columns = db.prepare("PRAGMA table_info('Session')").all() as {
        name: string; type: string; notnull: number; dflt_value: string | null;
      }[];
      const columnNames = columns.map((c) => c.name);
      // v2マイグレーションで追加されるカラムを含む
      expect(columnNames).toEqual([
        'id', 'project_id', 'name', 'status', 'worktree_path', 'branch_name',
        'resume_session_id', 'last_activity_at', 'pr_url', 'pr_number',
        'pr_status', 'pr_updated_at', 'docker_mode', 'container_id',
        'environment_id', 'created_at', 'updated_at',
        'claude_code_options', 'custom_env_vars',
      ]);

      const dockerModeCol = columns.find((c) => c.name === 'docker_mode');
      expect(dockerModeCol?.notnull).toBe(1);
      expect(dockerModeCol?.dflt_value).toBe('0');

      // v2で追加されたカラム（nullable）
      const claudeOptionsCol = columns.find((c) => c.name === 'claude_code_options');
      expect(claudeOptionsCol?.notnull).toBe(0);

      const customEnvCol = columns.find((c) => c.name === 'custom_env_vars');
      expect(customEnvCol?.notnull).toBe(0);

      const fks = db.prepare("PRAGMA foreign_key_list('Session')").all() as {
        table: string; from: string; to: string; on_delete: string;
      }[];
      const projectFk = fks.find((fk) => fk.from === 'project_id');
      expect(projectFk?.table).toBe('Project');
      expect(projectFk?.to).toBe('id');
      expect(projectFk?.on_delete).toBe('CASCADE');

      const envFk = fks.find((fk) => fk.from === 'environment_id');
      expect(envFk?.table).toBe('ExecutionEnvironment');
      expect(envFk?.to).toBe('id');
      expect(envFk?.on_delete).toBe('SET NULL');
      db.close();
    });

    it('should create Message table with correct columns and foreign key', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const columns = db.prepare("PRAGMA table_info('Message')").all() as {
        name: string; type: string; notnull: number;
      }[];
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toEqual(['id', 'session_id', 'role', 'content', 'sub_agents', 'created_at']);

      const fks = db.prepare("PRAGMA foreign_key_list('Message')").all() as {
        table: string; from: string; to: string; on_delete: string;
      }[];
      const sessionFk = fks.find((fk) => fk.from === 'session_id');
      expect(sessionFk?.table).toBe('Session');
      expect(sessionFk?.to).toBe('id');
      expect(sessionFk?.on_delete).toBe('CASCADE');
      db.close();
    });

    it('should create Prompt table with correct columns and unique constraint on content', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const columns = db.prepare("PRAGMA table_info('Prompt')").all() as {
        name: string; type: string; notnull: number; dflt_value: string | null;
      }[];
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toEqual([
        'id', 'content', 'used_count', 'last_used_at', 'created_at', 'updated_at',
      ]);

      const usedCountCol = columns.find((c) => c.name === 'used_count');
      expect(usedCountCol?.notnull).toBe(1);
      expect(usedCountCol?.dflt_value).toBe('1');

      const indexes = db.prepare(
        "SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='Prompt'"
      ).all() as { name: string; sql: string | null }[];
      const uniqueIndex = indexes.find((idx) => idx.sql && idx.sql.includes('content'));
      expect(uniqueIndex).toBeDefined();
      db.close();
    });

    it('should create RunScript table with correct columns and index', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      const columns = db.prepare("PRAGMA table_info('RunScript')").all() as {
        name: string; type: string; notnull: number;
      }[];
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toEqual([
        'id', 'project_id', 'name', 'description', 'command', 'created_at', 'updated_at',
      ]);

      const fks = db.prepare("PRAGMA foreign_key_list('RunScript')").all() as {
        table: string; from: string; to: string; on_delete: string;
      }[];
      const projectFk = fks.find((fk) => fk.from === 'project_id');
      expect(projectFk?.table).toBe('Project');
      expect(projectFk?.to).toBe('id');
      expect(projectFk?.on_delete).toBe('CASCADE');

      const indexes = db.prepare(
        "SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='RunScript'"
      ).all() as { name: string; sql: string | null }[];
      const projectIdIndex = indexes.find(
        (idx) => idx.sql && idx.sql.includes('project_id')
      );
      expect(projectIdIndex).toBeDefined();
      db.close();
    });

    it('should not fail when called twice (IF NOT EXISTS)', () => {
      const dbPath = join(testDir, 'test.db');
      const result1 = initializeDatabase(dbPath);
      expect(result1).toBe(true);
      const result2 = initializeDatabase(dbPath);
      expect(result2).toBe(true);
    });

    it('should preserve existing data when called on an existing database', () => {
      const dbPath = join(testDir, 'test.db');
      initializeDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      db.prepare(
        "INSERT INTO Project (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).run('test-id', 'test-project', '/path/to/project', Date.now(), Date.now());
      db.close();

      initializeDatabase(dbPath);

      const db2 = new Database(dbPath);
      const row = db2.prepare("SELECT * FROM Project WHERE id = ?").get('test-id') as { name: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.name).toBe('test-project');
      db2.close();
    });

    it('should return false when given an invalid path', () => {
      const invalidPath = join(testDir, 'nonexistent', 'subdir', 'deep', 'test.db');
      const result = initializeDatabase(invalidPath);
      expect(result).toBe(false);
    });
  });

  describe('migrateDatabase', () => {
    it('should migrate new DB to CURRENT_DB_VERSION', () => {
      const dbPath = join(testDir, 'migrate-test.db');
      const result = migrateDatabase(dbPath);
      expect(result).toBe(true);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });

      // user_versionが2になっていることを確認
      const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
      expect(row.user_version).toBe(3);

      // 全テーブルが存在することを確認
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as { name: string }[];
      const tableNames = tables.map((t: { name: string }) => t.name);
      expect(tableNames).toContain('Project');
      expect(tableNames).toContain('Session');

      // v2で追加されたカラムが存在することを確認
      const projectColumns = db.prepare("PRAGMA table_info('Project')").all() as { name: string }[];
      const projectColumnNames = projectColumns.map((c) => c.name);
      expect(projectColumnNames).toContain('claude_code_options');
      expect(projectColumnNames).toContain('custom_env_vars');

      db.close();
    });

    it('should migrate v1 DB to v2', () => {
      const dbPath = join(testDir, 'v1-db.db');

      // v1のDBを手動で作成（user_version = 1、新カラムなし）
       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');

      // v1のテーブル構造（新カラムなし）
      db.exec(`
        CREATE TABLE "Project" (
          "id" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "path" text NOT NULL,
          "remote_url" text,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);
      db.exec(`
        CREATE TABLE "Session" (
          "id" text PRIMARY KEY NOT NULL,
          "project_id" text NOT NULL,
          "name" text NOT NULL,
          "status" text NOT NULL,
          "worktree_path" text NOT NULL,
          "branch_name" text NOT NULL,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // user_versionを1に設定
      db.exec('PRAGMA user_version = 1');
      db.close();

      // マイグレーション実行
      const result = migrateDatabase(dbPath);
      expect(result).toBe(true);

      // 確認
      const db2 = new Database(dbPath, { readonly: true });

      // user_versionが2になっていることを確認
      const row = db2.prepare('PRAGMA user_version').get() as { user_version: number };
      expect(row.user_version).toBe(3);

      // 新カラムが追加されていることを確認
      const projectColumns = db2.prepare("PRAGMA table_info('Project')").all() as { name: string }[];
      const projectColumnNames = projectColumns.map((c) => c.name);
      expect(projectColumnNames).toContain('claude_code_options');
      expect(projectColumnNames).toContain('custom_env_vars');

      const sessionColumns = db2.prepare("PRAGMA table_info('Session')").all() as { name: string }[];
      const sessionColumnNames = sessionColumns.map((c) => c.name);
      expect(sessionColumnNames).toContain('claude_code_options');
      expect(sessionColumnNames).toContain('custom_env_vars');

      db2.close();
    });

    it('should skip migration when DB is already at latest version', () => {
      const dbPath = join(testDir, 'latest-db.db');

      // 最新バージョンのDBを作成
      migrateDatabase(dbPath);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const rowBefore = db.prepare('PRAGMA user_version').get() as { user_version: number };
      expect(rowBefore.user_version).toBe(3);
      db.close();

      // 再度マイグレーション実行（スキップされるはず）
      const result = migrateDatabase(dbPath);
      expect(result).toBe(true);

      // バージョンが変わっていないことを確認
      const db2 = new Database(dbPath, { readonly: true });
      const rowAfter = db2.prepare('PRAGMA user_version').get() as { user_version: number };
      expect(rowAfter.user_version).toBe(3);
      db2.close();
    });

    it('should be idempotent (multiple executions should not cause issues)', () => {
      const dbPath = join(testDir, 'idempotent-db.db');

      // 3回実行
      const result1 = migrateDatabase(dbPath);
      const result2 = migrateDatabase(dbPath);
      const result3 = migrateDatabase(dbPath);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);

       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
      expect(row.user_version).toBe(3);
      db.close();
    });

    it('should preserve existing data during migration', () => {
      const dbPath = join(testDir, 'data-preserve-db.db');

      // v1のDBを作成してデータを挿入（v1は全テーブルが存在する状態）
       
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');

      // Project テーブル（v1 スキーマ）
      db.exec(`
        CREATE TABLE "Project" (
          "id" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "path" text NOT NULL,
          "remote_url" text,
          "created_at" integer NOT NULL,
          "updated_at" integer NOT NULL
        );
      `);

      // ExecutionEnvironment テーブル（v1 スキーマ）
      db.exec(`
        CREATE TABLE "ExecutionEnvironment" (
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

      // Session テーブル（v1 スキーマ、claude_code_options/custom_env_varsなし）
      db.exec(`
        CREATE TABLE "Session" (
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

      db.exec('PRAGMA user_version = 1');
      db.prepare(
        "INSERT INTO Project (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).run('test-id', 'test-project', '/test/path', Date.now(), Date.now());
      db.close();

      // マイグレーション実行
      const result = migrateDatabase(dbPath);
      expect(result).toBe(true);

      // データが保持されていることを確認
      const db2 = new Database(dbPath, { readonly: true });
      const row = db2.prepare("SELECT * FROM Project WHERE id = ?").get('test-id') as { name: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.name).toBe('test-project');
      db2.close();
    });

    it('should return false when migration fails', () => {
      const invalidPath = join(testDir, 'nonexistent', 'subdir', 'deep', 'test.db');
      const result = migrateDatabase(invalidPath);
      expect(result).toBe(false);
    });
  });
});
