# 技術設計書: DBマイグレーション修正とDocker起動時自動実行

## 1. アーキテクチャ概要

既存のマイグレーションフレームワーク（`PRAGMA user_version` + `safeAddColumn`）を拡張し、
v4→v5マイグレーションを追加する。docker-entrypoint.shは変更不要（既に`migrateDatabase()`を呼び出している）。

```text
docker-entrypoint.sh (変更なし)
  └─ node -e "cliUtils.migrateDatabase(dbPath)"
       └─ PRAGMA user_version チェック
            ├─ v0→v1: 初期テーブル作成
            ├─ v1→v2: claude_code_options, custom_env_vars追加
            ├─ v2→v3: GitHubPATテーブル作成
            ├─ v3→v4: 欠落カラム追加 + Session.environment_id追加 (修正)
            └─ v4→v5: Session.environment_id修復 (新規)
       └─ server.ts validateSchemaIntegrity()
```

## 2. 変更対象

| ファイル | 変更内容 |
|---------|---------|
| src/bin/cli-utils.ts | CURRENT_DB_VERSION=5、migrateV3ToV4修正(済)、migrateV4ToV5追加、migrateDatabase内にv4→v5ステップ追加 |
| src/bin/__tests__/cli-utils.test.ts | v4→v5マイグレーションテスト追加、既存テストのバージョン期待値を5に更新 |

## 3. 詳細設計

### 3.1 CURRENT_DB_VERSION の更新

```typescript
const CURRENT_DB_VERSION = 5; // 4 → 5
```

### 3.2 migrateV3ToV4 の修正（既に実施済み）

```typescript
function migrateV3ToV4(db: InstanceType<typeof Database>): void {
  // ... 既存のカラム追加 ...
  safeAddColumn(db, 'Session', 'session_state', "TEXT NOT NULL DEFAULT 'ACTIVE'");
  safeAddColumn(db, 'Session', 'environment_id', 'TEXT'); // 追加済み
  // ... インデックス追加 ...
}
```

### 3.3 migrateV4ToV5 の新規追加

v4で欠落したSession.environment_idカラムを修復する。
safeAddColumnを使用するため、既にカラムが存在する場合（新規DBがv0→v5で作成された場合）はスキップされる。

```typescript
function migrateV4ToV5(db: InstanceType<typeof Database>): void {
  console.log('Migrating to v5: Fixing missing Session.environment_id...');
  safeAddColumn(db, 'Session', 'environment_id', 'TEXT');
}
```

### 3.4 migrateDatabase内のステップ追加

```typescript
// バージョン 4 → 5: Session.environment_id修復
if (version < 5) {
  migrateV4ToV5(db!);
  version = 5;
}

// バージョン番号を永続化（トランザクション末尾で実行）
db!.exec(`PRAGMA user_version = ${version}`);
```

### 3.5 createInitialTables のバージョンコメント更新

```typescript
/**
 * 初期テーブルを作成（v0 → v1）
 *
 * 最新スキーマの全カラム・全インデックスを含む完全版。
 * 新規DBはv0からv1→v2→v3→v4→v5と段階的にマイグレーションされるが、
 * v1で全カラムを作成しておくことで後続マイグレーションはスキップされる。
 */
```

## 4. テスト設計

### 4.1 新規テスト

| テスト | 説明 |
|-------|------|
| v4バグDB→v5マイグレーション | user_version=4でSession.environment_idが欠落したDBでmigrateDatabase()を実行し、カラムが追加されuser_version=5になることを確認 |
| v4正常DB→v5マイグレーション | user_version=4でSession.environment_idが既に存在するDBでmigrateDatabase()を実行し、エラーなくuser_version=5になることを確認 |

### 4.2 既存テスト更新

| テスト | 変更内容 |
|-------|---------|
| 新規DB→最新バージョン | user_version期待値を4→5に変更 |
| v1→最新バージョン | user_version期待値を4→5に変更、Session.environment_id確認追加 |
| v3→最新バージョン | user_version期待値を4→5に変更 |
| スキップテスト | "already at latest version (4)" → "(5)"に変更 |
| べき等性テスト | user_version期待値を4→5に変更 |
| データ保持テスト | user_version期待値の暗黙的更新（migrateDatabase結果がv5） |

### 4.3 Docker Compose統合テスト（手動）

Docker Compose環境での動作確認は手動テストで実施する。

| テスト | 手順 | 期待結果 |
|-------|------|---------|
| 既存v4バグDBでの起動 | 1. Session.environment_id欠落のv4 DBを配置 2. `docker compose up` | マイグレーションが自動実行され、サーバーが正常起動する |
| 既存v4正常DBでの起動 | 1. Session.environment_id存在のv4 DBを配置 2. `docker compose up` | マイグレーションが実行されてもエラーなくサーバーが正常起動する |
| 新規DBでの起動 | 1. DBファイルを削除 2. `docker compose up` | v0→v5マイグレーションが実行され、サーバーが正常起動する |
| マイグレーション済みDBでの再起動 | 1. v5 DBが存在する状態で `docker compose restart` | マイグレーションがスキップされ、サーバーが正常起動する |

## 5. べき等性の保証

- `safeAddColumn`は「duplicate column name」エラーを無視するため、何度実行しても安全
- 新規DB（v0→v5）: createInitialTablesで全カラム作成済み → v4→v5のsafeAddColumnはスキップ
- v3→v5: migrateV3ToV4でenvironment_id追加済み → v4→v5のsafeAddColumnはスキップ
- v4バグDB: migrateV4ToV5でenvironment_id追加 → 修復完了
- v4正常DB: migrateV4ToV5のsafeAddColumnがスキップ → エラーなし
