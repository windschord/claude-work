# 要件定義: Dockerプライマリデプロイ化

## 概要

ClaudeWorkのデプロイ方法として Docker Compose をプライマリ（推奨）に昇格させ、従来の systemd 方式をセカンドオプションに変更する。docker-compose.yml の更新と全ドキュメントの修正を行う。

> **注記**: Docker CLI への依存を Dockerode ライブラリに置き換える作業は別Issueで対応する。本要件ではDockerfileにDocker CLIを追加して対応する。

## ユーザーストーリー

### ストーリー1: Docker Composeによるデプロイ

**私は** ClaudeWorkの運用者として
**したい** Docker Composeで簡単にClaudeWorkをデプロイ
**なぜなら** Dockerであれば環境差異を最小化し、再現性のあるデプロイができるから

#### 受入基準（EARS記法）

- REQ-001: docker-compose.ymlに `/var/run/docker.sock` のボリュームマウントが含まれなければならない
- REQ-002: docker-compose.ymlの GIT_REPOS_PATH はオプション（任意設定）でなければならない
- REQ-003: docker-compose.ymlに SSH鍵や Claude認証情報（~/.claude）のホストマウントを含めてはならない
- REQ-004: `docker compose up -d` の実行で、ClaudeWorkが起動し http://localhost:${HOST_PORT:-3000} でアクセス可能にならなければならない（デフォルト: 3000）
- REQ-005: コンテナ内からホストのDockerデーモンを経由してサンドボックスコンテナ（Claude Code実行用）を起動できなければならない
- REQ-006: Dockerfile の runner ステージに Docker CLI がインストールされなければならない（Dockerode移行までの暫定対応）

### ストーリー2: ドキュメントのDocker優先化

**私は** ClaudeWorkの利用者として
**したい** ドキュメントでDockerデプロイが最初に案内されること
**なぜなら** 推奨方法が明確にわかり、セットアップの迷いが減るから

#### 受入基準（EARS記法）

- REQ-007: README.md のクイックスタートセクションで、Docker Composeによるデプロイ方法が最初に記載されなければならない
- REQ-008: SETUP.md で Docker Compose によるセットアップが最初のセクションとして記載されなければならない
- REQ-009: ~~SYSTEMD_SETUP.md の冒頭に「代替デプロイ方法」であることを明記しなければならない~~ (systemdサポート廃止によりファイル削除済み)
- REQ-010: CLAUDE.md のデプロイ手順において Docker Compose が最初に記載されなければならない
- REQ-011: ENV_VARS.md に Docker Compose 環境固有の設定（ボリューム、ソケット等）の説明が含まれなければならない
- REQ-012: DOCKER_ENVIRONMENT.md に Docker Compose 運用時の注意事項（docker.sockマウント、データ永続化等）が記載されなければならない

## 非機能要件

- NFR-001: Docker Compose による起動は、`docker compose up -d` 実行後 60 秒以内にヘルスチェック（/api/health）が正常応答しなければならない
- NFR-002: ~~ドキュメントの更新において、既存のsystemdデプロイ方法の手順が失われてはならない（セカンドオプションとして残す）~~ systemd/npxサポートは廃止済み。Docker Composeが唯一のデプロイ方法として残る

## 影響範囲

### 変更が必要なファイル

#### Docker Compose / Dockerfile
- `docker-compose.yml`: ソケットマウント追加、GIT_REPOS_PATHオプション化
- `Dockerfile`: runner ステージに Docker CLI 追加（暫定）
- `.env.example`: Docker Compose向け設定例の追加

#### ドキュメント
- `README.md`: クイックスタートのDocker優先化
- `docs/SETUP.md`: セットアップ手順のDocker優先化
- ~~`docs/SYSTEMD_SETUP.md`: セカンドオプション表記への変更~~ (削除済み)
- `CLAUDE.md`: デプロイ手順の優先順位更新
- `docs/ENV_VARS.md`: Docker Compose環境変数の追記
- `docs/DOCKER_ENVIRONMENT.md`: Docker Compose運用の注意事項追加

### 変更不要のファイル
- `docker/Dockerfile`: サンドボックス用、変更不要
- `scripts/docker-entrypoint.sh`: 変更不要
- `scripts/healthcheck.js`: 変更不要
- `.dockerignore`: 変更不要

## 前提条件

- ホストにDocker Engine がインストールされていること
- `/var/run/docker.sock` がコンテナからアクセス可能であること

## 関連Issue

- Docker CLI → Dockerode ライブラリ移行（別Issue）
