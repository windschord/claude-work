# タスク管理: DBマイグレーション v6

## TASK-001: テスト作成 (TDD - Red)

**ステータス**: completed
**ファイル**: `src/bin/__tests__/cli-utils.test.ts`

### 実装内容
1. 既存テスト内のバージョン番号を 5 -> 6 に更新
2. 新規テスト追加:
   - `should create DeveloperSettings table with correct columns and indexes` (新規DB)
   - `should create SshKey table with correct columns` (新規DB)
   - `should migrate v5 DB to v6` (既存v5 DBのマイグレーション)
3. 既存のバージョンマイグレーションテストのターゲットバージョンを 6 に更新

### 受入基準
- [x] テストが失敗すること (Red phase)

## TASK-002: マイグレーション実装 (TDD - Green)

**ステータス**: completed
**ファイル**: `src/bin/cli-utils.ts`

### 実装内容
1. `CURRENT_DB_VERSION` を 5 -> 6 に変更
2. `createInitialTables()` に DeveloperSettings と SshKey テーブル作成を追加
3. `migrateV5ToV6()` 関数を追加
4. `runMigration` トランザクションに v5->v6 ステップを追加

### 受入基準
- [x] TASK-001 で作成した全テストが通ること (Green phase)
- [x] 既存テストも全て通ること
