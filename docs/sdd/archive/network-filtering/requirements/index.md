# Docker環境ネットワークフィルタリング - 要件定義

## 概要

Claude Codeを`--dangerously-skip-permissions`で実行する際のセキュリティ対策として、Dockerコンテナからの外部ネットワーク通信をホワイトリスト方式でフィルタリングする機能。Docker単体およびDocker Compose環境の両方に対応する。

## 背景

- `--dangerously-skip-permissions`モードではClaude Codeが自由にコマンドを実行可能
- 意図しない外部通信（データ漏洩、悪意あるダウンロード等）を防止する必要がある
- Claude API、npm registry、GitHub等の必要な通信先のみ許可する形が望ましい
- ClaudeWorkはDocker Compose環境でも運用されるため、Compose管理下のネットワークにも対応が必要

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | ネットワークフィルタリングルールの設定管理 | 高 | 作成中 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | コンテナ起動時のフィルタリング自動適用 | 高 | 作成中 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | デフォルトルールテンプレートの提供 | 中 | 作成中 | [詳細](stories/US-003.md) @stories/US-003.md |
| US-004 | フィルタリング状態の確認・モニタリング | 中 | 作成中 | [詳細](stories/US-004.md) @stories/US-004.md |
| US-005 | Docker Compose環境でのフィルタリング対応 | 高 | 作成中 | [詳細](stories/US-005.md) @stories/US-005.md |
| US-006 | Docker環境作成時のデフォルトルール自動適用 | 中 | 計画中 | [詳細](stories/US-006.md) @stories/US-006.md |
| US-007 | proxy方式によるネットワークフィルタリング | 高 | 計画中 | 別ブランチで仕様策定中（iptables方式の代替） |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001 | ホワイトリストルールのCRUD | US-001 | 定義済 |
| REQ-002 | ワイルドカードパターンマッチング | US-001 | 定義済 |
| REQ-003 | 環境ごとの個別ルール管理 | US-001 | 定義済 |
| REQ-004 | コンテナ起動時のルール自動適用 | US-002 | US-007/proxy方式で再実装予定（iptables方式の適用ロジックは削除済み） |
| REQ-005 | ~~Dockerカスタムネットワーク + iptablesによる通信制御~~ | US-002 | **廃止**（iptables方式廃止。US-007/proxy方式で再設計予定） |
| REQ-006 | デフォルトルールテンプレート | US-003 | 定義済 |
| REQ-007 | 適用中ルールの表示・通信状態確認 | US-004 | 定義済 |
| REQ-008 | Docker Composeネットワーク統合 | US-005 | 定義済 |
| REQ-009 | Docker環境作成時のデフォルトルール自動適用 | US-006 | 定義済 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| セキュリティ要件 | [詳細](nfr/security.md) @nfr/security.md | 4件 |
| ユーザビリティ要件 | [詳細](nfr/usability.md) @nfr/usability.md | 3件 |
| 保守性要件 | [詳細](nfr/maintainability.md) @nfr/maintainability.md | 3件 |

## 依存関係

- Docker Engine API（ネットワーク作成・管理）
- 既存のExecutionEnvironmentスキーマ・サービス
- 既存のDockerAdapter（コンテナ起動フロー）
- Docker Compose（ネットワーク設定統合）
- ~~iptablesコマンド（ホスト側で実行可能であること）~~ 廃止 - proxy方式ではproxyコンテナが通信制御を担当

## スコープ外

- HOST環境（非Docker）のネットワーク制御
- SSH環境のネットワーク制御
- L7プロトコル（HTTP/HTTPS）レベルのコンテンツインスペクション
- VPN/トンネル経由の通信の検出・制御
- コンテナ間通信（東西トラフィック）の制御
