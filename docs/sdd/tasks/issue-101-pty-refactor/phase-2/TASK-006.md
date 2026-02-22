# TASK-006: DockerAdapterテスト作成

> **サブエージェント実行指示**

---

## あなたのタスク

**DockerAdapterテスト作成** を実装してください。

### 実装の目標

DockerAdapterのリファクタリング(BasePTYAdapter継承、共通ロジック移動)に対するテストを作成する。createExecSessionのcols/rowsハードコード修正もテスト。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 変更 | `src/services/adapters/__tests__/docker-adapter.test.ts` | DockerAdapterテスト追加 |

---

## 受入基準

- [x] createSession(Claude Codeモード)でBasePTYAdapter.spawnPTY()が呼び出されることをテスト
- [x] createExecSession()にcols/rowsが渡されることをテスト
- [x] cols/rowsがハードコードされていないことをテスト
- [x] Docker固有ロジック(ensureContainer)は維持されることをテスト
- [x] テスト実行で失敗確認(実装前)
- [x] コミット: `test: DockerAdapterリファクタリングテスト追加 [TASK-006]`

---

## 推定工数
40分

## ステータス

`DONE`

**完了サマリー**: docker-adapter.test.ts(72テスト)でBasePTYAdapter継承、createSession/createExecSessionのcols/rows伝播、Docker固有ロジック(ensureContainer等)の維持を検証。コミット85e5634でTASK-007と同時に完了。
