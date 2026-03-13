# 設計書: NetworkFilterテーブルDBマイグレーション (Issue #190)

## 修正対象ファイル

- `src/bin/cli-utils.ts`: マイグレーションロジック
- `src/bin/__tests__/cli-utils.test.ts`: テスト

## 設計方針

### DBバージョン更新

```text
CURRENT_DB_VERSION: 6 → 7
```

### 追加するマイグレーション関数

```typescript
function migrateV6ToV7(db: InstanceType<typeof Database>): void
```

### テーブル定義

```sql
CREATE TABLE IF NOT EXISTS "NetworkFilterConfig" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "environment_id" TEXT NOT NULL UNIQUE REFERENCES "ExecutionEnvironment"("id") ON DELETE CASCADE,
  "enabled" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "NetworkFilterRule" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "environment_id" TEXT NOT NULL REFERENCES "ExecutionEnvironment"("id") ON DELETE CASCADE,
  "target" TEXT NOT NULL,
  "port" INTEGER,
  "description" TEXT,
  "enabled" INTEGER NOT NULL DEFAULT 1,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
```

### 変更箇所

1. `CURRENT_DB_VERSION` を 7 に更新
2. `migrateV6ToV7()` 関数を追加
3. `migrateDatabase()` にv6→v7ブロックを追加
4. `createInitialTables()` にNetworkFilterConfig/NetworkFilterRuleテーブルを追加
5. バージョン履歴コメントを更新

### migrateDatabase()への追加

```typescript
// バージョン 6 → 7: NetworkFilterConfig・NetworkFilterRuleテーブル作成
if (version < 7) {
  migrateV6ToV7(db!);
  version = 7;
}
```

## テスト設計

既存のテストパターンに合わせて以下を追加:

1. 新規DBに両テーブルが作成されることを確認（initializeDatabaseテスト）
2. v6→v7マイグレーションが正常動作することを確認
3. DBバージョンが7になることを確認
4. 新規DBのCURRENT_DB_VERSIONが7であることを確認
5. 既存の「should skip migration when DB is already at latest version」テストをv7対応に更新
