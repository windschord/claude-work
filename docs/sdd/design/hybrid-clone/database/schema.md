# データベーススキーマ設計

## 概要

ハイブリッド設計に必要なデータベーススキーマ変更を定義します。既存のPrismaスキーマとの互換性を維持しつつ、新しいフィールドを追加します。

## スキーマ変更

### Projectテーブル

#### 変更内容

| フィールド名 | 型 | NULL許可 | デフォルト値 | 説明 |
|------------|---|---------|------------|------|
| cloneLocation | String | はい | "docker" | リポジトリの保存場所（'host' or 'docker'） |
| dockerVolumeId | String | はい | null | Dockerボリューム名（Docker環境の場合のみ） |

#### Prismaスキーマ定義

```prisma
model Project {
  id             String   @id @default(uuid())
  name           String
  repository_url String
  environment_id String?  // 既存フィールド

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

  // Relations
  sessions       Session[]
  environment    ExecutionEnvironment? @relation(fields: [environment_id], references: [id])

  @@map("projects")
}
```

## マイグレーション方針

### 既存レコードの扱い

**重要**: データベースマイグレーションスクリプトは不要。アプリケーションレイヤーでフォールバック処理を行う。

```typescript
// プロジェクト読み込み時のフォールバック
interface ProjectWithDefaults {
  id: string;
  name: string;
  repository_url: string;
  cloneLocation: 'host' | 'docker';
  dockerVolumeId: string | null;
  // ... 他のフィールド
}

function normalizeProject(project: Project): ProjectWithDefaults {
  return {
    ...project,
    // cloneLocationが未定義の場合、'host'として扱う
    cloneLocation: (project.cloneLocation as 'host' | 'docker') ?? 'host',
    // dockerVolumeIdが未定義の場合、nullとして扱う
    dockerVolumeId: project.dockerVolumeId ?? null,
  };
}
```

### 新規プロジェクトのデフォルト値

**デフォルト値**: `cloneLocation='docker'`

**理由**:
- SSH Agent問題を初期回避（DEC-001参照）
- 新規ユーザーがエラーに遭遇するリスクを低減

### マイグレーション手順

1. **Prismaスキーマ更新**:
   ```bash
   # prisma/schema.prisma を更新
   # cloneLocation, dockerVolumeId フィールドを追加
   ```

2. **Prisma Client生成**:
   ```bash
   npx prisma generate
   ```

3. **データベース変更適用**:
   ```bash
   npx prisma db push
   ```

4. **アプリケーションレイヤーのフォールバック処理実装**:
   - 既存プロジェクトの読み込み時、cloneLocationが未定義の場合は'host'として扱う
   - UI表示時、cloneLocationに応じて適切なバッジを表示

## データの一貫性

### cloneLocationとdockerVolumeIdの関係

| cloneLocation | dockerVolumeId | 妥当性 | 説明 |
|--------------|---------------|-------|------|
| 'host' | null | ✅ 正常 | ホスト環境、ボリュームなし |
| 'host' | 'claude-repo-xxx' | ❌ 不正 | ホスト環境でボリュームIDがあるのは矛盾 |
| 'docker' | 'claude-repo-xxx' | ✅ 正常 | Docker環境、ボリュームあり |
| 'docker' | null | ⚠️ 警告 | Docker環境でボリュームIDがないのは異常（削除された可能性） |
| null（既存） | null | ✅ 正常 | 既存プロジェクト、'host'として扱う |

### バリデーション

```typescript
function validateProjectCloneLocation(project: Project): void {
  // ホスト環境の場合、dockerVolumeIdはnullでなければならない
  if (project.cloneLocation === 'host' && project.dockerVolumeId !== null) {
    throw new Error(
      `Invalid state: host environment project should not have dockerVolumeId`
    );
  }

  // Docker環境の場合、dockerVolumeIdが必要
  if (project.cloneLocation === 'docker' && !project.dockerVolumeId) {
    logger.warn(
      `Docker environment project missing dockerVolumeId: ${project.id}`
    );
    // 警告のみ、エラーにはしない（ボリュームが削除された可能性）
  }
}
```

## インデックス戦略

### 既存インデックス
- `id`: 主キー（自動）
- `name`: ユニーク制約（既存）

### 新規インデックス（必要に応じて）
- `cloneLocation`: 環境別のプロジェクト検索用（将来的に追加検討）

**現時点では追加しない理由**:
- プロジェクト数が少ない（数百程度）
- cloneLocationで検索する頻度は低い

## クエリ例

### プロジェクト作成（ホスト環境）

```typescript
const project = await prisma.project.create({
  data: {
    name: 'my-project',
    repository_url: 'git@github.com:user/repo.git',
    cloneLocation: 'host',
    dockerVolumeId: null,
    environment_id: null, // ホスト環境は常にnull
  },
});
```

### プロジェクト作成（Docker環境）

```typescript
const project = await prisma.project.create({
  data: {
    name: 'my-project',
    repository_url: 'git@github.com:user/repo.git',
    cloneLocation: 'docker',
    dockerVolumeId: `claude-repo-${projectId}`,
    environment_id: defaultEnvironment.id,
  },
});
```

### 既存プロジェクトの読み込み

```typescript
const projects = await prisma.project.findMany();

// アプリケーションレイヤーでフォールバック
const normalizedProjects = projects.map(normalizeProject);
```

### 環境別のプロジェクト検索

```typescript
// ホスト環境のプロジェクトのみ
const hostProjects = await prisma.project.findMany({
  where: {
    OR: [
      { cloneLocation: 'host' },
      { cloneLocation: null }, // 既存プロジェクト
    ],
  },
});

// Docker環境のプロジェクトのみ
const dockerProjects = await prisma.project.findMany({
  where: {
    cloneLocation: 'docker',
  },
});
```

## ロールバック計画

### スキーマのロールバック

万が一、ハイブリッド設計を撤回する場合：

1. **Prismaスキーマから削除**:
   ```prisma
   model Project {
     // cloneLocationとdockerVolumeIdを削除
   }
   ```

2. **データベース変更適用**:
   ```bash
   npx prisma db push
   ```

3. **影響**: 既存のデータは保持されるが、cloneLocationとdockerVolumeIdフィールドは削除される

### データの保護

スキーマ変更前に、データベースのバックアップを推奨：

```bash
# SQLiteの場合
cp data/claudework.db data/claudework.db.backup
```

## テストデータ

### 開発環境用テストデータ

```typescript
// テストプロジェクト1: ホスト環境
await prisma.project.create({
  data: {
    id: 'test-project-host',
    name: 'test-host',
    repository_url: 'git@github.com:test/host.git',
    cloneLocation: 'host',
    dockerVolumeId: null,
  },
});

// テストプロジェクト2: Docker環境
await prisma.project.create({
  data: {
    id: 'test-project-docker',
    name: 'test-docker',
    repository_url: 'git@github.com:test/docker.git',
    cloneLocation: 'docker',
    dockerVolumeId: 'claude-repo-test-project-docker',
  },
});

// テストプロジェクト3: 既存プロジェクト（cloneLocation未定義）
await prisma.project.create({
  data: {
    id: 'test-project-legacy',
    name: 'test-legacy',
    repository_url: 'git@github.com:test/legacy.git',
    // cloneLocationとdockerVolumeIdは未定義
  },
});
```

## 関連ドキュメント

- requirements/index.md: データベーススキーマ変更の要件
- design/decisions/DEC-001.md: Docker環境をデフォルトにする理由
- design/api/project-clone.md: プロジェクト登録APIの変更
