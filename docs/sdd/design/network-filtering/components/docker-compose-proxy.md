# Docker Compose Proxy構成

## 概要

**目的**: network-filter-proxyをDocker Composeサービスとして統合し、Claudeコンテナのネットワーク分離を実現する

**責務**:
- network-filter-proxyサービスの定義
- internalネットワークの定義
- ClaudeWorkアプリからproxy APIへのアクセス経路確保
- Claudeコンテナからproxyへのルーティング

## 情報の明確性

### 明示された情報
- [x] ghcr.io/windschord/network-filter-proxy:v0.1.0-rc.2 プレビルドイメージを使用
- [x] Docker internalネットワークでClaudeコンテナの直接egressを防止
- [x] API_BIND_ADDR環境変数でManagement APIを0.0.0.0バインド

---

## ネットワーク構成

### 全体アーキテクチャ

```text
                                     Internet
                                        |
                    ┌───────────────────┼───────────────────────┐
                    │ Docker Host       |                       │
                    │                   |                       │
                    │   ┌───────────────┼──── default network ──┤
                    │   │               |                       │
                    │   │    ┌──────────┴──────────┐            │
                    │   │    │ network-filter-proxy │            │
                    │   │    │  :3128 (proxy)       │            │
                    │   │    │  :8080 (mgmt API)    │            │
                    │   │    └──────────┬──────────┘            │
                    │   │               │                       │
                    │   │    ┌── claudework-filter (internal) ──┤
                    │   │    │          │                       │
                    │   │    │   ┌──────┴──────┐               │
                    │   │    │   │   Claude    │               │
                    │   │    │   │  Container  │               │
                    │   │    │   │ HTTP_PROXY= │               │
                    │   │    │   │ proxy:3128  │               │
                    │   │    │   └─────────────┘               │
                    │   │    │                                  │
                    │   │    └──────────────────────────────────┤
                    │   │                                       │
                    │   │    ┌─────────────┐                    │
                    │   │    │ ClaudeWork  │                    │
                    │   │    │   (app)     │                    │
                    │   │    │ :3000       │                    │
                    │   │    └─────────────┘                    │
                    │   │                                       │
                    │   └───────────────────────────────────────┤
                    │                                           │
                    └───────────────────────────────────────────┘
```

### ネットワーク定義

| ネットワーク | タイプ | 接続サービス | 目的 |
|-------------|--------|-------------|------|
| default | bridge | app, network-filter-proxy | ClaudeWorkとproxy間のAPI通信、外部通信 |
| claudework-filter | internal | network-filter-proxy, (Claudeコンテナ) | Claudeコンテナとproxy間のプロキシ通信。externalアクセス不可 |

### 通信フロー

| 送信元 | 宛先 | ネットワーク | プロトコル | 目的 |
|--------|------|-------------|-----------|------|
| app | proxy:8080 | default | HTTP | Management API（ルール管理） |
| Claude | proxy:3128 | claudework-filter | HTTP CONNECT | フィルタ済み外部通信 |
| proxy | Internet | default | HTTPS | 許可された通信の転送 |

## docker-compose.yml 変更設計

### 追加サービス: network-filter-proxy

```yaml
services:
  network-filter-proxy:
    image: ghcr.io/windschord/network-filter-proxy:latest
    container_name: claudework-filter-proxy
    networks:
      - default
      - claudework-filter
    environment:
      - API_BIND_ADDR=0.0.0.0    # Docker network経由でアクセス可能にする
      - LOG_LEVEL=${FILTER_LOG_LEVEL:-info}
      - LOG_FORMAT=json
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "/filter-proxy", "healthcheck"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### 追加ネットワーク: claudework-filter

```yaml
networks:
  claudework-filter:
    internal: true
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24
```

### 既存サービス (app) の変更

```yaml
services:
  app:
    # ... 既存設定 ...
    environment:
      # 追加
      - PROXY_API_URL=http://network-filter-proxy:8080
      - PROXY_NETWORK_NAME=claudework-filter
    depends_on:
      network-filter-proxy:
        condition: service_healthy
```

## DockerAdapter への影響

### コンテナ作成時の変更

フィルタリングが有効な環境でコンテナを作成する際、以下を追加:

1. **ネットワーク設定**: claudework-filterネットワークに接続
2. **環境変数**: `HTTP_PROXY`, `HTTPS_PROXY` を設定
3. **defaultネットワークからの切断**: 直接egressを防止

```typescript
// buildContainerOptionsの変更（概要）
if (filterEnabled) {
  createOptions.HostConfig.NetworkMode = 'claudework-filter';
  Env.push(`HTTP_PROXY=http://network-filter-proxy:3128`);
  Env.push(`HTTPS_PROXY=http://network-filter-proxy:3128`);
  // NO_PROXYは設定しない（全通信をproxy経由にする）
}
```

### コンテナ起動後のルール同期

```text
DockerAdapter.createSession()
  |
  +-- buildContainerOptions()    // ネットワーク・プロキシ設定追加
  |
  +-- docker.createContainer()
  |
  +-- container.start()
  |
  +-- [フィルタリング有効の場合]
  |     |
  |     +-- container.inspect()  // コンテナIPアドレスを取得
  |     |
  |     +-- proxyClient.syncRules(containerIP, environmentId)
  |
  +-- PTY接続開始
```

### コンテナ停止時のクリーンアップ

```text
DockerAdapter.stopSession() / container exit
  |
  +-- [フィルタリング有効の場合]
  |     |
  |     +-- proxyClient.deleteRules(containerIP)
  |
  +-- コンテナ削除（AutoRemove: true）
```

## 環境変数

### ClaudeWork (app) に追加

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| PROXY_API_URL | `http://network-filter-proxy:8080` | proxy Management APIのURL |
| PROXY_NETWORK_NAME | `claudework-filter` | Claudeコンテナを接続するinternalネットワーク名 |

### network-filter-proxy

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| API_BIND_ADDR | `0.0.0.0` | Management APIのバインドアドレス（upstream変更要） |
| LOG_LEVEL | `info` | ログレベル |
| LOG_FORMAT | `json` | ログフォーマット |

## フィルタリング無効時の動作

フィルタリングが無効な環境では:
- コンテナはdefaultネットワークに接続（現行動作と同じ）
- HTTP_PROXY/HTTPS_PROXYは設定しない
- proxyへのルール同期は行わない

## セキュリティ考慮事項

- **internalネットワーク**: Claudeコンテナからの直接外部通信を物理的に防止
- **proxy経由のみ**: HTTP_PROXY設定により全通信がproxy経由
- **CapDrop ALL**: 既存のセキュリティ設定（Claudeコンテナの全ケーパビリティ除去）は維持
- **Management API（既知のセキュリティ制約）**: proxyはdefaultとclaudework-filterの両方に接続しているため、Claudeコンテナからもproxyの8080ポートに到達可能。ClaudeコンテナがManagement API経由で自身の許可リストを拡張できる（`PUT /api/v1/rules/{selfIP}`）。この問題はフィルタリング機構のバイパスにつながるため、以下のいずれかで対策が必要:
  1. upstream側でManagement APIのバインドアドレスをdefaultネットワークのIPに限定する
  2. upstream側でManagement APIにトークン認証を追加する
  3. proxyコンテナ内のiptablesでclaudework-filterからの8080アクセスをブロックする
  - 対応Issue: upstream側の対策を起票予定。対策完了まではClaudeコンテナがManagement APIにアクセス可能な状態で運用する

### proxyバイパス防止

| 脅威 | 対策 |
|------|------|
| HTTP_PROXY環境変数の上書き | CapDrop ALLで環境変数操作は防げないが、internalネットワークにより直接egress不可 |
| DNS直接クエリ | internalネットワークのため外部DNSに到達不可 |
| IPアドレス直接指定 | internalネットワークのため直接egress不可。proxy経由でもIPベースのルールで制御可能 |
| proxyの3128ポート以外での通信 | internalネットワークではproxy以外の外部ホストに到達不可 |
| Management API経由のルール変更 | **未対策（既知の制約）**: Claudeコンテナからproxy:8080に到達可能。upstream側の対策が必要 |

## テスト観点

- [ ] 正常系: proxyサービスが正常起動しヘルスチェックが通る
- [ ] 正常系: Claudeコンテナがproxy経由で許可ドメインに通信できる
- [ ] 正常系: フィルタリング無効時はdefaultネットワークで直接通信できる
- [ ] 異常系: internalネットワークのClaudeコンテナから直接外部通信ができない
- [ ] 異常系: ルール未設定のドメインへの通信が403で拒否される
- [ ] 異常系: proxyダウン時にコンテナ起動が失敗する（depends_on健全性チェック）

## 関連要件

- [US-002](../../requirements/network-filtering/stories/US-002.md) @../../requirements/network-filtering/stories/US-002.md: コンテナ起動時のフィルタリング自動適用
- [US-005](../../requirements/network-filtering/stories/US-005.md) @../../requirements/network-filtering/stories/US-005.md: Docker Compose環境でのフィルタリング対応
