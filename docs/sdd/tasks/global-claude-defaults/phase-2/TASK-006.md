# TASK-006: セッション削除API: worktree手動削除を削除

## 概要

セッション削除APIからアプリ側のworktree手動削除ロジックを削除する。

## 依存: TASK-005

## 対象ファイル

- `src/app/api/sessions/[id]/route.ts` - 変更
- `src/app/api/sessions/[id]/__tests__/route.test.ts` - 変更

## 変更内容

### 削除するコード (L133-163)

```typescript
// --worktreeモード判定: branch_nameが空の場合はClaude Codeがworktreeを管理している
const useClaudeWorktree = targetSession.branch_name === '';

if (useClaudeWorktree) {
  logger.info('Skipping worktree deletion (managed by Claude Code --worktree)', ...);
} else {
  // Remove worktree
  try {
    const sessionName = targetSession.worktree_path.split('/').pop() || '';
    if (targetSession.project.clone_location === 'docker') {
      // DockerGitService.deleteWorktree()
    } else {
      // GitService.deleteWorktree()
    }
  } catch (error) {
    // ...
  }
}
```

### 変更後

```typescript
// worktree削除は不要（Claude Codeが管理）
logger.info('Session deletion - worktree managed by Claude Code', {
  session_id: targetSession.id,
});
```

### インポートの削除

```typescript
- import { GitService } from '@/services/git-service';
- import { DockerGitService } from '@/services/docker-git-service';
```

## 受入条件

- [ ] セッション削除時にworktreeが手動削除されない
- [ ] GitService.deleteWorktree()が呼ばれない
- [ ] DockerGitService.deleteWorktree()が呼ばれない
- [ ] DBレコードは正常に削除される
- [ ] テストが全て通過する
