# TASK-015: docker-compose.ymlにproxyサービスとinternalネットワーク追加

## 説明

docker-compose.ymlにnetwork-filter-proxyサービスとclaudework-filter internalネットワークを追加する。

- **対象ファイルパス**:
  - 実装: `docker-compose.yml`（修正）
  - ドキュメント: `docs/ENV_VARS.md`（環境変数追記）
- **参照設計**: `docs/sdd/design/network-filtering/components/docker-compose-proxy.md`

## 技術的文脈

- Docker Compose v2
- 既存サービス: `app`（ClaudeWork本体）
- 追加サービス: `network-filter-proxy`
- 追加ネットワーク: `claudework-filter`（internal）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | イメージ名、ネットワーク構成、環境変数は設計書で確定 |
| 不明/要確認の情報 | なし |

## 実装内容

### 追加サービス

```yaml
services:
  network-filter-proxy:
    image: ghcr.io/windschord/network-filter-proxy:latest
    container_name: claudework-filter-proxy
    networks:
      - default
      - claudework-filter
    environment:
      - API_BIND_ADDR=0.0.0.0
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

### 既存サービス (app) の変更

```yaml
services:
  app:
    # 追加する環境変数
    environment:
      - PROXY_API_URL=http://network-filter-proxy:8080
      - PROXY_NETWORK_NAME=${PROXY_NETWORK_NAME:-claudework-filter}
    # 追加
    depends_on:
      network-filter-proxy:
        condition: service_healthy
```

### 追加ネットワーク

```yaml
networks:
  claudework-filter:
    internal: true
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24
```

### docs/ENV_VARS.mdへの追記

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| PROXY_API_URL | http://network-filter-proxy:8080 | network-filter-proxy Management APIのURL |
| PROXY_NETWORK_NAME | claudework-filter | Claudeコンテナを接続するinternalネットワーク名 |
| FILTER_LOG_LEVEL | info | network-filter-proxyのログレベル |

## 実装手順

1. `docker-compose.yml` に `network-filter-proxy` サービス追加
2. `docker-compose.yml` に `claudework-filter` ネットワーク追加
3. 既存 `app` サービスに環境変数と `depends_on` 追加
4. `docs/ENV_VARS.md` に新規環境変数を追記
5. コミット

## 受入基準

- [x] `docker-compose.yml` に `network-filter-proxy` サービスが定義されている
- [x] `claudework-filter` ネットワークが `internal: true` で定義されている
- [x] `network-filter-proxy` が `default` と `claudework-filter` の両方のネットワークに接続されている
- [x] `app` サービスに `PROXY_API_URL` と `PROXY_NETWORK_NAME` 環境変数が追加されている
- [x] `app` サービスに `depends_on` が追加されている
- [x] `docs/ENV_VARS.md` に新規環境変数が記載されている
- [x] `docker compose config` でバリデーションが通る（Docker環境がある場合）

## 依存関係

なし（最初に着手可能）

## 推定工数

20分

## ステータス

`DONE`

## 完了サマリー

docker-compose.yml に network-filter-proxy サービスと claudework-filter internal ネットワークを追加し、app サービスに依存関係と環境変数を設定した。docs/ENV_VARS.md に3つの新規環境変数を追記した。
