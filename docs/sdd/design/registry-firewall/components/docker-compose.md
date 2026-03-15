# コンポーネント設計: Docker Compose構成

## 概要

docker-compose.ymlにregistry-firewallサービスを追加し、関連設定ファイルを提供する。

## 対応要件

REQ-001, REQ-002, REQ-003

## サービス定義

### docker-compose.yml 追加分

```yaml
  registry-firewall:
    image: ghcr.io/windschord/registry-firewall:latest
    container_name: claudework-registry-firewall
    networks:
      - default
      - claudework-filter
    volumes:
      - registry-firewall-data:/data
      - ./configs/registry-firewall.yaml:/config/config.yaml:ro
    environment:
      - REGISTRY_FIREWALL_CONFIG=/config/config.yaml
      - RUST_LOG=${REGISTRY_FIREWALL_LOG_LEVEL:-info}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

### appサービスへの環境変数追加

```yaml
    environment:
      # Registry Firewall API URL
      - REGISTRY_FIREWALL_URL=http://registry-firewall:8080
      # Registry Firewall API Token (認証用)
      - REGISTRY_FIREWALL_API_TOKEN=${REGISTRY_FIREWALL_API_TOKEN:-}
```

### ボリューム追加

```yaml
volumes:
  registry-firewall-data:
```

### ネットワーク

既存の`claudework-filter`を共有。追加のネットワーク定義は不要。

## 設定ファイル

### configs/registry-firewall.yaml

```yaml
server:
  listen: "0.0.0.0:8080"
  request_timeout_secs: 30

logging:
  level: "${RUST_LOG}"
  format: json

auth:
  enabled: true

database:
  path: "/data/db/registry-firewall.db"

cache:
  enabled: true
  backend: filesystem
  filesystem:
    path: "/data/cache"
    max_size_gb: 10

registries:
  - name: npm
    type: npm
    upstream: "https://registry.npmjs.org"
    path_prefix: "/npm"
  - name: pypi
    type: pypi
    upstream: "https://pypi.org"
    path_prefix: "/pypi"
  - name: go
    type: go
    upstream: "https://proxy.golang.org"
    path_prefix: "/go"
  - name: cargo
    type: cargo
    upstream: "https://index.crates.io"
    path_prefix: "/cargo"
  - name: docker
    type: docker
    upstream: "https://registry-1.docker.io"
    path_prefix: "/docker"

security:
  sources:
    - type: osv
      enabled: true
      sync_interval_secs: 3600
    - type: openssf_malicious_packages
      enabled: true
      sync_interval_secs: 3600
  custom_blocklist:
    enabled: true
```

## 依存関係の変更

appサービスの`depends_on`にregistry-firewallを追加:

```yaml
    depends_on:
      network-filter-proxy:
        condition: service_healthy
      registry-firewall:
        # NFR-AVA-001: registry-firewall停止時もapp起動可能にするためservice_startedを使用
        condition: service_started
```

## 環境変数一覧

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `REGISTRY_FIREWALL_LOG_LEVEL` | `info` | registry-firewallのログレベル |
| `REGISTRY_FIREWALL_API_TOKEN` | (空) | registry-firewall APIの認証トークン |
| `REGISTRY_FIREWALL_URL` | `http://registry-firewall:8080` | registry-firewallの内部URL |
