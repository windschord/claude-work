# TASK-001: DBスキーマ追加（NetworkFilterConfig, NetworkFilterRule）

## 説明

ネットワークフィルタリング機能のデータ永続化に必要な2つのテーブルをDrizzle ORMスキーマに追加する。

- **対象ファイル**: `src/db/schema.ts`
- **設計参照**: `docs/sdd/design/network-filtering/database/schema.md`

## 技術的文脈

- **ORM**: Drizzle ORM
- **DB**: SQLite
- **既存パターン参照**: `executionEnvironments` テーブル定義（同ファイル内）
- テーブル名はPascalCase（既存慣習）
- 外部キーは `executionEnvironments.id` に参照、`onDelete: 'cascade'`

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | テーブル構造、カラム名、型、制約（設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/db/__tests__/network-filter-schema.test.ts`

```typescript
// テストケース:
// - NetworkFilterConfig テーブルにレコードを挿入・取得できること
// - NetworkFilterRule テーブルにレコードを挿入・取得できること
// - environment_id の外部キー制約が機能すること（CASCADE削除）
// - NetworkFilterConfig の environment_id が UNIQUE であること
// - NetworkFilterRule の port が null 許容であること
// - デフォルト値（enabled, created_at, updated_at）が正しく設定されること
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装: `src/db/schema.ts` に以下を追加

```typescript
export const networkFilterConfigs = sqliteTable('NetworkFilterConfig', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  environment_id: text('environment_id')
    .notNull()
    .unique()
    .references(() => executionEnvironments.id, { onDelete: 'cascade' }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
});

export const networkFilterRules = sqliteTable('NetworkFilterRule', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  environment_id: text('environment_id')
    .notNull()
    .references(() => executionEnvironments.id, { onDelete: 'cascade' }),
  target: text('target').notNull(),
  port: integer('port'),
  description: text('description'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
});
```

### 5. `npm run db:push` でスキーマ適用
### 6. テスト実行: 全テスト通過を確認
### 7. 実装コミット

## 受入基準

- [ ] `src/db/schema.ts` に `networkFilterConfigs` テーブル定義が追加されている
- [ ] `src/db/schema.ts` に `networkFilterRules` テーブル定義が追加されている
- [ ] 外部キー制約（CASCADE）が正しく設定されている
- [ ] `npm run db:push` でエラーなくスキーマが適用される
- [ ] テストが全て通過する
- [ ] 既存テストが影響を受けていない

## 依存関係
なし

## 推定工数
30分

## ステータス
`DONE`
