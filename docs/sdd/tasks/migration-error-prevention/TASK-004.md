# TASK-004: 統合テストと動作確認

## 概要

全機能の統合テストを実施し、実際のSystemd起動シナリオで動作確認を行います。

## 関連ドキュメント

- **要件**: すべて（US-001、US-002、US-003）
- **設計**: [設計概要](../../design/migration-error-prevention/index.md) @../../design/migration-error-prevention/index.md

## テストシナリオ

### 1. 正常系: スキーマ一致時の起動

```bash
# 1. クリーンなデータベースで起動
rm -f data/claudework.db
npx claude-work

# 期待:
# - スキーマ同期が実行される
# - スキーマ整合性チェックがパスする
# - サーバーが正常起動する
```

### 2. 異常系: スキーマ不一致時の起動

```bash
# 1. 意図的にカラムを削除
sqlite3 data/claudework.db "ALTER TABLE Session DROP COLUMN active_connections"

# 2. 起動試行
npx claude-work

# 期待:
# - スキーマ整合性チェックで不一致検出
# - エラーメッセージが表示される
# - process.exit(1)で終了
# - HTTPサーバーは起動しない
```

### 3. ヘルスチェックAPI

```bash
# 1. サーバー起動
npx claude-work

# 2. ヘルスチェック実行
curl -i http://localhost:3000/api/health

# 期待:
# HTTP/1.1 200 OK
# {"status":"healthy","timestamp":"...","checks":{...}}
```

### 4. スキーマ変更後の同期

```bash
# 1. schema.tsに新規カラム追加
# 例: sessions テーブルに test_column を追加

# 2. 起動
npx claude-work

# 期待:
# - drizzle-kit push が新規カラムを追加
# - スキーマ整合性チェックがパスする
# - サーバーが正常起動する

# 3. データベース確認
sqlite3 data/claudework.db "PRAGMA table_info(Session)"

# 期待:
# - test_column が存在する
```

## 受入基準

- [ ] 正常系テストがすべてパスする
- [ ] 異常系テストがすべてパスする
- [ ] ヘルスチェックAPIが正しく動作する
- [ ] スキーマ変更が自動的に適用される
- [ ] エラーメッセージが明確で修復方法が示されている

## ステータス

**TODO**
