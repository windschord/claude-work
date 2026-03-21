# TASK-009: 設定UI: Claude Codeデフォルトセクション追加

## 概要

設定ページ（/settings/app）にClaude Codeデフォルト設定セクションを追加する。

## 依存: TASK-002

## 対象ファイル

- `src/app/settings/app/page.tsx` - 変更（Claude Codeデフォルトセクション追加）

## UI設計

```
[Claude Code デフォルト設定]
--------------------------------------------
パーミッション自動スキップ (Docker環境のみ)
  [トグルスイッチ] 有効
  説明: Docker環境でClaude Code起動時に --dangerously-skip-permissions を付与します。
  警告: HOST環境では常に無効です。

Worktreeモード
  [トグルスイッチ] 有効
  説明: 各セッションがClaude Codeの --worktree オプションで分離されます。
--------------------------------------------
[保存ボタン]
```

## 実装方針

- 既存のAppConfig設定UIパターンに従う
- `/api/settings/config`のGET/PUTを使用
- トグルスイッチはboolean設定に適切なUIパーツを使用
- 既存のgit_clone_timeout_minutes等のセクションと同じスタイル

## 受入条件

- [ ] Claude Codeデフォルト設定セクションが表示される
- [ ] dangerouslySkipPermissionsのトグルが動作する
- [ ] worktreeのトグルが動作する
- [ ] 保存が成功する
- [ ] 保存後にリロードしても値が保持される
