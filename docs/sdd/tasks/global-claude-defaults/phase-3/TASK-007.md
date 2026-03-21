# TASK-007: git-service.ts: worktreeメソッド削除

## 概要

git-service.tsからworktree作成/削除関連メソッドを削除する。

## 依存: TASK-005, TASK-006

## 対象ファイル

- `src/services/git-service.ts` - 変更
- `src/services/__tests__/git-service.test.ts` - 変更

## 削除するメソッド

| メソッド | 行数(概算) | 理由 |
|---------|-----------|------|
| `createWorktree()` | ~50行 | Claude Code --worktreeに移行 |
| `deleteWorktree()` | ~40行 | アプリ側の削除不要 |
| `ensureWorktreeDirectoryWritable()` | ~90行 | createWorktreeの依存メソッド |

## 残存するメソッド

| メソッド | 理由 |
|---------|------|
| `validateName()` | getDiff等で使用 |
| `validateWorktreePath()` | getDiff等で使用（worktreeパスの検証） |
| `getDiff()` | 引き続き使用 |
| `getDiffDetails()` | 引き続き使用 |
| `rebaseFromMain()` | 引き続き使用 |
| `getCommits()` | 引き続き使用 |
| `reset()` | 引き続き使用 |
| `squashMerge()` | 引き続き使用 |

## テスト更新

- `createWorktree`関連のテストケースを全て削除
- `deleteWorktree`関連のテストケースを全て削除
- `ensureWorktreeDirectoryWritable`関連のテストケースを全て削除
- 残存メソッドのテストは変更なし

## 受入条件

- [ ] createWorktree()が削除されている
- [ ] deleteWorktree()が削除されている
- [ ] ensureWorktreeDirectoryWritable()が削除されている
- [ ] 残存メソッド（getDiff, getCommits等）が動作する
- [ ] テストが全て通過する
