# 設計書: Volume削除オプション機能

## アーキテクチャ概要

環境削除・プロジェクト削除の既存フローに「Volume保持オプション」を追加する。
APIはDELETEリクエストのクエリパラメータで保持対象を指定し、バックエンドは指定されたVolumeの削除をスキップする。

## コンポーネント設計

### 1. 環境削除フロー

```text
DeleteEnvironmentDialog (チェックボックス追加)
  → useEnvironments.deleteEnvironment(id, { keepClaudeVolume, keepConfigVolume })
    → DELETE /api/environments/{id}?keepClaudeVolume=true&keepConfigVolume=true
      → EnvironmentService.delete(id, { keepClaudeVolume, keepConfigVolume })
```

### 2. プロジェクト削除フロー

```text
DeleteProjectDialog (チェックボックス追加)
  → useAppStore.deleteProject(id, { keepGitVolume })
    → DELETE /api/projects/{id}?keepGitVolume=true
      → API route: Volume削除処理 (DockerClient.removeVolume)
```

## API設計

### DELETE /api/environments/:id

**変更**: クエリパラメータ追加

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| keepClaudeVolume | boolean | false | trueの場合、Claude設定Volumeを保持 |
| keepConfigVolume | boolean | false | trueの場合、Config Claude Volumeを保持 |

### DELETE /api/projects/:project_id

**変更**: クエリパラメータ追加 + Volume削除処理追加

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| keepGitVolume | boolean | false | trueの場合、Git checkout Volumeを保持 |

## 詳細設計

### EnvironmentService.delete() 変更

```typescript
interface DeleteEnvironmentOptions {
  keepClaudeVolume?: boolean;
  keepConfigVolume?: boolean;
}

async delete(id: string, options?: DeleteEnvironmentOptions): Promise<void> {
  // ... 既存のトランザクション処理 ...

  // Volume削除部分で options を参照
  if (environment.type === 'DOCKER' && !environment.auth_dir_path) {
    const volumeNames = getConfigVolumeNames(id);
    if (!options?.keepClaudeVolume) {
      await dockerClient.removeVolume(volumeNames.claudeVolume);
    }
    if (!options?.keepConfigVolume) {
      await dockerClient.removeVolume(volumeNames.configClaudeVolume);
    }
  }
}
```

### プロジェクト削除API変更

```typescript
// DELETE /api/projects/[project_id]/route.ts
export async function DELETE(request: NextRequest, ...) {
  const keepGitVolume = request.nextUrl.searchParams.get('keepGitVolume') === 'true';

  // 既存: DB削除
  db.delete(schema.projects).where(...).run();

  // 新規: Volume削除（ベストエフォート）
  if (!keepGitVolume && project.clone_location === 'docker') {
    const volumeName = project.docker_volume_id || `claude-repo-${project_id}`;
    try {
      const dockerClient = DockerClient.getInstance();
      await dockerClient.removeVolume(volumeName);
    } catch (error) {
      logger.warn('Git checkout Volume削除失敗', { volume: volumeName, error });
    }
  }
}
```

### UI設計

チェックボックスは「Volumeを保持する」形式で、デフォルト未チェック（=削除）。
Docker環境/Dockerクローンの場合のみ表示。
