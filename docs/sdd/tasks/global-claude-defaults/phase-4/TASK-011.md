# TASK-011: ドキュメント更新

## 概要

CLAUDE.mdとENV_VARS.mdを更新し、新機能のドキュメントを追加する。

## 依存: TASK-001 ~ TASK-010

## 対象ファイル

- `CLAUDE.md` - 変更
- `docs/ENV_VARS.md` - 変更（該当する場合）

## 更新内容

### CLAUDE.md

1. **Feature Specification Summary** セクション:
   - API Endpoints: /api/settings/config のclaude_defaults対応を記載
   - DB Schema: ExecutionEnvironment.configのclaude_defaults_override構造を記載

2. **Architecture** セクション:
   - Claude Code設定の解決フロー（4層カスケード）の説明追加
   - worktree管理がClaude Code本体に移行したことの記載

3. **Critical Implementation Details** セクション:
   - Git Worktree Isolation: Claude Code --worktreeモードに移行した旨の更新
   - createWorktree/deleteWorktreeが削除された旨の記載

### docs/ENV_VARS.md

- 新しい環境変数がある場合は追加（本変更では環境変数の追加はないため、変更なしの可能性あり）

## 受入条件

- [ ] CLAUDE.mdが最新の実装に反映されている
- [ ] worktree管理の記述がClaude Code --worktreeモードに更新されている
- [ ] 設定解決フローの説明が追加されている
