# 要件定義 - サイドカーChrome DevTools MCP環境

## 概要

claude-workのDockerセッションにおいて、セッション単位で独立したChrome（サイドカーコンテナ）を自動起動し、Chrome DevTools MCPを通じてClaude Codeからブラウザ操作を可能にする機能。PR#186の単一コンテナ方式（Chromiumを同梱した拡張イメージ）と共存し、環境設定で切り替え可能にする。

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | サイドカーChromeの自動起動・接続 | 高 | 承認済 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | サイドカーChromeのライフサイクル管理 | 高 | 承認済 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | 環境設定でのサイドカー構成 | 中 | 承認済 | [詳細](stories/US-003.md) @stories/US-003.md |
| US-004 | ブラウザデバッグアクセス | 低 | 承認済 | [詳細](stories/US-004.md) @stories/US-004.md |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001-001 | セッション作成時にChromeサイドカーコンテナを自動起動 | US-001 | 定義済 |
| REQ-001-002 | Docker内部ネットワークでClaude-Chrome間を接続 | US-001 | 定義済 |
| REQ-001-003 | MCP設定（--browserUrl）を動的生成・注入 | US-001 | 定義済 |
| REQ-001-004 | Chrome Ready Check後にClaude起動 | US-001 | 定義済 |
| REQ-002-001 | セッション破棄時にChromeコンテナ・ネットワークを削除 | US-002 | 定義済 |
| REQ-002-002 | 孤立Chromeコンテナの自動クリーンアップ | US-002 | 定義済 |
| REQ-002-003 | SessionテーブルにChrome関連カラムを追加 | US-002 | 定義済 |
| REQ-003-001 | Environment.configでサイドカー有効/無効を切り替え | US-003 | 定義済 |
| REQ-003-002 | Chromeイメージ名・タグのカスタマイズ | US-003 | 定義済 |
| REQ-003-003 | PR#186の単一コンテナ方式をデフォルトとして維持 | US-003 | 定義済 |
| REQ-004-001 | Chromeデバッグポートをホストに動的マッピング | US-004 | 定義済 |
| REQ-004-002 | デバッグポート番号をUIで表示 | US-004 | 定義済 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| リソース要件 | [詳細](nfr/resource.md) @nfr/resource.md | 3件 |
| セキュリティ要件 | [詳細](nfr/security.md) @nfr/security.md | 2件 |

## 依存関係

- **PR#186**: docker/extensions/Dockerfile.chrome-devtools（単一コンテナ方式、共存対象）
- **DockerAdapter**: 既存のコンテナライフサイクル管理（src/services/adapters/docker-adapter.ts）
- **EnvironmentService**: 環境CRUD（src/services/environment-service.ts）
- **chrome-devtools-mcp v0.12.1**: `--browserUrl`オプションによる外部Chrome接続
- **Dockerode**: Docker APIクライアント（既存依存）
- **chromium公式イメージ**: chromium/headless-shell等

## スコープ外

- SSH環境でのサイドカー対応
- HOST環境でのサイドカー対応（Docker環境専用）
- 複数セッションでのChrome共有（1セッション=1Chrome）
- Chrome以外のブラウザ対応
- サイドカーChrome上での永続データ（プロファイル）管理

## 技術的決定事項

| 決定 | 内容 | 理由 |
|------|------|------|
| Chrome方式 | PR#186共存（デフォルト=単一コンテナ、オプション=サイドカー） | 既存PRを尊重しつつ上位オプションを提供 |
| Chromeイメージ | chromium公式イメージ（headless-shell等） | ライセンス問題なし、軽量 |
| スコープ | セッション単位（1:1） | 完全なタスク間分離を実現 |
| ネットワーク | セッション単位Dockerブリッジ | ポート競合回避、コンテナ間通信の隔離 |
