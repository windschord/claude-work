# 要件定義: DBマイグレーション v6 - DeveloperSettings/SshKey テーブル追加

## 背景

`/settings/developer` ページが `SQLITE_ERROR` で500エラーを返す。原因は `DeveloperSettings` テーブルと `SshKey` テーブルが `cli-utils.ts` の `migrateDatabase()` 関数に含まれておらず、Docker環境のエントリポイント起動時にテーブルが作成されないため。

スキーマ定義 (`src/db/schema.ts`) には両テーブルが存在するが、手動マイグレーション関数 (`src/bin/cli-utils.ts`) に反映されていない。

## 要件

### REQ-001: v5->v6マイグレーションでDeveloperSettingsテーブルを作成する

v5のデータベースに対してマイグレーションを実行した時、システムは `DeveloperSettings` テーブルを以下のスキーマで作成しなければならない:

| カラム | 型 | 制約 |
|--------|------|------|
| id | TEXT | PRIMARY KEY |
| scope | TEXT | NOT NULL |
| project_id | TEXT | REFERENCES Project(id) ON DELETE CASCADE |
| git_username | TEXT | |
| git_email | TEXT | |
| created_at | INTEGER | NOT NULL |
| updated_at | INTEGER | NOT NULL |

インデックス:
- `developer_settings_scope_project_id_idx` ON (scope, project_id)
- `developer_settings_global_unique` UNIQUE ON (scope) WHERE scope = 'GLOBAL'
- `developer_settings_project_unique` UNIQUE ON (project_id) WHERE scope = 'PROJECT' AND project_id IS NOT NULL

### REQ-002: v5->v6マイグレーションでSshKeyテーブルを作成する

v5のデータベースに対してマイグレーションを実行した時、システムは `SshKey` テーブルを以下のスキーマで作成しなければならない:

| カラム | 型 | 制約 |
|--------|------|------|
| id | TEXT | PRIMARY KEY |
| name | TEXT | NOT NULL UNIQUE |
| public_key | TEXT | NOT NULL |
| private_key_encrypted | TEXT | NOT NULL |
| encryption_iv | TEXT | NOT NULL |
| has_passphrase | INTEGER | NOT NULL DEFAULT 0 |
| created_at | INTEGER | NOT NULL |
| updated_at | INTEGER | NOT NULL |

### REQ-003: 新規DB作成時にも両テーブルが作成される

新規データベースに対してマイグレーションを実行した時 (v0->v6)、`createInitialTables()` 内で `DeveloperSettings` テーブルと `SshKey` テーブルも作成しなければならない。

### REQ-004: 既存データが保持される

マイグレーション実行時、既存のテーブルとデータは保持されなければならない。

### REQ-005: 冪等性の保証

マイグレーションを複数回実行しても、エラーが発生してはならない (`CREATE TABLE IF NOT EXISTS`)。
