import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import * as schema from '@/db/schema';
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

      CREATE TABLE DeveloperSettings (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE SshKey (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE NetworkFilterConfig (
        id TEXT PRIMARY KEY,
        environment_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE NetworkFilterRule (
        id TEXT PRIMARY KEY,
        environment_id TEXT NOT NULL,
        target TEXT NOT NULL,
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
    expect(result.checkedTables.length).toBe(11);
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

  it('全カラムが揃っている場合はvalid=trueを返す', () => {
    // 完全なスキーマに合わせたDBを作成
    const fullDb = new Database(':memory:');
    const tables = [
      schema.projects,
      schema.sessions,
      schema.executionEnvironments,
      schema.messages,
      schema.prompts,
      schema.runScripts,
      schema.githubPats,
      schema.developerSettings,
      schema.sshKeys,
      schema.networkFilterConfigs,
      schema.networkFilterRules,
    ];

    for (const table of tables) {
      const tableName = getTableName(table);
      const columns = getTableColumns(table);
      const colDefs = Object.values(columns).map((col: { name: string; dataType: string }) => {
        let sqlType = 'TEXT';
        if (col.dataType === 'number') sqlType = 'INTEGER';
        return `${col.name} ${sqlType}`;
      });
      fullDb.exec(`CREATE TABLE ${tableName} (${colDefs.join(', ')})`);
    }

    const result = validateSchemaIntegrity(fullDb);
    expect(result.valid).toBe(true);
    expect(result.missingColumns).toHaveLength(0);
    fullDb.close();
  });

  it('actualColumnNamesに含まれないカラムだけがmissingColumnsに入る', () => {
    const result = validateSchemaIntegrity(db);
    // Projectテーブルにはid, name, pathがある
    const projectMissing = result.missingColumns.filter(c => c.table === 'Project');
    // id, name, pathは含まれていないはず
    expect(projectMissing.some(c => c.column === 'id')).toBe(false);
    expect(projectMissing.some(c => c.column === 'name')).toBe(false);
    expect(projectMissing.some(c => c.column === 'path')).toBe(false);
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
    expect(message).toContain('npm run db:push');
  });

  it('エラーメッセージが改行で結合されている', () => {
    const result = {
      valid: false,
      missingColumns: [
        { table: 'Project', column: 'test_col', expectedType: 'text' },
      ],
      checkedTables: ['Project'],
      timestamp: new Date(),
    };

    const message = formatValidationError(result);
    expect(message).toContain('\n');
    // 改行で分割して行数が複数あることを確認
    const lines = message.split('\n');
    expect(lines.length).toBeGreaterThan(5);
  });

  it('罫線と修復方法を含む', () => {
    const result = {
      valid: false,
      missingColumns: [
        { table: 'Project', column: 'test_col', expectedType: 'text' },
      ],
      checkedTables: ['Project'],
      timestamp: new Date(),
    };

    const message = formatValidationError(result);
    // 罫線
    expect(message).toContain('╔');
    expect(message).toContain('╚');
    // 修復方法
    expect(message).toContain('修復方法');
    expect(message).toContain('npm run db:generate');
    expect(message).toContain('npm run db:push');
    expect(message).toContain('不足しているカラム');
    expect(message).toContain('マイグレーションファイルを生成');
  });

  it('複数テーブルのエラーをグループ化する', () => {
    const result = {
      valid: false,
      missingColumns: [
        { table: 'Project', column: 'col_a', expectedType: 'text' },
        { table: 'Session', column: 'col_b', expectedType: 'integer' },
        { table: 'Project', column: 'col_c', expectedType: 'text' },
      ],
      checkedTables: ['Project', 'Session'],
      timestamp: new Date(),
    };

    const message = formatValidationError(result);
    expect(message).toContain('Project');
    expect(message).toContain('Session');
    expect(message).toContain('col_a');
    expect(message).toContain('col_b');
    expect(message).toContain('col_c');
    // expectedTypeも含まれるか
    expect(message).toContain('(text)');
    expect(message).toContain('(integer)');
  });
});
