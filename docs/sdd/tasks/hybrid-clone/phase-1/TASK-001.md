# TASK-001: データベーススキーマ変更

## 概要

**目的**: Projectテーブルに、cloneLocationとdockerVolumeIdフィールドを追加し、ハイブリッド設計を実現する基盤を整備する。

**対象ファイル**:
- `prisma/schema.prisma`
- `src/db/schema.ts` (Drizzle ORMの場合)

**推定工数**: 30分

## 技術的文脈

- **データベース**: SQLite (Prisma ORM使用)
- **既存スキーマ**: `prisma/schema.prisma`に定義
- **マイグレーション方針**: `npx prisma db push` を使用（開発環境向け）
- **既存プロジェクトの扱い**: cloneLocationが未定義の場合、'host'として扱う（アプリケーションレイヤーでフォールバック）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | - Projectテーブルに2つのフィールドを追加<br>- cloneLocation: 'host' or 'docker'（デフォルト: 'docker'）<br>- dockerVolumeId: string or null<br>- 既存プロジェクトは'host'として扱う |
| 不明/要確認の情報 | なし（すべて要件・設計で明確化済み） |

## 実装手順（TDD）

### 1. スキーマ変更

**ファイル**: `prisma/schema.prisma`

```prisma
model Project {
  id             String   @id @default(uuid())
  name           String
  repository_url String
  environment_id String?

  // ハイブリッド設計: リポジトリの保存場所
  // 'host': ホスト環境（data/repos/）
  // 'docker': Docker環境（Dockerボリューム）
  // 既存プロジェクトはnullの場合、'host'として扱う
  cloneLocation  String?  @default("docker")

  // Docker環境の場合のボリューム名
  // 形式: claude-repo-<project-id>
  // ホスト環境の場合はnull
  dockerVolumeId String?

  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  sessions       Session[]
  environment    ExecutionEnvironment? @relation(fields: [environment_id], references: [id])

  @@map("projects")
}
```

### 2. Prisma Client生成とデータベース変更適用

```bash
# Prisma Client生成
npx prisma generate

# データベース変更適用
npx prisma db push
```

### 3. 型定義の確認

Prisma Clientが自動生成する型を確認：

```typescript
// 自動生成される型（例）
type Project = {
  id: string;
  name: string;
  repository_url: string;
  environment_id: string | null;
  cloneLocation: string | null;
  dockerVolumeId: string | null;
  created_at: Date;
  updated_at: Date;
}
```

### 4. バックアップ作成（推奨）

```bash
# データベースのバックアップ
cp data/claudework.db data/claudework.db.backup-before-hybrid-design
```

### 5. コミット

```bash
git add prisma/schema.prisma
git commit -m "feat: Projectテーブルにclone Location/dockerVolumeIdを追加

ハイブリッド設計のためのデータベーススキーマ変更

- cloneLocation: リポジトリの保存場所('host' or 'docker')
- dockerVolumeId: Dockerボリューム名（Docker環境の場合のみ）

既存プロジェクトはcloneLocation='host'として扱う

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `prisma/schema.prisma`にcloneLocationフィールドが追加されている
- [ ] `prisma/schema.prisma`にdockerVolumeIdフィールドが追加されている
- [ ] `cloneLocation`のデフォルト値が"docker"である
- [ ] `npx prisma generate`が成功する
- [ ] `npx prisma db push`が成功する
- [ ] データベースに新しいフィールドが追加されている
- [ ] 既存のプロジェクトデータが破壊されていない
- [ ] スキーマ変更がコミットされている

## テストケース

### データベース確認

```bash
# SQLiteデータベースの確認
sqlite3 data/claudework.db

# テーブル構造の確認
.schema projects

# 既存データの確認
SELECT id, name, cloneLocation, dockerVolumeId FROM projects;
```

**期待結果**:
- `cloneLocation`と`dockerVolumeId`フィールドが存在する
- 既存プロジェクトの`cloneLocation`はnull（アプリケーションレイヤーで'host'として扱う）
- 既存プロジェクトの`dockerVolumeId`はnull

### Prisma Studioでの確認

```bash
npx prisma studio
```

**期待結果**:
- ブラウザでProjectテーブルを開ける
- `cloneLocation`と`dockerVolumeId`フィールドが表示される

## 依存関係

- **依存するタスク**: なし（最初のタスク）
- **このタスクに依存するタスク**: TASK-002, TASK-005, TASK-010, TASK-013, TASK-016

## トラブルシューティング

### Prisma Client生成失敗

**症状**: `npx prisma generate`がエラーで失敗

**対策**:
1. `node_modules`を削除して再インストール
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Prismaバージョンを確認
   ```bash
   npx prisma --version
   ```

### データベース変更適用失敗

**症状**: `npx prisma db push`がエラーで失敗

**対策**:
1. データベースファイルのパーミッションを確認
   ```bash
   ls -la data/claudework.db
   ```
2. データベースがロックされていないか確認
   ```bash
   # 実行中のプロセスを確認
   lsof data/claudework.db
   ```

## ステータス

`DONE`

**完了サマリー**: Drizzle ORM移行済み（本文のPrisma手順は履歴として参照）。src/db/schema.tsのprojectsテーブルにclone_location(text, default 'docker')とdocker_volume_id(text)フィールドが定義済み。既存プロジェクトはnull時'host'として扱う後方互換性あり。

## 関連ドキュメント

- [データベーススキーマ設計](../../design/database/schema.md) @../../design/database/schema.md
- [要件定義: データベーススキーマ変更](../../requirements/index.md#データベーススキーマ変更) @../../requirements/index.md
