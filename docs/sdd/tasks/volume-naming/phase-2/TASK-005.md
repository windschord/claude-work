# TASK-005: DockerGitService新命名規則の適用とclone API更新

## 説明

DockerGitServiceのgetVolumeName()を新命名規則に変更し、clone APIを更新する。後方互換性を維持する。

- 対象ファイル:
  - `src/services/docker-git-service.ts` (既存修正)
  - `src/services/__tests__/docker-git-service.test.ts` (既存修正)
  - `src/app/api/projects/clone/route.ts` (既存修正)
- 設計書: `docs/sdd/design/volume-naming/index.md`

## 技術的文脈

- 現在: `getVolumeName(projectId)` → `claude-repo-${projectId}`
- 変更後: `getVolumeName(projectId)` → `generateVolumeName('repo', projectName)` + 重複チェック
- clone API: Volume名生成をDockerGitServiceに委譲（プロジェクト名を渡す）
- 後方互換性: 既存の `docker_volume_id` が設定されていればそれを優先

## 実装手順（TDD）

### 1. テスト作成

```typescript
describe('DockerGitService - new volume naming', () => {
  it('プロジェクト名からcw-repo-{slug}形式のVolume名を生成', () => {});
  it('既存docker_volume_idが設定されていればそれを使用', () => {});
  it('重複するVolume名の場合サフィックスを追加', () => {});
});
```

### 2. テスト実行: 失敗を確認

### 3. テストコミット

### 4. 実装
- `docker-git-service.ts`:
  - `getVolumeName()` を更新: `generateVolumeName('repo', projectName)` を使用
  - `createVolume()` に重複チェック追加（`listVolumes()`で既存Volume確認）
- `clone/route.ts`:
  - プロジェクト名をDockerGitServiceに渡す

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] 新規プロジェクトのVolume名が `cw-repo-{slug}` 形式
- [ ] 既存の `docker_volume_id` があれば後方互換で維持
- [ ] テストが通過する
- [ ] 既存テストが壊れていない

## 依存関係

TASK-001（generateVolumeName, generateUniqueVolumeName関数を使用）

## 推定工数

30分

## ステータス

TODO
