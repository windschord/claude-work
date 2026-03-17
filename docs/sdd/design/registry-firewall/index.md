# 設計書: Registry Firewall統合

## アーキテクチャ概要

registry-firewallをDocker Compose構成にサイドカーサービスとして追加し、Docker実行環境のコンテナがパッケージインストール時にregistry-firewall経由でレジストリにアクセスする構成。

```
+------------------+     +----------------------+     +-------------------+
|  ClaudeWork App  |---->| registry-firewall    |---->| PyPI/npm/Go/etc.  |
|  (API proxy)     |     | (pkg filtering)      |     | (upstream)        |
+------------------+     +----------------------+     +-------------------+
                                ^
+------------------+            |
|  Claude Container|------------+  (pkg install via registry-firewall)
|  (sandbox)       |----+
+------------------+    |
                        v
               +---------------------+
               | network-filter-proxy|  (domain-level filtering, unchanged)
               +---------------------+
```

### 既存アーキテクチャとの関係

| レイヤー | コンポーネント | 役割 |
|----------|--------------|------|
| ネットワークレベル | network-filter-proxy | ドメインベースのホワイトリスト(HTTP/HTTPS) |
| パッケージレベル | registry-firewall | パッケージの脆弱性チェック(OSV/OpenSSF) |

両プロキシは共存し、それぞれ異なるレベルでセキュリティを提供する。

## コンポーネント一覧

| コンポーネント | 説明 | 詳細リンク |
|---------------|------|------------|
| Docker Compose構成 | registry-firewallサービス定義 | [詳細](components/docker-compose.md) @components/docker-compose.md |
| DockerAdapter拡張 | コンテナへのレジストリプロキシ設定注入 | [詳細](components/docker-adapter.md) @components/docker-adapter.md |
| Registry Firewall Client | registry-firewall APIとの通信 | [詳細](components/registry-firewall-client.md) @components/registry-firewall-client.md |

## API一覧

| エンドポイント | 説明 | 詳細リンク |
|--------------|------|------------|
| Registry Firewall API | ヘルス・ブロックログ・UIプロキシ | [詳細](api/registry-firewall.md) @api/registry-firewall.md |
| Settings Config拡張 | グローバル設定への registry_firewall_enabled 追加 | [詳細](api/settings-config.md) @api/settings-config.md |

## 要件トレーサビリティ

| 要件ID | 設計要素 | 対応方法 |
|--------|---------|---------|
| REQ-001 | Docker Compose構成 | docker-compose.ymlにregistry-firewallサービス追加 |
| REQ-002 | Docker Compose構成 | configs/registry-firewall.yamlを作成、volumeマウント |
| REQ-003 | Docker Compose構成 | claudework-filterネットワークに接続 |
| REQ-004 | DockerAdapter拡張 | buildContainerOptionsで環境変数/スクリプト注入 |
| REQ-005 | DockerAdapter拡張 | npm/pip/go/cargo/dockerの設定注入 |
| REQ-006 | DockerAdapter拡張 | filterEnabledとregistryFirewallEnabledの独立制御 |
| REQ-007 | Settings Config拡張 | AppConfigにregistry_firewall_enabled追加 |
| REQ-008 | Registry Firewall API | GET /api/registry-firewall/health |
| REQ-009 | Registry Firewall API | registry-firewall UIへのリバースプロキシ |
| REQ-010 | Registry Firewall API | GET /api/registry-firewall/blocks |
| NFR-SEC-001 | Registry Firewall Client | APIトークンをサーバー側で管理 |
| NFR-SEC-002 | DockerAdapter拡張 | コンテナにはレジストリURLのみ注入(トークン不可) |
| NFR-SEC-003 | DockerAdapter拡張 | 環境変数はURL情報のみ |
| NFR-AVA-001 | DockerAdapter拡張 | registry-firewall停止時もコンテナ起動可能 |
| NFR-AVA-002 | Registry Firewall Client | ヘルスチェック2秒タイムアウト |
