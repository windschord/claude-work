# 要件定義: Registry Firewall統合

## 概要

ClaudeWorkのDocker実行環境において、パッケージレジストリへのアクセスを[registry-firewall](https://github.com/windschord/registry-firewall)経由でフィルタリングし、ソフトウェアサプライチェーン攻撃から開発環境を保護する。

registry-firewallは、OSVやOpenSSF Malicious Packagesデータベースと連携して悪意あるパッケージを自動ブロックする統一レジストリプロキシである。ClaudeWorkの既存ネットワークフィルタリング(domain-level)を補完し、パッケージレベルでのセキュリティを実現する。

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | Docker Compose統合 | 高 | 作成中 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | コンテナからのレジストリプロキシ利用 | 高 | 作成中 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | UI管理画面(有効/無効・ステータス表示) | 中 | 作成中 | [詳細](stories/US-003.md) @stories/US-003.md |
| US-004 | registry-firewall管理UIへのアクセス | 中 | 作成中 | [詳細](stories/US-004.md) @stories/US-004.md |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001 | docker-compose.ymlにregistry-firewallサービスを追加 | US-001 | 定義済 |
| REQ-002 | registry-firewall設定ファイル(config.yaml)の自動生成 | US-001 | 定義済 |
| REQ-003 | claudework-filterネットワークへのregistry-firewall接続 | US-001 | 定義済 |
| REQ-004 | コンテナ起動時にパッケージマネージャーのレジストリURLをregistry-firewallに設定 | US-002 | 定義済 |
| REQ-005 | npm, pip, go, cargo, dockerの各パッケージマネージャーに対応するプロキシ設定注入 | US-002 | 定義済 |
| REQ-006 | 既存network-filter-proxyとregistry-firewallの共存 | US-002 | 定義済 |
| REQ-007 | registry-firewallの有効/無効をグローバルに切り替えるUI | US-003 | 定義済 |
| REQ-008 | registry-firewallのヘルスステータス表示 | US-003 | 定義済 |
| REQ-009 | registry-firewall管理UIへのリンク/プロキシ提供 | US-004 | 定義済 |
| REQ-010 | registry-firewallのブロックログ表示 | US-004 | 定義済 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| セキュリティ要件 | [詳細](nfr/security.md) @nfr/security.md | 3件 |
| 可用性要件 | [詳細](nfr/availability.md) @nfr/availability.md | 2件 |

## 依存関係

- **registry-firewall Docker image**: `ghcr.io/windschord/registry-firewall` (公開予定)
- **registry-firewall npm対応**: [Issue #23](https://github.com/windschord/registry-firewall/issues/23) (対応予定)
- **既存インフラ**: network-filter-proxy, claudework-filterネットワーク
- **ClaudeWork本体**: Docker Compose構成、環境設定API/UI

## スコープ外

- registry-firewall自体のカスタムブロック/許可ルール管理(registry-firewall管理UIに委譲)
- 環境ごとの個別registry-firewall設定(グローバル設定のみ)
- registry-firewallのソースコード変更(npm対応はregistry-firewall側のIssueとして管理)
- OpenTelemetry/Jaeger/Prometheusの統合(registry-firewallの監視スタックは含まない)
