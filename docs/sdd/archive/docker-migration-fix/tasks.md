# タスク管理書: DBマイグレーション修正

## タスク一覧

| ID | タスク | ステータス | 依存 |
|----|--------|-----------|------|
| TASK-001 | v4→v5マイグレーションテスト作成 | DONE | - |
| TASK-002 | v4→v5マイグレーション実装 | DONE | TASK-001 |
| TASK-003 | 既存テストのバージョン期待値更新 | DONE | TASK-002 |

## 詳細

### TASK-001: v4→v5マイグレーションテスト作成

**説明**: TDDに従い、v4→v5マイグレーションのテストを先に作成する。

**対象ファイル**: `src/bin/__tests__/cli-utils.test.ts`

**受入基準**:
- v4バグDB（Session.environment_id欠落）→v5マイグレーションテストが存在する
- v4正常DB（Session.environment_id存在）→v5マイグレーションテストが存在する
- テストが失敗する（実装前のため）

**TDD手順**:
1. `migrateDatabase` describeブロックに2つのテストを追加:
   - `should migrate v4 bug DB (missing Session.environment_id) to v5`
   - `should migrate v4 normal DB (Session.environment_id exists) to v5`
2. v4バグDBテスト: user_version=4のDBをSession.environment_idなしで作成 → migrateDatabase → environment_idが存在しuser_version=5
3. v4正常DBテスト: user_version=4のDBをSession.environment_id付きで作成 → migrateDatabase → エラーなくuser_version=5
4. `npx vitest run src/bin/__tests__/cli-utils.test.ts` で失敗を確認

### TASK-002: v4→v5マイグレーション実装

**説明**: CURRENT_DB_VERSIONを5に更新し、migrateV4ToV5関数を追加する。

**対象ファイル**: `src/bin/cli-utils.ts`

**受入基準**:
- CURRENT_DB_VERSION が 5
- migrateV4ToV5() が Session.environment_id を safeAddColumn で追加する
- migrateDatabase() に v4→v5 ステップが含まれる
- バージョン履歴コメントが更新されている
- TASK-001のテストがすべてpassする

**実装手順**:
1. CURRENT_DB_VERSION を 4 → 5 に変更
2. migrateV4ToV5() 関数を追加
3. migrateDatabase() のトランザクション内に `if (version < 5)` ブロックを追加
4. バージョン履歴コメントに v5 を追加
5. createInitialTables のコメントを更新
6. `npx vitest run src/bin/__tests__/cli-utils.test.ts` でTASK-001のテストがpassすることを確認

### TASK-003: 既存テストのバージョン期待値更新

**説明**: 既存テストのuser_version期待値を4→5に更新する。

**対象ファイル**: `src/bin/__tests__/cli-utils.test.ts`

**受入基準**:
- 全テストのuser_version期待値が5になっている
- テスト名のバージョン表記が更新されている
- `npx vitest run src/bin/__tests__/cli-utils.test.ts` で全テストがpassする
