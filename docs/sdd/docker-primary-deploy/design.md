# 技術設計書: Docker Composeプライマリデプロイ化

## 1. アーキテクチャ概要

Docker Composeをプライマリデプロイ方法に昇格させる。ClaudeWorkコンテナ（アプリ本体）がホストのDockerデーモンを介してサンドボックスコンテナ（Claude Code実行用）を管理するDooD（Docker-out-of-Docker）アーキテクチャを採用する。

```text
Host
├─ Docker Engine
│   ├─ claudework (アプリコンテナ)
│   │   ├─ Next.js Server
│   │   ├─ SQLite DB (/data/claudework.db)
│   │   └─ Docker CLI → /var/run/docker.sock
│   │
│   ├─ claude-sandbox-xxx (サンドボックスコンテナ1)
│   └─ claude-sandbox-yyy (サンドボックスコンテナ2)
│
├─ /var/run/docker.sock (共有)
└─ ./data/ (ホストからバインドマウント)
```

## 2. 変更対象

| ファイル | 変更内容 |
|---------|---------|
| `docker-compose.yml` | docker.sockマウント、group_add追加、env_file追加 |
| `Dockerfile` | runnerステージにDocker CLI追加 |
| `.env.example` | Docker Compose向け設定例追加 |
| `README.md` | クイックスタートをDocker Compose優先に |
| `docs/SETUP.md` | Docker Compose（推奨）セクション追加 |
| ~~`docs/SYSTEMD_SETUP.md`~~ | ~~代替方法であることを明記~~ ファイル削除済み（systemdサポート廃止） |
| `CLAUDE.md` | Environment SetupをDocker Compose優先に |
| `docs/ENV_VARS.md` | Docker Compose設定セクション追加 |
| `docs/DOCKER_ENVIRONMENT.md` | Docker Compose運用注意事項追加 |

## 3. 詳細設計

### 3.1 docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: claudework
    ports:
      - "${HOST_PORT:-3000}:3000"
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock
    # ホストのdockerグループGIDを指定し、nodeユーザーがdocker.sockにアクセス可能にする
    # DOCKER_GID は stat -c '%g' /var/run/docker.sock で確認し .env に設定する
    group_add:
      - "${DOCKER_GID:-0}"
    env_file:
      - path: .env
        required: false
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/data/claudework.db
      - PORT=3000
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-}
      - ALLOWED_PROJECT_DIRS=${ALLOWED_PROJECT_DIRS:-}
      - DOCKER_ENABLED=true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "scripts/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

変更点:
- `/var/run/docker.sock:/var/run/docker.sock` マウント追加
- `group_add` でホストのdockerグループGIDを指定（`DOCKER_GID` 環境変数経由）
- `env_file` ディレクティブ追加（`required: false` でファイル不在時もエラーにならない）
- `DOCKER_ENABLED=true` 追加（docker.sockマウント環境でレガシーDocker UIを有効化）

### 3.2 Dockerfile runnerステージ

```dockerfile
FROM node:20-slim AS runner
# ... 既存のラベル、ENV設定 ...

# Docker CLI のインストール（暫定: Dockerode移行で削除予定）
# コンテナからホストのDockerデーモンを操作するために必要
# NOTE: docker.sockへのアクセス権限はdocker-compose.ymlのgroup_addで付与する
# DockerfileではなくCompose側で対応する理由: ホストのdockerグループGIDは環境ごとに異なるため、
# ビルド時に固定できない。group_addによるランタイム指定が適切。
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*
```

### 3.3 .env.example の追加セクション

Docker Compose向けの設定例を既存の `.env.example` に追加する。

### 3.4 ドキュメント更新方針

各ドキュメントの更新方針:

| ドキュメント | 方針 |
|------------|------|
| README.md | クイックスタートをDocker Composeに書き換え |
| SETUP.md | 「Docker Compose（推奨）」セクションを最初に配置 |
| ~~SYSTEMD_SETUP.md~~ | ~~冒頭に注記を追加~~ ファイル削除済み（systemdサポート廃止） |
| CLAUDE.md | Environment SetupをDocker Compose優先に |
| ENV_VARS.md | Docker Compose セクション追加 |
| DOCKER_ENVIRONMENT.md | Docker Compose運用セクション追加 |

## 4. docker.sockマウントのセキュリティ考慮

- docker.sockマウントによりコンテナからホストのDockerデーモンを操作可能になる
- ClaudeWorkはこれを利用してサンドボックスコンテナを起動・管理する
- コンテナ内のnodeユーザーがdocker.sockにアクセスするには、ホスト側のdockerグループGIDとコンテナ内のグループを一致させる必要がある

### 4.1 docker.sockアクセスの設定手順

1. ホスト側のdockerグループGIDを確認する:

```bash
stat -c '%g' /var/run/docker.sock
# 例: 999
```

2. `.env` ファイルに `DOCKER_GID` を設定する:

```bash
DOCKER_GID=999  # 上記コマンドの出力値を設定
```

3. `docker-compose.yml` の `group_add` でホストのdockerグループGIDを指定する（3.1節のYAML例を参照）。これにより、コンテナ内のnodeユーザーがdocker.sockに対する読み書き権限を得る。

## 5. テスト方針

変更がドキュメントとDocker設定のみのため、以下の手動検証で確認する:

| テスト | 手順 | 期待結果 |
|-------|------|---------|
| docker-compose.yml構文 | `docker compose config` | エラーなく出力 |
| Dockerビルド | `docker compose build` | ビルド成功 |
| 起動確認 | `docker compose up -d` | ヘルスチェック正常 |
| docker.sock動作 | コンテナ内で `docker ps` | ホストのコンテナ一覧表示 |
