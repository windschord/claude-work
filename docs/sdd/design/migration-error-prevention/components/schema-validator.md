# コンポーネント設計: スキーマ検証

## 概要

**関連要件**: [US-002: スキーマ整合性の早期検出](../../../requirements/migration-error-prevention/stories/US-002.md) @../../../requirements/migration-error-prevention/stories/US-002.md

`validateSchemaIntegrity()`関数は、サーバー起動時にDrizzle ORMのスキーマ定義とSQLiteデータベースの実際のテーブル構造を比較し、不一致があれば詳細なエラーメッセージを表示してプロセスを終了します。

## 責務

- Drizzleスキーマで定義されたカラムがデータベースに存在することを検証
- 不足しているカラムのリストアップ
- 修復方法の明示的な提示
- 読み取り専用操作（データベースを変更しない）

## インターフェース

### 関数シグネチャ

```typescript
/**
 * スキーマ整合性を検証する
 *
 * Drizzle ORMのスキーマ定義とデータベースの実際のテーブル構造を比較し、
 * 不足しているカラムがあれば詳細情報を返す。
 *
 * @param db - better-sqlite3データベースインスタンス
 * @returns 検証結果オブジェクト
 *
 * @example
 * ```typescript
 * import Database from 'better-sqlite3';
 * import { db } from '@/lib/db';
 *
 * const result = validateSchemaIntegrity(db);
 * if (!result.valid) {
 *   console.error('スキーマ不一致:', result.missingColumns);
 *   process.exit(1);
 * }
 * ```
 */
export function validateSchemaIntegrity(
  db: ReturnType<typeof Database>
): SchemaValidationResult;
```

### 型定義

```typescript
/**
 * カラム不足情報
 */
interface MissingColumn {
  table: string;      // テーブル名（例: "Session"）
  column: string;     // カラム名（例: "active_connections"）
  expectedType: string; // 期待される型（例: "INTEGER"）
}

/**
 * スキーマ検証結果
 */
interface SchemaValidationResult {
  valid: boolean;                  // true: 整合性OK, false: 不一致あり
  missingColumns: MissingColumn[]; // 不足しているカラムのリスト
  checkedTables: string[];         // 検証対象テーブル一覧
  timestamp: Date;                 // 検証実行日時
}
```

### 入力

- **db**: `Database` - better-sqlite3データベースインスタンス

### 出力

- **戻り値**: `SchemaValidationResult` - 検証結果オブジェクト

### エラー

| エラーケース | スローされる例外 | メッセージ例 |
|-------------|----------------|-------------|
| データベース接続エラー | `Error` | `Failed to connect to database` |
| PRAGMA実行エラー | `Error` | `Failed to execute PRAGMA table_info` |

## 内部設計

### 処理フロー

```text
validateSchemaIntegrity(db)
    ↓
1. Drizzleスキーマからテーブル一覧を取得
   - getTableName() でテーブル名取得
   - getTableColumns() でカラム定義取得
    ↓
2. 各テーブルに対してループ
   ├─→ PRAGMA table_info(テーブル名) を実行
   │   └─→ 実際のカラム一覧を取得
   ├─→ 期待されるカラムと実際のカラムを比較
   │   └─→ 不足カラムをリストアップ
   └─→ missingColumns配列に追加
    ↓
3. 検証結果を返却
   - valid: missingColumns.length === 0
   - missingColumns: 不足カラムの配列
   - checkedTables: 検証したテーブル名の配列
   - timestamp: new Date()
```

### 実装詳細

```typescript
import { getTableName, getTableColumns } from 'drizzle-orm';
import * as schema from '@/db/schema';
import Database from 'better-sqlite3';

export interface MissingColumn {
  table: string;
  column: string;
  expectedType: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  missingColumns: MissingColumn[];
  checkedTables: string[];
  timestamp: Date;
}

export function validateSchemaIntegrity(
  db: ReturnType<typeof Database>
): SchemaValidationResult {
  const missingColumns: MissingColumn[] = [];
  const checkedTables: string[] = [];

  // Drizzleスキーマからテーブル定義を取得
  const tables = [
    schema.projects,
    schema.sessions,
    schema.executionEnvironments,
    schema.messages,
    schema.prompts,
    schema.runScripts,
    schema.githubPats,
  ];

  for (const table of tables) {
    const tableName = getTableName(table);
    checkedTables.push(tableName);

    // 期待されるカラム一覧を取得
    const expectedColumns = getTableColumns(table);

    // 実際のカラム一覧を取得
    const actualColumns = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string; type: string }>;

    const actualColumnNames = new Set(actualColumns.map((col) => col.name));

    // 不足しているカラムを検出
    for (const [columnName, columnDef] of Object.entries(expectedColumns)) {
      if (!actualColumnNames.has(columnName)) {
        missingColumns.push({
          table: tableName,
          column: columnName,
          expectedType: columnDef.dataType, // 'text', 'integer', etc.
        });
      }
    }
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    checkedTables,
    timestamp: new Date(),
  };
}
```

### エラーメッセージ生成

```typescript
/**
 * スキーマ不一致時のエラーメッセージを生成
 */
export function formatValidationError(
  result: SchemaValidationResult
): string {
  if (result.valid) {
    return '';
  }

  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════════╗',
    '║  ❌ データベーススキーマが不整合です                            ║',
    '╚════════════════════════════════════════════════════════════════╝',
    '',
    '不足しているカラム:',
  ];

  // テーブル別にグループ化
  const byTable = new Map<string, MissingColumn[]>();
  for (const col of result.missingColumns) {
    if (!byTable.has(col.table)) {
      byTable.set(col.table, []);
    }
    byTable.get(col.table)!.push(col);
  }

  // テーブルごとに出力
  for (const [table, cols] of byTable) {
    lines.push(`  📋 ${table}:`);
    for (const col of cols) {
      lines.push(`     - ${col.column} (${col.expectedType})`);
    }
  }

  lines.push('');
  lines.push('修復方法:');
  lines.push('  1. 次のコマンドを実行してスキーマを同期:');
  lines.push('     $ npx drizzle-kit push');
  lines.push('');
  lines.push('  2. または、自動マイグレーションを有効にして再起動:');
  lines.push('     $ npx claude-work');
  lines.push('');

  return lines.join('\n');
}
```

## 統合ポイント

### サーバー起動シーケンスへの組み込み

**ファイル**: `server.ts`

```typescript
import { db } from '@/lib/db';
import {
  validateSchemaIntegrity,
  formatValidationError,
} from '@/lib/schema-check';

async function startServer() {
  console.log('🔍 スキーマ整合性チェック中...');

  // スキーマ検証
  const validationResult = validateSchemaIntegrity(db);

  if (!validationResult.valid) {
    // 不一致時はエラーメッセージを表示して終了
    console.error(formatValidationError(validationResult));
    process.exit(1);
  }

  console.log('✅ スキーマ整合性OK');
  console.log(`   検証テーブル数: ${validationResult.checkedTables.length}`);

  // HTTPサーバー起動
  const server = app.listen(port, () => {
    console.log(`🚀 サーバー起動: http://localhost:${port}`);
  });
}
```

### ヘルスチェックAPIでの再利用

**ファイル**: `src/app/api/health/route.ts`

```typescript
import { db } from '@/lib/db';
import { validateSchemaIntegrity } from '@/lib/schema-check';
import { NextResponse } from 'next/server';

export async function GET() {
  const result = validateSchemaIntegrity(db);

  if (result.valid) {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: result.timestamp.toISOString(),
        checks: {
          database: {
            status: 'pass',
            missingColumns: [],
          },
        },
      },
      { status: 200 }
    );
  } else {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: result.timestamp.toISOString(),
        checks: {
          database: {
            status: 'fail',
            missingColumns: result.missingColumns,
          },
        },
      },
      { status: 503 }
    );
  }
}
```

## 非機能要件

### 性能要件（NFR-003）

- **目標**: 5秒以内に完了
- **実測値**: PRAGMA table_infoは高速（1テーブルあたり10ms以下）
- **計算**: 7テーブル × 10ms = 70ms → 5秒以内は余裕で達成可能

### 保守性要件（NFR-004）

- **読み取り専用操作**: PRAGMA table_infoのみ使用、データベースを変更しない
- **冪等性**: 何度実行しても同じ結果を返す
- **並列実行可能**: 複数プロセスから同時実行可能（読み取り専用のため）

## テスト戦略

### ユニットテスト

**ファイル**: `src/lib/__tests__/schema-check.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { validateSchemaIntegrity } from '../schema-check';

describe('validateSchemaIntegrity', () => {
  let db: ReturnType<typeof Database>;

  beforeEach(() => {
    // インメモリデータベースで初期化
    db = new Database(':memory:');
    // 初期テーブルを作成（一部カラムを意図的に欠落）
    db.exec(`
      CREATE TABLE Project (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL
        -- 意図的にclone_locationカラムを欠落させる
      );
    `);
  });

  it('カラムが不足している場合はvalid=falseを返す', () => {
    const result = validateSchemaIntegrity(db);
    expect(result.valid).toBe(false);
    expect(result.missingColumns.length).toBeGreaterThan(0);
    expect(result.missingColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'Project',
          column: 'clone_location',
        }),
      ])
    );
  });

  it('すべてのカラムが存在する場合はvalid=trueを返す', () => {
    // 全カラムを追加
    db.exec(`
      ALTER TABLE Project ADD COLUMN clone_location TEXT;
      ALTER TABLE Project ADD COLUMN docker_volume_id TEXT;
      -- ... 他のカラムも追加
    `);

    const result = validateSchemaIntegrity(db);
    expect(result.valid).toBe(true);
    expect(result.missingColumns).toEqual([]);
  });

  it('検証対象テーブル一覧を返す', () => {
    const result = validateSchemaIntegrity(db);
    expect(result.checkedTables).toContain('Project');
    expect(result.checkedTables).toContain('Session');
    expect(result.checkedTables.length).toBe(7);
  });

  it('データベースを変更しない（読み取り専用）', () => {
    const beforePragma = db.prepare('PRAGMA user_version').get();
    validateSchemaIntegrity(db);
    const afterPragma = db.prepare('PRAGMA user_version').get();
    expect(beforePragma).toEqual(afterPragma);
  });
});
```

### 統合テスト

1. **正常系**: スキーマ一致時のサーバー起動
   - データベースが最新状態
   - サーバーが正常起動することを確認

2. **異常系**: スキーマ不一致時のサーバー起動
   - 意図的にカラムを削除
   - エラーメッセージが表示され、プロセスが終了することを確認

## 既知の制約

### PRAGMA table_infoの制約

- **カラム名のみチェック**: カラムの型、制約（NOT NULL等）は検証しない
  - 型の不一致は今回のスコープ外
  - カラム追加のみを検出すれば十分

- **外部キー制約**: 検証対象外
  - Drizzle ORMのrelations定義は検証しない
  - SQLiteの外部キー制約は実行時にチェックされる

### Drizzle ORMの制約

- **動的スキーマ**: 実行時にスキーマが変更される場合は未対応
  - 現実的には発生しない（schema.tsは静的ファイル）

## セキュリティ考慮事項

### SQLインジェクション対策

- テーブル名はDrizzle ORMから取得（ユーザー入力なし）
- `PRAGMA table_info()`は安全（SQLiteの組み込みコマンド）

### 情報漏洩

- エラーメッセージにはテーブル名・カラム名のみ含まれる
- データの内容は出力されない

## 監視・ログ

### ログ出力

| ログレベル | メッセージ | タイミング |
|-----------|-----------|-----------|
| INFO | `🔍 スキーマ整合性チェック中...` | 開始時 |
| INFO | `✅ スキーマ整合性OK` | 成功時 |
| INFO | `   検証テーブル数: ${count}` | 成功時 |
| ERROR | `❌ データベーススキーマが不整合です` | 失敗時 |
| ERROR | 不足カラムの詳細リスト | 失敗時 |

### メトリクス収集（将来拡張）

```typescript
// Prometheusメトリクス例
const schemaCheckDuration = new Histogram({
  name: 'schema_check_duration_seconds',
  help: 'Duration of schema integrity check',
});

const schemaCheckStatus = new Gauge({
  name: 'schema_check_status',
  help: 'Schema integrity check status (1=OK, 0=NG)',
});
```

## 参照

- [要件定義 US-002](../../../requirements/migration-error-prevention/stories/US-002.md) @../../../requirements/migration-error-prevention/stories/US-002.md
- [設計概要](../index.md) @../index.md
- [ヘルスチェックAPI](../api/health.md) @../api/health.md
- [決定事項 DEC-002: 起動時チェック実装方針](../decisions/DEC-002.md) @../decisions/DEC-002.md
