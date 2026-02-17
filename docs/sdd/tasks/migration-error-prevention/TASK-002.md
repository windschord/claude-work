# TASK-002: スキーマ同期機能の実装

## 概要

`drizzle-kit push`を実行する`syncSchema()`関数を実装し、CLI起動時の手動マイグレーション機構を完全に置換します。

## 関連ドキュメント

- **要件**: [US-001](../../requirements/migration-error-prevention/stories/US-001.md) @../../requirements/migration-error-prevention/stories/US-001.md
- **設計**: [スキーマ同期コンポーネント](../../design/migration-error-prevention/components/schema-sync.md) @../../design/migration-error-prevention/components/schema-sync.md

## 実装対象ファイル

- **変更**:
  - `src/bin/cli-utils.ts` - `syncSchema()`追加、手動マイグレーション削除
  - `src/bin/cli.ts` - `setupDatabase()`から`syncSchema()`呼び出し
  - `src/bin/__tests__/cli-utils.test.ts` - テスト追加

## TDD手順

### 1. テストファースト

`src/bin/__tests__/cli-utils.test.ts`に追加:

```typescript
import { vi } from 'vitest';
import { spawnSync } from 'child_process';

vi.mock('child_process');

describe('syncSchema', () => {
  it('drizzle-kit pushを実行する', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

    syncSchema('file:test.db');

    expect(spawnSync).toHaveBeenCalledWith(
      'npx',
      ['drizzle-kit', 'push'],
      expect.objectContaining({ stdio: 'inherit' })
    );
  });

  it('失敗時はエラーをthrowする', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);

    expect(() => syncSchema('file:test.db')).toThrow('drizzle-kit push failed');
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- src/bin/__tests__/cli-utils.test.ts
# 期待: FAIL
```

### 3. 実装

`src/bin/cli-utils.ts`に追加:

```typescript
import { spawnSync } from 'child_process';

export function syncSchema(databaseUrl: string): void {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log('🔄 スキーマ同期中...');

  const result = spawnSync('npx', ['drizzle-kit', 'push'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  if (result.error) {
    throw new Error(`Failed to execute drizzle-kit: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`drizzle-kit push failed with exit code ${result.status}`);
  }

  console.log('✅ スキーマ同期完了');
}
```

### 4. 手動マイグレーション機構の削除

以下を削除:
- `const CURRENT_DB_VERSION = 3;`
- `migrateDatabase()`関数
- `createInitialTables()`関数
- その他すべてのマイグレーション関数

### 5. CLI統合

`src/bin/cli.ts`の`setupDatabase()`を修正:

```typescript
import { syncSchema } from './cli-utils';

export async function setupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('📦 データベース初期化中...');

  ensureDatabaseFile(databaseUrl);
  syncSchema(databaseUrl);  // ← 追加
  // migrateDatabase()を削除

  console.log('✅ データベース準備完了');
}
```

### 6. テスト実行（成功確認）

```bash
npm test -- src/bin/__tests__/cli-utils.test.ts
# 期待: PASS
```

## 受入基準

- [ ] `syncSchema()`が`drizzle-kit push`を実行する
- [ ] CLI起動時に自動的にスキーマ同期が実行される
- [ ] 手動マイグレーション関数がすべて削除されている
- [ ] `CURRENT_DB_VERSION`が削除されている
- [ ] ユニットテストがすべてパスする

## ステータス

**TODO**
