# TASK-004: HostAdapterテスト作成

> **サブエージェント実行指示**

---

## あなたのタスク

**HostAdapterテスト作成** を実装してください。

### 実装の目標

HostAdapterのリファクタリング(ClaudePTYManager依存削除、BasePTYAdapter継承)に対するテストを作成する。TDD方式でテスト先行。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 変更 | `src/services/adapters/__tests__/host-adapter.test.ts` | HostAdapterテスト追加 |

---

## 技術的コンテキスト

### 参照すべきファイル
- `@src/services/adapters/host-adapter.ts` - 既存実装
- `@docs/sdd/design/components/host-adapter.md` - 設計書
- `@docs/sdd/requirements/stories/US-001.md` - Circular delegation解消

---

## 受入基準

- [ ] createSession(Claude Codeモード)でBasePTYAdapter.spawnPTY()が呼び出されることをテスト
- [ ] createSession(Claude Codeモード)でClaudePTYManagerが呼び出されないことをテスト
- [ ] createSession(shellMode)で既存ロジックが維持されることをテスト
- [ ] destroySession(Claude Codeモード)でBasePTYAdapter.cleanupPTY()が呼び出されることをテスト
- [ ] cols/rowsがpty.spawn()に正しく渡されることをテスト
- [ ] テスト実行で失敗確認(実装前)
- [ ] コミット: `test: HostAdapterリファクタリングテスト追加 [TASK-004]`

---

## 推定工数
40分

## ステータス

`DONE`

**完了サマリー**: host-adapter.test.ts(8テスト)を実装。Claude CodeモードでのspawnPTY呼び出し、ClaudePTYManager非依存、shellModeロジック維持、cols/rows伝播を検証。コミット12072caでTASK-005と同時に完了。
