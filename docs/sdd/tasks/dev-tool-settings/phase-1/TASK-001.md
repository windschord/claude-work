# TASK-001: Drizzleスキーマ追加（DeveloperSettings, SshKey）

> **サブエージェント実行指示**
> このドキュメントは、タスク実行エージェントがサブエージェントにそのまま渡すことを想定しています。
> 以下の内容に従って実装を完了してください。

---

## あなたのタスク

**Drizzleスキーマに DeveloperSettings と SshKey テーブルを追加** してください。

### 実装の目標

開発ツール設定管理機能のためのデータベーススキーマを Drizzle ORM に追加します。Git設定を階層的に管理する DeveloperSettings テーブルと、SSH鍵を暗号化保存する SshKey テーブルを定義します。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 変更 | `prisma/schema.prisma` | DeveloperSettings, SshKey モデルと SettingScope enum を追加 |

---

## 技術的コンテキスト

### 使用技術
- ORM: Drizzle ORM
- データベース: SQLite
- 言語: Drizzle Schema Language

### 参照すべきファイル
以下のファイルを読み込んで、既存のスキーマスタイルに従ってください：

- `@prisma/schema.prisma` - 既存のDrizzleスキーマ（Project, Session, GitHubPAT等）

### 関連する設計書
- `@docs/sdd/design/dev-tool-settings/database/schema.md` - データベーススキーマ設計の詳細

### 関連する要件
- `@docs/sdd/requirements/dev-tool-settings/stories/US-001.md` - グローバル Git 設定の管理
- `@docs/sdd/requirements/dev-tool-settings/stories/US-002.md` - プロジェクト別 Git 設定の上書き
- `@docs/sdd/requirements/dev-tool-settings/stories/US-003.md` - SSH 鍵ペアの登録・管理

---

## 受入基準

以下のすべての基準を満たしたら、このタスクは完了です：

- [x] `prisma/schema.prisma` に `DeveloperSettings` モデルが追加されている
- [x] `prisma/schema.prisma` に `SshKey` モデルが追加されている
- [x] `prisma/schema.prisma` に `SettingScope` enum が追加されている
- [x] `@@unique([scope, project_id])` 制約が DeveloperSettings に設定されている
- [x] `name` フィールドに `@unique` 制約が SshKey に設定されている
- [x] `npx prisma format` でフォーマットエラーが0件である
- [x] `npx prisma validate` でバリデーションエラーが0件である
- [x] `npx prisma db push` でスキーマがデータベースに適用できる
- [x] `npx prisma generate` で Drizzle Client が生成できる

---

## 実装手順

### ステップ1: スキーマ追加

1. `prisma/schema.prisma` を開く
2. 既存のモデル定義の後に、以下のモデルを追加：
   - `SettingScope` enum
   - `DeveloperSettings` モデル
   - `SshKey` モデル
3. フォーマット: `npx prisma format`
4. バリデーション: `npx prisma validate`

### ステップ2: データベースに反映

1. スキーマをデータベースに適用: `npx prisma db push`
2. Drizzle Client を再生成: `npx prisma generate`

### ステップ3: コミットして完了

1. 変更をコミット: `feat(db): Add DeveloperSettings and SshKey tables`
2. 受入基準をすべて確認

---

## 実装の詳細仕様

### SettingScope enum

```prisma
enum SettingScope {
  GLOBAL   // グローバル設定（全プロジェクト共通）
  PROJECT  // プロジェクト別設定（プロジェクトごと）
}
```

### DeveloperSettings モデル

```prisma
model DeveloperSettings {
  id           String       @id @default(uuid())
  scope        SettingScope // GLOBAL または PROJECT
  project_id   String?      // プロジェクト設定の場合は Project.id、グローバルの場合は NULL
  git_username String?      // Git user.name
  git_email    String?      // Git user.email
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt

  project      Project?     @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@unique([scope, project_id]) // グローバル設定は1つ、プロジェクト別設定はプロジェクトごとに1つ
  @@index([scope, project_id])  // 検索最適化用
}
```

**制約**:
- `scope = GLOBAL` の場合、`project_id` は NULL
- `scope = PROJECT` の場合、`project_id` は NOT NULL
- `(scope, project_id)` の組み合わせはユニーク

### SshKey モデル

```prisma
model SshKey {
  id                     String   @id @default(uuid())
  name                   String   @unique // 鍵の識別名（例: "GitHub Personal"）
  public_key             String   // SSH公開鍵（平文）
  private_key_encrypted  String   // SSH秘密鍵（AES-256暗号化）
  encryption_iv          String   // 暗号化初期化ベクトル（IV）
  has_passphrase         Boolean  @default(false) // パスフレーズ保護の有無
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt
}
```

**注意**:
- `public_key` と `private_key_encrypted` は `String` 型（SQLiteには `Text` 型マッピング）
- `encryption_iv` は Base64エンコードされた文字列

---

## テスト方法

### スキーマバリデーション
```bash
npx prisma format
npx prisma validate
```

### データベース適用
```bash
npx prisma db push
```

### Drizzle Client 生成確認
```bash
npx prisma generate
```

---

## 関連タスク

- **TASK-002**: EncryptionService実装（SshKeyの暗号化に使用）
- **TASK-003**: DeveloperSettingsService実装（DeveloperSettingsテーブルのCRUD）
- **TASK-004**: SshKeyService実装（SshKeyテーブルのCRUD）

---

**推定工数**: 20分
**ステータス**: DONE

**完了サマリー**: Drizzleスキーマ(src/db/schema.ts)にDeveloperSettings, SshKeyテーブルとsettingScopeカラムを追加。@@unique, @unique制約を設定。npm run db:pushでスキーマ適用済み。

**依存**: なし
