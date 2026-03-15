# タスク計画: アプリケーションDockerイメージ公開とGitHub Release自動化

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | app-docker-release |
| 作成日 | 2026-02-22 |
| ステータス | DONE |
| 関連設計 | [design/app-docker-release/index.md](../../design/app-docker-release/index.md) |

## タスク一覧

| ID | タイトル | ステータス | 依存 |
|----|---------|-----------|------|
| TASK-001 | .dockerignoreの作成 | DONE | なし |
| TASK-002 | Dockerfile（アプリ本体用）の作成 | DONE | なし |
| TASK-003 | release.ymlワークフローの作成 | DONE | なし |

TASK-001〜003は互いに独立しており、並列実行可能。

---

## TASK-001: .dockerignoreの作成

**ステータス**: DONE

**目的**: ビルドコンテキストの最小化とセキュリティ向上

**作成ファイル**: `.dockerignore`（リポジトリルート）

**内容**:

```gitignore
# Git
.git
.gitignore
.gitmodules

# Node.js
node_modules
npm-debug.log
yarn-debug.log
yarn-error.log

# ビルド成果物（コンテナ内で生成）
.next
dist

# データ・設定（ランタイムのもの）
data
.env
.env.*

# ワークツリー
.worktrees

# Docker（サンドボックス用Dockerfile）
docker

# ドキュメント
docs

# テスト
**/__tests__
*.test.ts
*.spec.ts
e2e
test-screenshots

# ログ
logs
*.log

# IDE・OS
.vscode
.idea
.DS_Store
Thumbs.db

# PM2
ecosystem.config.js
```

**受入条件**:
- `.dockerignore` がリポジトリルートに存在する
- `node_modules`, `data`, `.env`, `.next`, `dist` が除外される
- `docker/` ディレクトリが除外される（サンドボックス用と混在しない）

---

## TASK-002: Dockerfile（アプリ本体用）の作成

**ステータス**: DONE

**目的**: Claude Workアプリケーション本体のDockerイメージ作成

**作成ファイル**: `Dockerfile`（リポジトリルート）

**マルチステージ構成**:

```dockerfile
# syntax=docker/dockerfile:1
# Claude Work Application

# Stage 1: base - ネイティブモジュールビルド環境
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app

# Stage 2: deps-prod - 本番用依存関係のみ
FROM base AS deps-prod
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts でprepareスクリプト(npm run build)の実行を抑制（ソースファイル未コピーのため）
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
# ネイティブモジュール（better-sqlite3, node-pty）を明示的にビルド
RUN pnpm rebuild

# Stage 3: deps-all - 全依存関係（ビルド用）
FROM base AS deps-all
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts でprepareスクリプト(npm run build)の実行を抑制（ソースファイル未コピーのため）
RUN pnpm install --frozen-lockfile --ignore-scripts
# ネイティブモジュール（better-sqlite3, node-pty）を明示的にビルド
RUN pnpm rebuild

# Stage 4: builder - アプリビルド
FROM base AS builder
COPY --from=deps-all /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:/tmp/build.db
RUN pnpm run build

# Stage 5: runner - 本番実行環境
FROM node:20-slim AS runner
LABEL org.opencontainers.image.title="Claude Work"
LABEL org.opencontainers.image.description="Web-based tool for managing multiple Claude Code sessions"
LABEL org.opencontainers.image.source="https://github.com/windschord/claude-work"
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=file:/data/claudework.db
ENV DATA_DIR=/data
# 本番用依存関係のみコピー（devDependencies除外）
COPY --from=deps-prod /app/node_modules ./node_modules
# ビルド成果物のコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
# ヘルスチェックスクリプトのコピー
COPY --from=builder /app/scripts/healthcheck.js ./scripts/healthcheck.js
# データディレクトリ（永続化対象）
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node scripts/healthcheck.js
CMD ["node", "dist/server.js"]
```

**受入条件**:
- `docker build -t claude-work .` が成功する
- `docker run -p 3000:3000 -v ./data:/data claude-work` でアプリが起動する
- コンテナが非rootユーザー（node, UID 1000）で動作する
- HealthCheckが設定されている

---

## TASK-003: release.ymlワークフローの作成

**ステータス**: DONE

**目的**: `v*`タグpush時のGitHub Release自動作成とDockerイメージGHCR公開

**作成ファイル**: `.github/workflows/release.yml`

**内容**:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io

permissions:
  contents: write
  packages: write

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    env:
      DATABASE_URL: file:./data/test.db

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup project
        uses: ./.github/actions/setup

      - name: Run backend tests
        run: |
          pnpm exec vitest run src/app/api src/lib src/services src/bin \
            --exclude='**/*.integration.test.ts' \
            --exclude='**/docker-adapter.test.ts' \
            --exclude='**/docker-adapter-git.test.ts' \
            --exclude='src/services/__tests__/pty-session-manager.test.ts' \
            --reporter=verbose
        timeout-minutes: 10

  release:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    needs: test

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set image name to lowercase
        id: image
        run: echo "name=${GITHUB_REPOSITORY_OWNER,,}/claude-work" >> "$GITHUB_OUTPUT"

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ steps.image.outputs.name }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest,enable=${{ !contains(github.ref, '-') }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Create GitHub Release
        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2
        with:
          generate_release_notes: true
          make_latest: ${{ !contains(github.ref, '-') }}
          prerelease: ${{ contains(github.ref, '-') }}
```

**受入条件**:
- `v*` タグpush時にワークフローが起動する
- テストが成功した場合のみリリースが実行される
- GHCRにイメージがpushされる（semverタグ + latest※プレリリース除外）
- GitHub Releasesページにリリースが作成される
- リリースノートが自動生成される
- プレリリースタグ（`v1.0.0-beta` 等）は `latest` タグ・`make_latest` から除外される
