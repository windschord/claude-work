# 要件定義書: DBマイグレーション修正とDocker起動時自動実行

## 1. 概要

Docker Compose環境でDBスキーマの不整合によりサーバーが起動失敗する問題を修正する。
v3→v4マイグレーションにSession.environment_idカラムの追加が漏れており、
既にv4にマイグレーション済みのDBでは再実行されないためカラムが永久に欠落する。

## 2. 背景・問題分析

### 現状のマイグレーションフロー

```text
docker-entrypoint.sh
  └─ node -e "cliUtils.migrateDatabase(dbPath)"
       └─ PRAGMA user_version チェック
            ├─ v0→v1: 初期テーブル作成（全カラム含む）
            ├─ v1→v2: claude_code_options, custom_env_vars追加
            ├─ v2→v3: GitHubPATテーブル作成
            └─ v3→v4: 欠落カラム追加（Session.environment_id漏れ）
       └─ server.ts validateSchemaIntegrity()
            └─ Drizzleスキーマ vs PRAGMA table_info 比較
                 └─ Session.environment_id不足 → 起動失敗
```

### 問題の3パターン

| パターン | 状態 | 結果 |
|---------|------|------|
| 新規DB | v0→v4新規作成 | 正常（CREATE TABLEに全カラム含む）|
| v3からの更新 | v3→v4マイグレーション | 失敗（Session.environment_id未追加）|
| v4既存（バグDB） | user_version=4、カラム欠落 | 失敗（マイグレーション不実行）|

### 根本原因

1. `migrateV3ToV4()` に `safeAddColumn(db, 'Session', 'environment_id', 'TEXT')` が欠落
2. user_version=4のDBではv3→v4マイグレーションがスキップされ、修正が適用されない

## 3. ユーザーストーリー

**US-001**: 運用者として、Docker Compose環境で `docker compose up` を実行したとき、
DBスキーマが自動的に最新状態にマイグレーションされ、サーバーが正常に起動する。

**US-002**: 運用者として、既存のv4 DB（バグでカラム欠落）を持つ環境でも、
再起動するだけで欠落カラムが追加されサーバーが起動する。

## 4. 機能要件

### REQ-001: v4→v5マイグレーションの追加

v4で欠落したSession.environment_idカラムを追加するv4→v5マイグレーションを実装する。

**受入基準**:
- CURRENT_DB_VERSION が 5 に更新される
- migrateV4ToV5() が Session.environment_id を safeAddColumn で追加する
- v4 DB で migrateDatabase() 実行後、Session.environment_id が存在する
- 既にカラムが存在する場合（新規v4 DB）もエラーにならない

### REQ-002: migrateV3ToV4の修正

v3→v4マイグレーションにもSession.environment_idの追加を含める（今後v3 DBからの直接マイグレーション時に備える）。

**受入基準**:
- migrateV3ToV4() に safeAddColumn(db, 'Session', 'environment_id', 'TEXT') が含まれる
- v3 DB から直接 v5 へマイグレーション可能

### REQ-003: Docker起動時マイグレーション確認

docker-entrypoint.sh による起動時マイグレーションが正常に動作することを確認する。

**受入基準**:
- docker-entrypoint.sh で migrateDatabase() が正常終了する
- マイグレーション後に server.ts の validateSchemaIntegrity() が pass する
- マイグレーション失敗時はコンテナが exit code 1 で終了する

## 5. 非機能要件

### NFR-001: べき等性

マイグレーションは何度実行しても同じ結果となる（safeAddColumn使用）。

### NFR-002: 後方互換性

既存データは保持される。カラム追加のみで削除・変更は行わない。

### NFR-003: 起動時間

マイグレーション処理は1秒以内に完了する。

## 6. 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/bin/cli-utils.ts` | CURRENT_DB_VERSION更新、migrateV3ToV4修正、migrateV4ToV5追加 |
| `src/bin/__tests__/cli-utils.test.ts` | v4→v5マイグレーションテスト追加 |
