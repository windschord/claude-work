# TASK-008: docker-git-service.ts: worktreeメソッド削除

## 概要

docker-git-service.tsからworktree作成/削除関連メソッドを削除する。

## 依存: TASK-005, TASK-006

## 対象ファイル

- `src/services/docker-git-service.ts` - 変更
- `src/services/__tests__/docker-git-service.test.ts` - 変更

## 削除するメソッド

| メソッド | 理由 |
|---------|------|
| `createWorktree()` | Claude Code --worktreeに移行 |
| `deleteWorktree()` | アプリ側の削除不要 |

## 残存するメソッド

| メソッド | 理由 |
|---------|------|
| `createVolume()` | プロジェクト作成時に使用 |
| `deleteVolume()` | プロジェクト削除時に使用 |
| `cloneRepository()` | プロジェクトクローン時に使用 |
| `pullRepository()` | git pull機能で使用 |
| `getBranches()` | ブランチ一覧取得で使用 |
| その他Git操作 | 変更なし |

## テスト更新

- `createWorktree`関連のテストケースを全て削除
- `deleteWorktree`関連のテストケースを全て削除
- 残存メソッドのテストは変更なし

## 受入条件

- [ ] createWorktree()が削除されている
- [ ] deleteWorktree()が削除されている
- [ ] 残存メソッド（createVolume, cloneRepository等）が動作する
- [ ] テストが全て通過する
