# 設計: subprocess テスト検証規則の整備 (Issue #111)

## 概要

subprocessの`cwd`/`env`オプションをテストで検証する規則を整備し、CWDに依存するバグの再発を防止する。

## 要件との対応

| 要件ID | 要件 | 設計要素 |
|--------|------|---------|
| REQ-001 | cwdアサーション必須 | cli.tsテスト追加 |
| REQ-002 | envアサーション必須 | cli.tsテスト追加 |
| REQ-003 | objectContaining()でcwd省略禁止 | テストパターン定義 |
| REQ-004 | CLAUDE.mdにルール追加 | CLAUDE.mdセクション追記 |
| REQ-005 | cwd/envアサーション必須ルール | CLAUDE.mdセクション追記 |
| REQ-006 | NG/OK例記載 | CLAUDE.mdセクション追記 |
| REQ-007 | process.cwd()コメント義務 | CLAUDE.mdセクション追記 |
| REQ-008 | 意図なしprocess.cwd()は指摘対象 | CLAUDE.mdセクション追記 |

## コンポーネント

| コンポーネント | 説明 | リンク |
|--------------|------|--------|
| cli-test | cli.tsのspawnSync呼び出しテスト | [詳細](components/cli-test.md) @components/cli-test.md |
| claude-md-rules | CLAUDE.mdへのルール追記 | [詳細](components/claude-md-rules.md) @components/claude-md-rules.md |

## 技術的決定

| ID | 決定事項 | リンク |
|----|---------|--------|
| DEC-001 | cli.tsテストのモック戦略 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |

## アーキテクチャ

本Issueはコード変更が限定的なため、アーキテクチャ変更はない。変更点は:

1. **テスト追加**: `src/bin/__tests__/cli.test.ts` (新規)
2. **ルール追記**: `CLAUDE.md` (既存ファイル編集)
