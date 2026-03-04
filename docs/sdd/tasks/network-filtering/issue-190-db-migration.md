# タスク: NetworkFilterテーブルDBマイグレーション (Issue #190)

## ステータス: DONE

## 完了サマリー

CURRENT_DB_VERSIONを7に更新し、v6→v7マイグレーションを追加。NetworkFilterConfig/NetworkFilterRuleテーブルがDocker Composeデプロイ時に自動作成されるようになった。CIチェック全通過。PR #198。

## タスク一覧

### TASK-001: テスト追加

**ステータス**: DONE

**対象ファイル**: `src/bin/__tests__/cli-utils.test.ts`

**内容**:
- initializeDatabaseテストにNetworkFilterConfig/NetworkFilterRuleテーブルの存在確認を追加
- migrateDatabase v6→v7テストを追加
- 既存のバージョン確認テストをv7対応に更新

**受入基準**:
- [x] テストが追加され、失敗することを確認（TDD）

### TASK-002: 実装

**ステータス**: DONE

**対象ファイル**: `src/bin/cli-utils.ts`

**内容**:
- CURRENT_DB_VERSION を 7 に更新
- バージョン履歴コメントにv7を追加
- `migrateV6ToV7()` 関数を追加
- `migrateDatabase()` にv6→v7ブロックを追加
- `createInitialTables()` にNetworkFilterConfig/NetworkFilterRuleを追加

**受入基準**:
- [x] 全テストがパス
- [x] 既存テストが壊れていない
- [x] CI全チェック通過

## 依存関係

なし（単独タスク）

## 関連ドキュメント

- 要件: `docs/sdd/requirements/network-filtering/issue-190-db-migration.md`
- 設計: `docs/sdd/design/network-filtering/issue-190-db-migration.md`
- Issue: #190
- PR: https://github.com/windschord/claude-work/pull/198
