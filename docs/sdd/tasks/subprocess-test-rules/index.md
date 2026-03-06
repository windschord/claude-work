# タスク: subprocess テスト検証規則の整備 (Issue #111)

## 概要

subprocess の cwd/env をテストで検証する規則を整備し、CWDに依存するバグの再発を防止する。

## 関連ドキュメント

- 要件定義: [index](../../requirements/subprocess-test-rules/index.md) @../../requirements/subprocess-test-rules/index.md
- 設計: [index](../../design/subprocess-test-rules/index.md) @../../design/subprocess-test-rules/index.md

## タスク一覧

| ID | タイトル | ステータス | 依存 | 工数 | リンク |
|----|---------|-----------|------|------|--------|
| TASK-001 | CLAUDE.mdにプロセス実行テスト規則を追記 | TODO | なし | 10min | [詳細](TASK-001.md) @TASK-001.md |
| TASK-002 | cli.tsのspawnSync呼び出しテストを追加 | TODO | なし | 30min | [詳細](TASK-002.md) @TASK-002.md |

## 並列実行グループ

### グループA（並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | CLAUDE.md | なし |
| TASK-002 | src/bin/__tests__/cli.test.ts, src/bin/cli.ts | なし |

TASK-001とTASK-002は対象ファイルが異なるため並列実行可能。

## 進捗サマリ

- 合計: 2タスク
- TODO: 2
- IN_PROGRESS: 0
- DONE: 0
