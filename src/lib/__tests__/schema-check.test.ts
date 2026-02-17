import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { validateSchemaIntegrity, formatValidationError } from '../schema-check';

describe('validateSchemaIntegrity', () => {
  let db: ReturnType<typeof Database>;

  beforeEach(() => {
    // インメモリデータベースで初期化
    db = new Database(':memory:');

    // 最小限のテーブル構造を作成（意図的に一部カラムを欠落）
    db.exec(`
      CREATE TABLE Project (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL
      );

      CREATE TABLE ExecutionEnvironment (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE Session (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        session_name TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE Message (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE Prompt (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE RunScript (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        script TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE GitHubPAT (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('カラムが不足している場合はvalid=falseを返す', () => {
    const result = validateSchemaIntegrity(db);

    expect(result.valid).toBe(false);
    expect(result.missingColumns.length).toBeGreaterThan(0);
  });

  it('不足カラムの詳細情報を返す', () => {
    const result = validateSchemaIntegrity(db);

    const projectMissing = result.missingColumns.filter(
      (col) => col.table === 'Project'
    );

    expect(projectMissing.length).toBeGreaterThan(0);
    expect(projectMissing.some((col) => col.column === 'clone_location')).toBe(
      true
    );
  });

  it('検証対象テーブル一覧を返す', () => {
    const result = validateSchemaIntegrity(db);

    expect(result.checkedTables).toContain('Project');
    expect(result.checkedTables).toContain('Session');
    expect(result.checkedTables).toContain('ExecutionEnvironment');
    expect(result.checkedTables.length).toBe(7);
  });

  it('timestampを含む', () => {
    const result = validateSchemaIntegrity(db);

    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('データベースを変更しない（読み取り専用）', () => {
    const beforeVersion = db.prepare('PRAGMA user_version').get() as {
      user_version: number;
    };

    validateSchemaIntegrity(db);

    const afterVersion = db.prepare('PRAGMA user_version').get() as {
      user_version: number;
    };

    expect(beforeVersion.user_version).toEqual(afterVersion.user_version);
  });
});

describe('formatValidationError', () => {
  it('valid=trueの場合は空文字列を返す', () => {
    const result = {
      valid: true,
      missingColumns: [],
      checkedTables: ['Project'],
      timestamp: new Date(),
    };

    expect(formatValidationError(result)).toBe('');
  });

  it('エラーメッセージに不足カラムを含む', () => {
    const result = {
      valid: false,
      missingColumns: [
        { table: 'Session', column: 'active_connections', expectedType: 'integer' },
        { table: 'Session', column: 'destroy_at', expectedType: 'integer' },
      ],
      checkedTables: ['Session'],
      timestamp: new Date(),
    };

    const message = formatValidationError(result);

    expect(message).toContain('データベーススキーマが不整合です');
    expect(message).toContain('Session');
    expect(message).toContain('active_connections');
    expect(message).toContain('destroy_at');
    expect(message).toContain('npx drizzle-kit push');
  });
});
