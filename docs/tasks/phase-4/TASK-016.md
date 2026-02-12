# TASK-016: データベーススキーマの拡張

## 基本情報

- **タスクID**: TASK-016
- **フェーズ**: Phase 4 - 状態管理の統一
- **優先度**: 最高
- **推定工数**: 30分
- **ステータス**: IN_PROGRESS
- **担当者**: 未割り当て

## 概要

Sessionテーブルに新しいフィールドを追加し、セッション状態の永続化を実現します。Drizzle ORMの`src/db/schema.ts`に`active_connections`、`destroy_at`、`last_active_at`、`session_state`フィールドを追加し、インデックスを設定します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-004-001 | セッション状態の記録 |
| REQ-004-002 | 接続数の永続化 |
| REQ-004-003 | タイマー情報の永続化 |
| REQ-003-005 | 親コンテナIDの永続化（既存フィールド） |

## 技術的文脈

- **ファイルパス**: `src/db/schema.ts`
- **フレームワーク**: Drizzle ORM, SQLite
- **参照すべき既存コード**:
  - 現在のsessionsテーブル定義
  - 既存のcontainer_idフィールド
- **設計書**: [docs/design/database/schema.md](../../design/database/schema.md) @../../design/database/schema.md

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - sessionsテーブルに4つの新規フィールドを追加<br>- session_stateフィールド（PENDING, ACTIVE, IDLE, ERROR, TERMINATED）<br>- 3つのインデックスを追加（session_state, destroy_at, last_active_at）<br>- 既存フィールドは変更しない（statusはstatus_legacyにリネーム） |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

```bash
# テストファイルを作成
touch src/services/__tests__/session-state-schema.test.ts
```

以下のテストケースを作成：

1. **スキーマ変更の検証**
   - Sessionモデルに新規フィールドが含まれている
   - SessionStatus Enumが定義されている
   - デフォルト値が正しく設定されている

2. **セッション作成のテスト**
   - 新しいSessionを作成できる
   - デフォルト値が正しく適用される
   - statusがACTIVEで初期化される
   - active_connectionsが0で初期化される

3. **状態更新のテスト**
   - statusを更新できる
   - active_connectionsをインクリメント/デクリメントできる
   - destroy_atを設定できる
   - last_active_atを更新できる

4. **インデックスのテスト**
   - statusでセッションを検索できる
   - destroy_atでセッションを検索できる
   - last_active_atでセッションをソートできる

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/__tests__/session-state-schema.test.ts
```

すべてのテストが失敗することを確認します（新規フィールドが未定義のため）。

### ステップ3: テストコミット

```bash
git add src/services/__tests__/session-state-schema.test.ts
git commit -m "test(TASK-016): add session state schema tests

- Add schema validation tests
- Add session creation with default values tests
- Add state update tests
- Add index query tests"
```

### ステップ4: スキーマファイルの更新

`src/db/schema.ts`のsessionsテーブル定義を更新：

```typescript
export const sessions = sqliteTable('Session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status_legacy: text('status').notNull(), // 既存のstatusフィールドをリネーム
  worktree_path: text('worktree_path').notNull(),
  branch_name: text('branch_name').notNull(),
  resume_session_id: text('resume_session_id'),
  last_activity_at: integer('last_activity_at', { mode: 'timestamp' }),
  pr_url: text('pr_url'),
  pr_number: integer('pr_number'),
  pr_status: text('pr_status'),
  pr_updated_at: integer('pr_updated_at', { mode: 'timestamp' }),
  docker_mode: integer('docker_mode', { mode: 'boolean' }).notNull().default(false),
  container_id: text('container_id'),
  environment_id: text('environment_id').references(() => executionEnvironments.id, { onDelete: 'set null' }),
  claude_code_options: text('claude_code_options'),
  custom_env_vars: text('custom_env_vars'),

  // Phase 4で追加: 状態管理フィールド
  active_connections: integer('active_connections').notNull().default(0),
  destroy_at: integer('destroy_at', { mode: 'timestamp' }),
  session_state: text('session_state').notNull().default('ACTIVE'), // ACTIVE, IDLE, ERROR, TERMINATED

  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('sessions_session_state_idx').on(table.session_state),
  index('sessions_destroy_at_idx').on(table.destroy_at),
  index('sessions_last_active_at_idx').on(table.last_activity_at),
]);
```

### ステップ5: データベースにスキーマを適用

```bash
npm run db:push
```

### ステップ6: テスト実行（通過確認）

```bash
npm test -- src/services/__tests__/session-state-schema.test.ts
```

すべてのテストが通過することを確認します。

### ステップ7: 実装コミット

```bash
git add src/db/schema.ts
git commit -m "feat(TASK-016): extend Session schema for state persistence

- Add active_connections field (integer, default: 0)
- Add destroy_at field (timestamp, nullable)
- Add session_state field (text, default: ACTIVE)
- Add indexes on session_state, destroy_at, last_activity_at
- Rename existing status field to status_legacy

Implements: REQ-004-001, REQ-004-002, REQ-004-003

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/db/schema.ts`に新しいフィールドが3つ追加されている
- [ ] session_stateフィールドが定義されている（ACTIVE, IDLE, ERROR, TERMINATED）
- [ ] 3つのインデックスが追加されている
- [ ] `npm run db:push`が成功する
- [ ] `npm test`で全テストが通過する
- [ ] ESLintエラーがゼロ
- [ ] 既存のSessionテーブルの動作が破壊されていない

## 検証方法

### 単体テスト実行

```bash
npm test -- src/services/__tests__/session-state-schema.test.ts --coverage
```

カバレッジが85%以上であることを確認。

### スキーマ適用確認

```bash
npm run db:push
```

エラーがないことを確認。

### 既存テストの実行

```bash
npm test
```

既存のテストが通過することを確認（後方互換性）。

## 依存関係

### 前提条件
- Phase 2完了（TASK-011: PTYSessionManagerの統合テスト）

### 後続タスク
- TASK-017: セッション状態の永続化ロジック実装

## トラブルシューティング

### よくある問題

1. **既存フィールドとの衝突**
   - 問題: statusフィールドが既に存在する
   - 解決: 既存のstatusをstatus_legacyにリネーム

2. **マイグレーションエラー**
   - 問題: `npm run db:push`が失敗する
   - 解決: エラーメッセージを確認し、スキーマの構文を修正

3. **インデックス名の重複**
   - 問題: インデックス名が既存と衝突
   - 解決: `sessions_`プレフィックスを使用してユニークにする

## パフォーマンス最適化

### インデックスの最適化

```typescript
index('sessions_session_state_idx').on(table.session_state), // 状態別検索（頻繁）
index('sessions_destroy_at_idx').on(table.destroy_at),       // タイマー処理（定期的）
index('sessions_last_active_at_idx').on(table.last_activity_at), // アイドルセッション検出（定期的）
```

## 参照

- [要件定義: US-004](../../requirements/stories/US-004.md) @../../requirements/stories/US-004.md
- [設計: データベーススキーマ](../../design/database/schema.md) @../../design/database/schema.md
- [設計決定: DEC-004](../../design/decisions/DEC-004.md) @../../design/decisions/DEC-004.md
