# 設計書: DBマイグレーション v6 - DeveloperSettings/SshKey テーブル追加

## 変更対象ファイル

- `src/bin/cli-utils.ts` - マイグレーション関数

## 設計

### 1. CURRENT_DB_VERSION を 5 -> 6 に変更

### 2. createInitialTables() に両テーブルを追加

新規DB作成時 (v0->v1) に `DeveloperSettings` と `SshKey` テーブルも作成する。
`CREATE TABLE IF NOT EXISTS` を使用し冪等性を保証。

### 3. migrateV5ToV6() 関数を追加

既存DBの v5->v6 マイグレーション:
- `DeveloperSettings` テーブルを `CREATE TABLE IF NOT EXISTS` で作成
- インデックス3つを作成
- `SshKey` テーブルを `CREATE TABLE IF NOT EXISTS` で作成
- `SshKey.name` に UNIQUE インデックス (`ssh_key_name_unique`) を作成

### 4. migrateDatabase() の runMigration トランザクションに v5->v6 ステップを追加

```typescript
if (version < 6) {
  migrateV5ToV6(db!);
  version = 6;
}
```

## スキーマ定義との整合性

`src/db/schema.ts` の定義に完全に一致させる:
- DeveloperSettings: テーブル名 `DeveloperSettings`、3つのインデックス
- SshKey: テーブル名 `SshKey`、name カラムに UNIQUE 制約
