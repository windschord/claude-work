# タスク管理書: SQLite DBマイグレーション機能

## 1. タスク概要

| 項目 | 内容 |
|------|------|
| 機能名 | SQLite DBマイグレーション機能 |
| 対象ファイル | `src/bin/cli-utils.ts` |
| 関連要件 | REQ-001 〜 REQ-006, NFR-001 〜 NFR-004 |
| 見積もり | 3タスク |

## 2. タスク一覧

| ID | タスク | ステータス | 依存 |
|----|--------|------------|------|
| 1 | migrateDatabase関数の実装 | completed | - |
| 2 | 既存initializeDatabaseの統合 | completed | 1 |
| 3 | ユニットテストの作成 | completed | 2 |

## 3. タスク詳細

### タスク1: migrateDatabase関数の実装

**目的**: PRAGMA user_versionを使ったマイグレーション関数を新規作成

**対象ファイル**: `src/bin/cli-utils.ts`

**実装内容**:

1. 定数の追加
```typescript
/** 現在のスキーマバージョン */
const CURRENT_DB_VERSION = 2;
```

2. migrateDatabase関数の追加
```typescript
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

    // WALモードを有効化
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

      // バージョン番号を更新
      db!.prepare(`PRAGMA user_version = ${version}`).run();
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
```

3. ヘルパー関数の追加

```typescript
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
```

**受入基準**:
- [ ] PRAGMA user_version でバージョンを取得できる
- [ ] バージョン比較ロジックが正しく動作する
- [ ] トランザクション内でマイグレーションが実行される
- [ ] エラー時にロールバックされる
- [ ] マイグレーション後にバージョンが更新される

---

### タスク2: 既存initializeDatabaseの統合

**目的**: 既存のinitializeDatabase関数をmigrateDatabaseに置き換え

**対象ファイル**: `src/bin/cli-utils.ts`

**実装内容**:

1. 既存のinitializeDatabase関数を修正

```typescript
// 変更前
export function initializeDatabase(dbPath: string): boolean {
  // CREATE TABLE IF NOT EXISTS を直接実行
  // ...
}

// 変更後
export function initializeDatabase(dbPath: string): boolean {
  return migrateDatabase(dbPath);
}
```

2. 既存のテーブル作成コードはcreateInitialTables関数に移動済み（タスク1で実装）

**受入基準**:
- [ ] initializeDatabaseがmigrateDatabase を呼び出す
- [ ] 既存のコードとの互換性が維持される
- [ ] checkDatabase関数は変更なし

---

### タスク3: ユニットテストの作成

**目的**: マイグレーション機能のユニットテストを追加

**対象ファイル**: `src/bin/__tests__/cli-utils.test.ts`

**テストケース**:

```typescript
describe('migrateDatabase', () => {
  it('新規DBをCURRENT_DB_VERSIONまでマイグレーションする', () => {
    // 新規DBを作成
    // migrateDatabase を実行
    // user_version が CURRENT_DB_VERSION になっていることを確認
    // 全テーブルと全カラムが存在することを確認
  });

  it('バージョン1のDBをバージョン2にマイグレーションする', () => {
    // バージョン1のDBを作成（初期テーブルのみ）
    // migrateDatabase を実行
    // user_version が 2 になっていることを確認
    // 新しいカラムが追加されていることを確認
  });

  it('最新バージョンのDBはマイグレーションをスキップする', () => {
    // バージョン2のDBを作成
    // migrateDatabase を実行
    // 処理がスキップされることを確認
  });

  it('複数回実行しても問題が発生しない（冪等性）', () => {
    // 新規DBを作成
    // migrateDatabase を3回実行
    // 全て成功することを確認
  });

  it('マイグレーション失敗時にfalseを返す', () => {
    // 読み取り専用DBでmigrateDatabase を実行
    // falseが返されることを確認
  });
});
```

**受入基準**:
- [ ] 全テストケースが実装されている
- [ ] 全テストがパスする
- [ ] カバレッジが80%以上

## 4. 実装順序

```
タスク1: migrateDatabase関数の実装
    ↓
タスク2: 既存initializeDatabaseの統合
    ↓
タスク3: ユニットテストの作成
    ↓
コミット & プッシュ
```

## 5. 完了条件

- [x] 全タスクが完了
- [x] 全テストがパス
- [ ] npx経由でマイグレーションが正常動作
- [ ] 既存DBのマイグレーションが成功
- [x] PRがマージ可能な状態 (PR #97)
