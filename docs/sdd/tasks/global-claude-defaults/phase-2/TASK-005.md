# TASK-005: セッション作成API: worktree手動作成を削除

## 概要

セッション作成APIからアプリ側のworktree手動作成ロジックを削除し、常にClaude Code --worktreeモードを使用するように変更する。

## 依存: TASK-003

## 対象ファイル

- `src/app/api/projects/[project_id]/sessions/route.ts` - 変更
- `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts` - 変更

## 変更内容

### 削除するコード

1. `useClaudeWorktree`判定ロジック (L269-273)
2. worktree手動作成の分岐全体 (L278-343)
   - Host環境: `GitService.createWorktree()` 呼び出し
   - Docker環境: `DockerGitService.createWorktree()` 呼び出し

### 変更後のロジック

```typescript
// worktreeは常にClaude Code管理
// 設定解決はPTYSessionManagerで行うため、ここではworktree_pathとbranch_nameのみ設定
let worktreePath: string;
if (project.clone_location === 'docker') {
  worktreePath = '/repo';
} else {
  worktreePath = project.path;
}
const branchName = '';

logger.info('Session will use Claude Code --worktree mode', {
  project_id,
  sessionName: sessionDisplayName,
});
```

### インポートの削除

```typescript
// 不要になるインポート
- import { GitService } from '@/services/git-service';
// ClaudeOptionsService は他の箇所で使用しているため残す
```

## TDD手順

### 1. テスト更新

```typescript
// worktree作成のモックを削除し、常にClaude Code管理を前提としたテストに更新

it('should create session with Claude Code --worktree mode', async () => {
  // ...
  expect(newSession.branch_name).toBe('');
  expect(newSession.worktree_path).toBe(project.path); // or '/repo' for docker
});

// GitService.createWorktree のモック呼び出しを検証するテストを削除
```

### 2. 実装

- worktree手動作成の分岐を削除
- 常にworktree_path=プロジェクトパス、branch_name=''を設定
- GitServiceのインポートを削除（他で使用していない場合）

## 受入条件

- [ ] セッション作成時にworktreeが手動作成されない
- [ ] worktree_pathがプロジェクトパスに設定される（Docker: /repo、Host: project.path）
- [ ] branch_nameが空文字列に設定される
- [ ] GitService.createWorktree()が呼ばれない
- [ ] DockerGitService.createWorktree()が呼ばれない
- [ ] テストが全て通過する
