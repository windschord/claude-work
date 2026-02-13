# API設計: プロジェクト登録（/api/projects/clone）

## 概要

プロジェクト登録APIに、リポジトリの保存場所（ホスト環境/Docker環境）選択機能を追加する。

## エンドポイント

```
POST /api/projects/clone
```

## リクエスト

### リクエストボディ

```typescript
interface ProjectCloneRequest {
  // 既存パラメータ
  name: string;              // プロジェクト名
  repository_url: string;    // リポジトリURL
  environment_id?: string;   // 実行環境ID（オプション）

  // 新規パラメータ
  cloneLocation?: 'host' | 'docker';  // 保存場所（デフォルト: 'docker'）
}
```

### パラメータ詳細

| パラメータ | 型 | 必須 | デフォルト値 | 説明 |
|----------|---|------|------------|------|
| name | string | はい | - | プロジェクト名（英数字、ハイフン、アンダースコアのみ） |
| repository_url | string | はい | - | GitリポジトリURL（HTTPS or SSH） |
| environment_id | string | いいえ | null | 実行環境ID（Docker環境の場合のみ使用） |
| cloneLocation | 'host' \| 'docker' | いいえ | 'docker' | リポジトリの保存場所 |

### バリデーション

#### nameのバリデーション
```typescript
const VALID_PROJECT_NAME = /^[a-zA-Z0-9_-]+$/;
const MAX_PROJECT_NAME_LENGTH = 255;

function validateProjectName(name: string): void {
  if (!name || name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new ApiError(400, 'Invalid project name length');
  }
  if (name.includes('..') || name.startsWith('/')) {
    throw new ApiError(400, 'Invalid project name: path traversal detected');
  }
  if (!VALID_PROJECT_NAME.test(name)) {
    throw new ApiError(400, 'Invalid project name: only alphanumeric, hyphen, and underscore allowed');
  }
}
```

#### repository_urlのバリデーション
```typescript
const VALID_GIT_URL = /^(https:\/\/|git@)/;

function validateRepositoryUrl(url: string): void {
  if (url.startsWith('file://') || url.startsWith('/')) {
    throw new ApiError(400, 'Invalid repository URL: local paths not allowed');
  }
  if (!VALID_GIT_URL.test(url)) {
    throw new ApiError(400, 'Invalid repository URL: must be HTTPS or SSH');
  }
}
```

#### cloneLocationのバリデーション
```typescript
function validateCloneLocation(cloneLocation?: string): 'host' | 'docker' {
  if (!cloneLocation) {
    return 'docker'; // デフォルト値
  }
  if (cloneLocation !== 'host' && cloneLocation !== 'docker') {
    throw new ApiError(400, `Invalid cloneLocation: must be 'host' or 'docker'`);
  }
  return cloneLocation;
}
```

### リクエスト例

#### ホスト環境でのプロジェクト登録
```json
{
  "name": "my-project",
  "repository_url": "git@github.com:user/repo.git",
  "cloneLocation": "host"
}
```

#### Docker環境でのプロジェクト登録
```json
{
  "name": "my-project",
  "repository_url": "git@github.com:user/repo.git",
  "cloneLocation": "docker",
  "environment_id": "env-docker-default"
}
```

#### デフォルト（Docker環境）
```json
{
  "name": "my-project",
  "repository_url": "git@github.com:user/repo.git"
}
```

## レスポンス

### 成功レスポンス（201 Created）

```typescript
interface ProjectCloneResponse {
  id: string;
  name: string;
  repository_url: string;
  cloneLocation: 'host' | 'docker';
  dockerVolumeId: string | null;
  environment_id: string | null;
  created_at: string;
}
```

#### レスポンス例（ホスト環境）
```json
{
  "id": "proj-123abc",
  "name": "my-project",
  "repository_url": "git@github.com:user/repo.git",
  "cloneLocation": "host",
  "dockerVolumeId": null,
  "environment_id": null,
  "created_at": "2026-02-13T10:00:00.000Z"
}
```

#### レスポンス例（Docker環境）
```json
{
  "id": "proj-456def",
  "name": "my-project",
  "repository_url": "git@github.com:user/repo.git",
  "cloneLocation": "docker",
  "dockerVolumeId": "claude-repo-proj-456def",
  "environment_id": "env-docker-default",
  "created_at": "2026-02-13T10:00:00.000Z"
}
```

### エラーレスポンス

#### 400 Bad Request（バリデーションエラー）
```json
{
  "error": "Invalid project name: path traversal detected"
}
```

#### 500 Internal Server Error（clone失敗）
```json
{
  "error": "Failed to clone repository",
  "details": "Permission denied (publickey)"
}
```

#### 504 Gateway Timeout（タイムアウト）
```json
{
  "error": "git clone timed out after 5 minutes",
  "details": "Consider increasing timeout in settings"
}
```

## 実装フロー

### 1. リクエスト受信とバリデーション

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  // バリデーション
  validateProjectName(body.name);
  validateRepositoryUrl(body.repository_url);
  const cloneLocation = validateCloneLocation(body.cloneLocation);

  // ...
}
```

### 2. 環境別の処理分岐

```typescript
if (cloneLocation === 'host') {
  // ホスト環境でのclone
  await hostGitService.cloneRepository(body.repository_url, project.id);
} else {
  // Docker環境でのclone
  const volumeId = await dockerGitService.cloneRepository(
    body.repository_url,
    project.id,
    body.environment_id
  );
  project.dockerVolumeId = volumeId;
}
```

### 3. データベース保存

```typescript
const project = await prisma.project.create({
  data: {
    name: body.name,
    repository_url: body.repository_url,
    cloneLocation,
    dockerVolumeId: cloneLocation === 'docker' ? volumeId : null,
    environment_id: cloneLocation === 'docker' ? body.environment_id : null,
  },
});
```

### 4. レスポンス返却

```typescript
return NextResponse.json(project, { status: 201 });
```

## エラーハンドリング

### clone失敗時のクリーンアップ

```typescript
try {
  if (cloneLocation === 'host') {
    await hostGitService.cloneRepository(url, projectId);
  } else {
    volumeId = await dockerGitService.cloneRepository(url, projectId, environmentId);
  }
} catch (error) {
  // クリーンアップ
  if (cloneLocation === 'docker' && volumeId) {
    await dockerGitService.cleanupVolume(volumeId);
  }

  // エラーレスポンス
  return NextResponse.json(
    {
      error: 'Failed to clone repository',
      details: error.message,
    },
    { status: 500 }
  );
}
```

### タイムアウト処理

```typescript
const timeout = configService.getGitCloneTimeoutMinutes() * 60 * 1000;
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);

try {
  await cloneWithSignal(url, path, controller.signal);
} catch (error) {
  if (error.name === 'AbortError') {
    return NextResponse.json(
      {
        error: `git clone timed out after ${configService.getGitCloneTimeoutMinutes()} minutes`,
        details: 'Consider increasing timeout in settings',
      },
      { status: 504 }
    );
  }
  throw error;
} finally {
  clearTimeout(timeoutId);
}
```

## セキュリティ

### CSRF対策
Next.js App Routerのデフォルトで適用される。

### 認証・認可
現状、認証機能は実装されていないが、将来的に追加予定。

### パストラバーサル対策
プロジェクト名のバリデーションで対策。

## パフォーマンス

### タイムアウト設定
- デフォルト: 5分
- 設定で変更可能: 1分〜30分

### 非同期処理
git clone処理は同期的に実行（ユーザーに結果をすぐに返す必要があるため）。

### ログ出力
```typescript
logger.info(`[${cloneLocation}] Starting clone`, {
  projectId: project.id,
  url: sanitizeUrl(body.repository_url),
});

logger.info(`[${cloneLocation}] Clone completed`, {
  projectId: project.id,
  duration: Date.now() - startTime,
});
```

## テスト

### ユニットテスト

```typescript
describe('POST /api/projects/clone', () => {
  it('should clone project to host environment', async () => {
    const response = await fetch('/api/projects/clone', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test-project',
        repository_url: 'git@github.com:test/repo.git',
        cloneLocation: 'host',
      }),
    });

    expect(response.status).toBe(201);
    const project = await response.json();
    expect(project.cloneLocation).toBe('host');
    expect(project.dockerVolumeId).toBeNull();
  });

  it('should clone project to docker environment', async () => {
    const response = await fetch('/api/projects/clone', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test-project',
        repository_url: 'git@github.com:test/repo.git',
        cloneLocation: 'docker',
      }),
    });

    expect(response.status).toBe(201);
    const project = await response.json();
    expect(project.cloneLocation).toBe('docker');
    expect(project.dockerVolumeId).toMatch(/^claude-repo-/);
  });

  it('should use docker as default cloneLocation', async () => {
    const response = await fetch('/api/projects/clone', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test-project',
        repository_url: 'git@github.com:test/repo.git',
      }),
    });

    expect(response.status).toBe(201);
    const project = await response.json();
    expect(project.cloneLocation).toBe('docker');
  });
});
```

## 関連ドキュメント

- requirements/stories/US-001.md: プロジェクト登録時の保存場所選択
- requirements/stories/US-002.md: ホスト環境でのプロジェクトclone
- requirements/stories/US-003.md: Docker環境でのプロジェクトclone
- design/database/schema.md: データベーススキーマ
- design/components/docker-git-service.md: DockerGitService実装
