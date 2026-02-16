# 設計書: SQLite DBマイグレーション機能

## 1. アーキテクチャ概要

### 1.1 現状のアーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐
│    cli.ts       │────▶│  cli-utils.ts   │
│  (エントリ)     │     │                 │
└─────────────────┘     │ initializeDatabase()
                        │   └─ CREATE TABLE IF NOT EXISTS
                        │   └─ テーブル作成のみ
                        └─────────────────┘
```

問題: 既存テーブルへのカラム追加が行われない

### 1.2 修正後のアーキテクチャ

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│    cli.ts       │────▶│           cli-utils.ts              │
│  (エントリ)     │     │                                     │
└─────────────────┘     │ initializeDatabase()                │
                        │   └─ migrateDatabase() を呼び出し   │
                        │                                     │
                        │ migrateDatabase()                   │
                        │   ├─ PRAGMA user_version 取得       │
                        │   ├─ バージョン比較                 │
                        │   ├─ トランザクション開始           │
                        │   ├─ 段階的マイグレーション実行     │
                        │   │   ├─ v0 → v1: 初期テーブル作成  │
                        │   │   ├─ v1 → v2: カラム追加        │
                        │   │   └─ ...                        │
                        │   ├─ PRAGMA user_version 更新       │
                        │   └─ トランザクションコミット       │
                        └─────────────────────────────────────┘
```

## 2. コンポーネント設計

### 2.1 修正対象ファイル

| ファイル | 役割 | 修正内容 |
|---------|------|----------|
| `src/bin/cli-utils.ts` | DB初期化ユーティリティ | マイグレーション機能追加 |

### 2.2 定数定義

```typescript
/** 現在のスキーマバージョン */
const CURRENT_DB_VERSION = 2;
```

バージョン履歴:
- v0: 初期状態（user_versionのデフォルト値）
- v1: 初期テーブル作成
- v2: claude_code_options, custom_env_vars カラム追加

### 2.3 主要関数

#### migrateDatabase()

```typescript
/**
 * DBマイグレーションを実行
 *
 * @param dbPath - SQLiteデータベースファイルのパス
 * @returns 成功した場合はtrue、失敗した場合はfalse
 */
export function migrateDatabase(dbPath: string): boolean
```

処理フロー:
1. DBを開く
2. `PRAGMA user_version` で現在のバージョンを取得
3. 現在バージョン >= CURRENT_DB_VERSION なら終了（マイグレーション不要）
4. トランザクション開始
5. 各バージョンのマイグレーションを順次実行
6. `PRAGMA user_version = {新バージョン}` を実行
7. トランザクションコミット
8. DBを閉じる

#### initializeDatabase() の変更

```typescript
// 変更前
export function initializeDatabase(dbPath: string): boolean {
  // CREATE TABLE IF NOT EXISTS を実行
}

// 変更後
export function initializeDatabase(dbPath: string): boolean {
  return migrateDatabase(dbPath);
}
```

## 3. データフロー

### 3.1 起動時のマイグレーションフロー

```
1. npx claude-work 実行
2. cli.ts が実行される
3. setupDatabase() が呼ばれる
   └─ initializeDatabase() を呼び出し
      └─ migrateDatabase() を呼び出し
4. migrateDatabase() の処理:
   a. PRAGMA user_version を取得
      └─ 例: version = 0 (初期状態)
   b. CURRENT_DB_VERSION = 2 と比較
      └─ 0 < 2 なのでマイグレーション必要
   c. トランザクション内で実行:
      └─ version < 1: 初期テーブル作成 → version = 1
      └─ version < 2: カラム追加 → version = 2
   d. PRAGMA user_version = 2 を実行
5. アプリ起動完了
```

### 3.2 マイグレーション不要時のフロー

```
1. npx claude-work 実行
2. cli.ts が実行される
3. migrateDatabase() の処理:
   a. PRAGMA user_version を取得
      └─ version = 2 (最新)
   b. CURRENT_DB_VERSION = 2 と比較
      └─ 2 >= 2 なのでマイグレーション不要
   c. 即座にreturn（処理なし）
4. アプリ起動完了
```

## 4. マイグレーション定義

### 4.1 バージョン0 → 1: 初期テーブル作成

```typescript
if (version < 1) {
  console.log('Migrating to v1: Creating initial tables...');

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

  // ... 他のテーブル

  version = 1;
}
```

### 4.2 バージョン1 → 2: カラム追加

```typescript
if (version < 2) {
  console.log('Migrating to v2: Adding claude_code_options columns...');

  // Project テーブルにカラム追加
  try {
    db.exec(`ALTER TABLE "Project" ADD COLUMN "claude_code_options" TEXT NOT NULL DEFAULT "{}"`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  try {
    db.exec(`ALTER TABLE "Project" ADD COLUMN "custom_env_vars" TEXT NOT NULL DEFAULT "{}"`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  // Session テーブルにカラム追加
  try {
    db.exec(`ALTER TABLE "Session" ADD COLUMN "claude_code_options" TEXT`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  try {
    db.exec(`ALTER TABLE "Session" ADD COLUMN "custom_env_vars" TEXT`);
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  version = 2;
}
```

## 5. エラーハンドリング

### 5.1 マイグレーション失敗時

```typescript
try {
  const runMigration = db.transaction(() => {
    // マイグレーション処理
  });
  runMigration();
} catch (error) {
  console.error('Migration failed:', error);
  db.close();
  return false;
}
```

- トランザクションにより自動ロールバック
- エラーログ出力
- falseを返して起動を中止

### 5.2 カラム追加時の重複エラー

```typescript
try {
  db.exec(`ALTER TABLE "Project" ADD COLUMN "claude_code_options" TEXT ...`);
} catch (e) {
  // "duplicate column name" エラーは無視
  if (!String(e).includes('duplicate column')) {
    throw e;
  }
}
```

## 6. テスト方針

### 6.1 ユニットテスト

| テストケース | 確認内容 |
|--------------|----------|
| 新規DB作成 | バージョン0からCURRENT_DB_VERSIONまでマイグレーションされる |
| バージョン1からの更新 | バージョン1→2のマイグレーションが実行される |
| 最新バージョン | マイグレーションがスキップされる |
| 冪等性 | 複数回実行しても問題なし |
| エラー時ロールバック | 途中でエラーが発生してもDBが破損しない |

### 6.2 統合テスト

| テストケース | 確認内容 |
|--------------|----------|
| 既存DBのマイグレーション | 本番相当のDBでマイグレーションが成功する |
| npx経由での実行 | npx環境で正常に動作する |

## 7. 技術的決定事項

### 7.1 PRAGMA user_version の選択理由

| 方式 | メリット | デメリット |
|------|----------|------------|
| 別テーブルでバージョン管理 | 複数のメタデータを保存可能 | テーブル自体のマイグレーションが必要 |
| **PRAGMA user_version** | SQLite組み込み機能、追加テーブル不要、確実に動作 | 単一の整数値のみ |

→ シンプルさと確実性から `PRAGMA user_version` を採用

### 7.2 コード内マイグレーションの選択理由

| 方式 | npx適合性 | 実装の手間 | 安全性 |
|------|-----------|------------|--------|
| 外部.sqlファイル | 低（パス問題） | 低 | 高 |
| drizzle-kit | 低（複雑） | 低 | 高 |
| **コード内** | 高 | 中 | 高 |

→ npx環境での確実な動作を優先し、コード内マイグレーションを採用

### 7.3 トランザクション使用の理由

- 部分的なマイグレーション適用を防止
- エラー時に自動ロールバック
- データ整合性を保証

## 8. 将来の拡張

### 8.1 新しいマイグレーションの追加方法

1. `CURRENT_DB_VERSION` をインクリメント
2. `if (version < N)` ブロックを追加
3. マイグレーションロジックを実装

```typescript
// 例: バージョン3を追加
const CURRENT_DB_VERSION = 3;

// ...

if (version < 3) {
  console.log('Migrating to v3: ...');
  // 新しいマイグレーション処理
  version = 3;
}
```

### 8.2 複雑なマイグレーションへの対応

- カラム削除: 新テーブル作成 → データコピー → 旧テーブル削除 → リネーム
- データ変換: UPDATE文で既存データを変換
- インデックス追加: CREATE INDEX IF NOT EXISTS
