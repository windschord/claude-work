# 要件定義: Issue #101 PTY Architecture Refactor

## 概要

ClaudeWorkのPTY/セッション管理における構造的な問題を根本解決するためのアーキテクチャリファクタリング。

**解決対象の問題:**
1. Circular delegation (PTYSessionManager → HostAdapter → ClaudePTYManager → PTYSessionManager)
2. destroySession無限再帰によるサーバークラッシュ
3. cols/rows伝播の欠落(HOST環境)

**背景:**
過去11個のPR(#40, #41, #44, #49, #77, #85, #87, #91, #92, #93, #101)で同じ問題が再発する"whack-a-mole"パターンが確認されており、一時的な修正ではなく構造的な改善が必要。

**参照ドキュメント:**
- 設計原則: [docs/design-principles-pty-session-management.md](../../design-principles-pty-session-management.md)

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | Circular delegation解消 | 高 | 作成中 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | destroySession無限再帰解消 | 高 | 作成中 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | cols/rows伝播の欠落解消 | 高 | 作成中 | [詳細](stories/US-003.md) @stories/US-003.md |
| US-004 | 共通PTYロジック抽出 | 高 | 作成中 | [詳細](stories/US-004.md) @stories/US-004.md |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001 | HostAdapterがnode-ptyを直接呼び出す | US-001 | 定義済 |
| REQ-002 | base-adapter.ts共通ロジック抽出 | US-004 | 定義済 |
| REQ-003 | DockerAdapterがbase-adapterを利用 | US-004 | 定義済 |
| REQ-004 | ClaudePTYManager削除 | US-001 | 定義済 |
| REQ-005 | cols/rowsをPTY作成時に正しく伝播 | US-003 | 定義済 |
| REQ-006 | destroySessionが無限再帰しない | US-002 | 定義済 |
| REQ-007 | 設計原則(A1-A3, C1-C3)に準拠 | US-001, US-004 | 定義済 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| 保守性要件 | [詳細](nfr/maintainability.md) @nfr/maintainability.md | 4件 |
| 信頼性要件 | [詳細](nfr/reliability.md) @nfr/reliability.md | 3件 |
| 性能要件 | [詳細](nfr/performance.md) @nfr/performance.md | 2件 |

## 依存関係

**外部依存:**
- node-pty: PTYプロセス管理ライブラリ
- Docker: Docker環境でのPTY実行

**内部依存:**
- PTYSessionManager: セッションライフサイクル管理
- ConnectionManager: WebSocket接続プール管理
- ScrollbackBuffer: ターミナル履歴管理

**前提条件:**
- 設計原則ドキュメント(docs/design-principles-pty-session-management.md)が存在すること
- 既存のDOCKER環境PTY機能(Issue #101で修正済み)が正常動作すること

## スコープ外

以下は本リファクタリングのスコープ外とする:

- **WebSocketレイヤーの変更**: claude-ws.ts、terminal-ws.tsは最小限の修正に留める
- **PTYSessionManagerの大幅な変更**: インターフェースは維持し、内部実装のみ改善
- **ConnectionManagerのリファクタリング**: 別タスクとして分離
- **新機能の追加**: 既存機能の改善のみ、新機能は含まない
- **SSH環境のサポート**: HOST/DOCKER環境のみ対象

---

## リンク形式について

詳細ファイルへのリンクは、マークダウン形式と`@`形式の両方を記載してください：
- **マークダウン形式**: `[詳細](stories/US-001.md)` - GitHub等での閲覧用
- **@形式**: `@stories/US-001.md` - Claude Codeがファイルを参照する際に使用

---

## ドキュメント構成

```
docs/sdd-issue-101-pty-refactor/requirements/
├── index.md                     # このファイル（目次）
├── stories/
│   ├── US-001.md               # Circular delegation解消
│   ├── US-002.md               # destroySession無限再帰解消
│   ├── US-003.md               # cols/rows伝播の欠落解消
│   └── US-004.md               # 共通PTYロジック抽出
└── nfr/
    ├── maintainability.md      # 保守性要件
    ├── reliability.md          # 信頼性要件
    └── performance.md          # 性能要件
```

## EARS記法クイックリファレンス

| パターン | 形式 | 使用場面 |
|---------|------|----------|
| 基本形 | システムは[振る舞い]しなければならない | 常時適用される要件 |
| イベント | [イベント]の時、システムは[振る舞い]しなければならない | イベント駆動要件 |
| 条件付き | もし[条件]ならば、システムは[振る舞い]しなければならない | 状態依存要件 |
| 継続的 | [状態]の間、システムは[振る舞い]しなければならない | 継続的要件 |
| 場所 | [場所]において、システムは[振る舞い]しなければならない | コンテキスト固有要件 |
