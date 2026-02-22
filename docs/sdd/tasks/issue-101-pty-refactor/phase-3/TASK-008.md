# TASK-008: ClaudePTYManager削除

> **サブエージェント実行指示**

---

## あなたのタスク

**ClaudePTYManager削除** を実装してください。

### 実装の目標

ClaudePTYManagerファイルを削除し、依存している箇所(HostAdapterのimport)がないことを確認する。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 削除 | `src/services/claude-pty-manager.ts` | ClaudePTYManager削除 |

---

## 受入基準

- [x] `src/services/claude-pty-manager.ts` が削除されている
- [x] HostAdapterに`import { claudePtyManager }`が存在しないことを確認
- [x] `npm test` で全テスト通過
- [x] `npm run typecheck` でエラー0件
- [x] コミット: `refactor: ClaudePTYManager削除 [TASK-008]`

---

## 実装手順

1. `src/services/claude-pty-manager.ts` を削除
2. 依存箇所の確認: `grep -r "claude-pty-manager" src/`
3. テスト実行: `npm test`
4. コミット

---

## 推定工数
20分

## ステータス

`DONE`

**完了サマリー**: claude-pty-manager.ts(352行)を削除。全ての参照箇所(import, 呼び出し)を除去。機能はBasePTYAdapterに移行済み。コミット400929f。
