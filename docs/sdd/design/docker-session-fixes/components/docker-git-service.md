# DockerGitService ボリューム名解決の修正

## 対応要件

- US-001/REQ-001: DBの `docker_volume_id` を使用
- US-001/REQ-002: nullの場合はフォールバック
- US-001/REQ-003: `docker_volume_id` パラメータ追加
- NFR-003: 後方互換性維持

## 現状のコード

```typescript
// src/services/docker-git-service.ts:62-67
private getVolumeName(projectId: string, projectName?: string): string {
  if (projectName) {
    return generateUniqueVolumeName('repo', projectName, [], projectId);
  }
  return `claude-repo-${projectId}`;
}
```

呼び出し元（8メソッド）はすべて `this.getVolumeName(projectId)` で呼び出し、`projectName` を渡していない。

## 修正設計

### 1. getVolumeName() のシグネチャ変更

```typescript
private getVolumeName(projectId: string, dockerVolumeId?: string | null, projectName?: string): string {
  // dockerVolumeIdが指定されていればそれを使用（DB値優先）
  if (dockerVolumeId) {
    return dockerVolumeId;
  }
  // projectNameが指定されていれば新命名規則で生成
  if (projectName) {
    return generateUniqueVolumeName('repo', projectName, [], projectId);
  }
  // フォールバック（後方互換）
  return `claude-repo-${projectId}`;
}
```

### 2. GitWorktreeOptions の拡張

```typescript
// 既存のGitWorktreeOptionsにdockerVolumeIdを追加
interface GitWorktreeOptions {
  projectId: string;
  sessionName: string;
  branchName: string;
  sourceBranch?: string;
  dockerVolumeId?: string | null;  // 追加
}
```

### 3. 各メソッドの修正パターン

`getVolumeName()` を使う8メソッドすべてに `dockerVolumeId` を渡す。

**パターンA: GitWorktreeOptions経由（createWorktreeのみ）**

```typescript
async createWorktree(options: GitWorktreeOptions): Promise<GitOperationResult> {
  const { projectId, sessionName, branchName, dockerVolumeId } = options;
  const volumeName = this.getVolumeName(projectId, dockerVolumeId);
  // ...
}
```

**パターンB: メソッド引数追加（その他7メソッド）**

各メソッドに `dockerVolumeId?: string | null` パラメータを追加:
- `deleteWorktree(projectId, sessionName, dockerVolumeId?)`
- `getDiffDetails(projectId, sessionName, dockerVolumeId?)`
- `rebaseFromMain(projectId, sessionName, dockerVolumeId?)`
- `squashMerge(projectId, sessionName, commitMessage, dockerVolumeId?)`
- `getCommits(projectId, sessionName, dockerVolumeId?)`
- `reset(projectId, sessionName, commitHash, dockerVolumeId?)`
- `deleteRepository(projectId, dockerVolumeId?)`

### 4. 呼び出し元の修正

セッション作成API等から `DockerGitService` のメソッドを呼ぶ際に、DBから取得した `project.docker_volume_id` を渡す。

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/services/docker-git-service.ts` | `getVolumeName()` シグネチャ変更、8メソッドの引数追加 |
| `src/types/` または該当型定義 | `GitWorktreeOptions` に `dockerVolumeId` 追加 |
| `src/app/api/projects/[project_id]/sessions/route.ts` | `createWorktree()` に `dockerVolumeId` を渡す |
| Git操作を呼ぶ他のAPI | `dockerVolumeId` を渡すよう修正 |

## テスト方針

- `getVolumeName()` の3パターン（dockerVolumeId指定、projectName指定、フォールバック）をユニットテスト
- `createWorktree()` でdockerVolumeIdが正しくBindsに使用されることを検証
