# TASK-004: API呼び出し元のdockerVolumeId伝播修正

## 対応

- Issue #206
- US-001/REQ-001
- 設計: `docs/sdd/design/docker-session-fixes/components/docker-git-service.md`

## 説明

DockerGitServiceのメソッドを呼び出す全APIルートで、DBから取得した `project.docker_volume_id` を各メソッドに渡すよう修正する。

## 対象ファイル

- `src/app/api/projects/[project_id]/sessions/route.ts` - createWorktree
- `src/app/api/sessions/[id]/route.ts` - deleteWorktree
- `src/app/api/sessions/[id]/diff/route.ts` - getDiffDetails
- `src/app/api/sessions/[id]/rebase/route.ts` - rebaseFromMain
- `src/app/api/sessions/[id]/merge/route.ts` - squashMerge
- `src/app/api/sessions/[id]/commits/route.ts` - getCommits
- `src/app/api/sessions/[id]/reset/route.ts` - reset

## 技術的文脈

- 各APIルートは `targetSession.project` からプロジェクト情報を取得しており、`docker_volume_id` にアクセス可能
- セッション作成APIは `project` オブジェクトから直接取得

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 全API呼び出し元でdocker_volume_idを渡す |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

各APIルートのテストに `docker_volume_id` が渡されるケースを追加。
主要なテストは TASK-003 で実装済み（DockerGitService側のテスト）のため、
ここではAPIルートのインテグレーション的な確認を行う。

### 2. 実装

各APIルートの修正パターン:

**セッション作成API (`sessions/route.ts`):**
```typescript
const result = await dockerGitService.createWorktree({
  projectId: project.id,
  sessionName: sessionName,
  branchName: branchName,
  dockerVolumeId: project.docker_volume_id,  // 追加
});
```

**その他のAPI (sessions/[id]/*/route.ts):**
```typescript
// 既存: dockerGitService.getDiffDetails(targetSession.project.id, sessionName)
// 修正: dockerGitService.getDiffDetails(targetSession.project.id, sessionName, targetSession.project.docker_volume_id)
```

修正対象一覧:

| ファイル | メソッド | 追加引数 |
|---------|---------|---------|
| `projects/[project_id]/sessions/route.ts` (行306) | createWorktree | `dockerVolumeId: project.docker_volume_id` |
| `sessions/[id]/route.ts` (行147) | deleteWorktree | `targetSession.project.docker_volume_id` |
| `sessions/[id]/diff/route.ts` (行66) | getDiffDetails | `targetSession.project.docker_volume_id` |
| `sessions/[id]/rebase/route.ts` (行59) | rebaseFromMain | `targetSession.project.docker_volume_id` |
| `sessions/[id]/merge/route.ts` (行98) | squashMerge | `targetSession.project.docker_volume_id` |
| `sessions/[id]/commits/route.ts` (行62) | getCommits | `targetSession.project.docker_volume_id` |
| `sessions/[id]/reset/route.ts` (行71) | reset | `targetSession.project.docker_volume_id` |

### 3. テスト通過確認 → コミット

## 受入基準

- [x] 全7箇所のAPI呼び出しで `docker_volume_id` が渡されている
- [x] 既存テストがすべて通過
- [x] `npx vitest run` で全テスト通過

## 依存関係

TASK-003（DockerGitServiceのシグネチャ変更が必要）

## 推定工数

30分

## ステータス

`DONE`
