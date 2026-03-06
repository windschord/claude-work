# TASK-003: DockerGitService getVolumeName docker_volume_id対応

## 対応

- Issue #206
- US-001/REQ-001, REQ-002, REQ-003
- 設計: `docs/sdd/design/docker-session-fixes/components/docker-git-service.md`

## 説明

`DockerGitService.getVolumeName()` のシグネチャを変更し、`dockerVolumeId` パラメータを追加する。`GitWorktreeOptions` にも `dockerVolumeId` フィールドを追加する。DockerGitService内の全メソッドの引数に `dockerVolumeId` を追加する。

## 対象ファイル

- 型定義: `src/services/git-operations.ts` (GitWorktreeOptions)
- 実装: `src/services/docker-git-service.ts`
- テスト: `src/services/__tests__/docker-git-service.test.ts`

## 技術的文脈

- テスト: Vitest
- 参照: 設計書の修正コード例

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | getVolumeNameにdockerVolumeIdパラメータ追加、GitWorktreeOptions拡張、全メソッドの引数追加 |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

`src/services/__tests__/docker-git-service.test.ts` に以下のテストケースを追加:

```typescript
describe('getVolumeName - dockerVolumeId対応', () => {
  it('dockerVolumeIdが指定された場合、その値を返す', async () => {
    // createWorktree を dockerVolumeId='cw-repo-myproject' で呼び出し
    // runContainer のBindsに 'cw-repo-myproject:/repo' が含まれることを検証
  });

  it('dockerVolumeIdがnullの場合、フォールバック値を返す', async () => {
    // createWorktree を dockerVolumeId=null で呼び出し
    // runContainer のBindsに 'claude-repo-{projectId}:/repo' が含まれることを検証
  });

  it('dockerVolumeIdが未指定の場合、フォールバック値を返す', async () => {
    // createWorktree を dockerVolumeId なしで呼び出し（後方互換）
    // runContainer のBindsに 'claude-repo-{projectId}:/repo' が含まれることを検証
  });
});
```

同様のパターンを `getDiffDetails`, `deleteWorktree` 等のメソッドにも追加。

### 2. テスト実行 → 失敗確認

```bash
npx vitest run src/services/__tests__/docker-git-service.test.ts
```

### 3. テストコミット

### 4. 実装

#### 4.1 GitWorktreeOptions拡張

`src/services/git-operations.ts`:

```typescript
export interface GitWorktreeOptions {
  projectId: string;
  sessionName: string;
  branchName: string;
  dockerVolumeId?: string | null;  // 追加
}
```

#### 4.2 getVolumeName修正

`src/services/docker-git-service.ts` (行62-67):

```typescript
private getVolumeName(projectId: string, dockerVolumeId?: string | null, projectName?: string): string {
  if (dockerVolumeId) {
    return dockerVolumeId;
  }
  if (projectName) {
    return generateUniqueVolumeName('repo', projectName, [], projectId);
  }
  return `claude-repo-${projectId}`;
}
```

#### 4.3 各メソッドの引数追加

以下の8メソッドのシグネチャに `dockerVolumeId?: string | null` を追加し、`getVolumeName()` 呼び出しに渡す:

| メソッド | 現在のシグネチャ | 修正後 |
|---------|----------------|--------|
| createWorktree | `(options: GitWorktreeOptions)` | optionsから取得 |
| deleteWorktree | `(projectId, sessionName)` | `(projectId, sessionName, dockerVolumeId?)` |
| deleteRepository | `(projectId)` | `(projectId, dockerVolumeId?)` |
| getDiffDetails | `(projectId, sessionName)` | `(projectId, sessionName, dockerVolumeId?)` |
| rebaseFromMain | `(projectId, sessionName)` | `(projectId, sessionName, dockerVolumeId?)` |
| squashMerge | `(projectId, sessionName, commitMessage)` | `(projectId, sessionName, commitMessage, dockerVolumeId?)` |
| getCommits | `(projectId, sessionName)` | `(projectId, sessionName, dockerVolumeId?)` |
| reset | `(projectId, sessionName, commitHash)` | `(projectId, sessionName, commitHash, dockerVolumeId?)` |

注意: `createVolume()` はボリューム作成時に使うため変更不要（ここでボリューム名が決まりDBに保存される）。

### 5. テスト通過確認 → 実装コミット

## 受入基準

- [ ] `getVolumeName()` が `dockerVolumeId` パラメータを受け取る
- [ ] `dockerVolumeId` 指定時はその値を返す
- [ ] `dockerVolumeId` がnull/未指定時はフォールバック値を返す
- [ ] `GitWorktreeOptions` に `dockerVolumeId` フィールドが追加されている
- [ ] 全8メソッドが `dockerVolumeId` を受け取り `getVolumeName()` に渡す
- [ ] 既存テストがすべて通過（後方互換）
- [ ] 新規テストが通過

## 依存関係

なし（TASK-004が本タスクに依存）

## 推定工数

40分

## ステータス

`TODO`
