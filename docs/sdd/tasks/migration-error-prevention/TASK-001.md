# TASK-001: スキーマ検証機能の実装

## 概要

スキーマ整合性を検証する`validateSchemaIntegrity()`関数を実装し、サーバー起動時に不一致を検出する機能を追加します。

## 関連ドキュメント

- **要件**: [US-002](../../requirements/migration-error-prevention/stories/US-002.md) @../../requirements/migration-error-prevention/stories/US-002.md
- **設計**: [スキーマ検証コンポーネント](../../design/migration-error-prevention/components/schema-validator.md) @../../design/migration-error-prevention/components/schema-validator.md

## 実装対象ファイル

- **新規作成**:
  - `src/lib/schema-check.ts` - スキーマ検証ロジック
  - `src/lib/__tests__/schema-check.test.ts` - ユニットテスト

- **変更**:
  - `server.ts` - 起動シーケンスに検証処理を組み込み

## TDD手順

### 1. テストファースト

`src/lib/__tests__/schema-check.test.ts`を作成:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { validateSchemaIntegrity } from '../schema-check';

describe('validateSchemaIntegrity', () => {
  let db: ReturnType<typeof Database>;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE Project (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL)`);
  });

  it('カラムが不足している場合はvalid=falseを返す', () => {
    const result = validateSchemaIntegrity(db);
    expect(result.valid).toBe(false);
    expect(result.missingColumns.length).toBeGreaterThan(0);
  });

  it('検証対象テーブル一覧を返す', () => {
    const result = validateSchemaIntegrity(db);
    expect(result.checkedTables.length).toBe(7);
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- src/lib/__tests__/schema-check.test.ts
# 期待: FAIL（関数未実装）
```

### 3. 実装

`src/lib/schema-check.ts`を作成:

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

    const expectedColumns = getTableColumns(table);
    const actualColumns = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;

    const actualColumnNames = new Set(actualColumns.map((col) => col.name));

    for (const [columnName, columnDef] of Object.entries(expectedColumns)) {
      if (!actualColumnNames.has(columnName)) {
        missingColumns.push({
          table: tableName,
          column: columnName,
          expectedType: columnDef.dataType,
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

export function formatValidationError(result: SchemaValidationResult): string {
  if (result.valid) return '';

  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════════╗',
    '║  ❌ データベーススキーマが不整合です                            ║',
    '╚════════════════════════════════════════════════════════════════╝',
    '',
    '不足しているカラム:',
  ];

  const byTable = new Map<string, MissingColumn[]>();
  for (const col of result.missingColumns) {
    if (!byTable.has(col.table)) byTable.set(col.table, []);
    byTable.get(col.table)!.push(col);
  }

  for (const [table, cols] of byTable) {
    lines.push(`  📋 ${table}:`);
    for (const col of cols) {
      lines.push(`     - ${col.column} (${col.expectedType})`);
    }
  }

  lines.push('', '修復方法:', '  $ npx drizzle-kit push', '');
  return lines.join('\n');
}
```

### 4. テスト実行（成功確認）

```bash
npm test -- src/lib/__tests__/schema-check.test.ts
# 期待: PASS
```

### 5. server.tsへの組み込み

```typescript
// server.ts
import { validateSchemaIntegrity, formatValidationError } from '@/lib/schema-check';

async function startServer() {
  console.log('🔍 スキーマ整合性チェック中...');
  const validationResult = validateSchemaIntegrity(db);

  if (!validationResult.valid) {
    console.error(formatValidationError(validationResult));
    process.exit(1);
  }

  console.log('✅ スキーマ整合性OK');
  // HTTPサーバー起動...
}
```

## 受入基準

- [ ] `validateSchemaIntegrity()`がすべてのテーブルをチェックする
- [ ] カラム不足時に詳細なエラーメッセージを表示する
- [ ] サーバー起動時に検証が実行される
- [ ] スキーマ不一致時はHTTPサーバー起動前に終了する
- [ ] ユニットテストがすべてパスする

## ステータス

**DONE**
