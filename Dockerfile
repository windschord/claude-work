# syntax=docker/dockerfile:1
# Claude Work Application
# https://github.com/windschord/claude-work

# =============================================================================
# Stage 1: base - ネイティブモジュールビルド環境
# =============================================================================
FROM node:20-slim AS base
# better-sqlite3, node-pty等のネイティブモジュールビルドに必要
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app

# =============================================================================
# Stage 2: deps-prod - 本番用依存関係のみ（devDependencies除外）
# =============================================================================
FROM base AS deps-prod
COPY package.json pnpm-lock.yaml ./
# --prod フラグでdevDependenciesを除外してインストール
# --ignore-scripts でprepareスクリプト(npm run build)の実行を抑制（ソースファイル未コピーのため）
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
# ネイティブモジュール（better-sqlite3, node-pty）を明示的にビルド
# --ignore-scriptsで抑制されたpostinstallを再実行する
RUN pnpm rebuild

# =============================================================================
# Stage 3: deps-all - 全依存関係（ビルド用）
# =============================================================================
FROM base AS deps-all
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts でprepareスクリプト(npm run build)の実行を抑制（ソースファイル未コピーのため）
RUN pnpm install --frozen-lockfile --ignore-scripts
# ネイティブモジュール（better-sqlite3, node-pty）を明示的にビルド
RUN pnpm rebuild

# =============================================================================
# Stage 4: builder - アプリケーションビルド
# =============================================================================
FROM base AS builder
COPY --from=deps-all /app/node_modules ./node_modules
COPY . .
# ビルド時のみ使用する一時的なDB URL
ENV DATABASE_URL=file:/tmp/build.db
# Next.js + TypeScriptサーバーをビルド
RUN pnpm run build

# =============================================================================
# Stage 5: runner - 本番実行環境（最小イメージ）
# =============================================================================
FROM node:20-slim AS runner

LABEL org.opencontainers.image.title="Claude Work"
LABEL org.opencontainers.image.description="Web-based tool for managing multiple Claude Code sessions"
LABEL org.opencontainers.image.source="https://github.com/windschord/claude-work"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/claudework.db
ENV DATA_DIR=/data

# 本番用依存関係のみコピー（devDependencies除外でイメージサイズ削減）
COPY --from=deps-prod /app/node_modules ./node_modules

# ビルド成果物のコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
# ヘルスチェックスクリプトのコピー
COPY --from=builder /app/scripts/healthcheck.js ./scripts/healthcheck.js

# データディレクトリの準備（SQLiteデータの永続化）
RUN mkdir -p /data && chown node:node /data

# データを永続化するためのボリューム宣言
VOLUME ["/data"]

# 非rootユーザーで実行（セキュリティのため）
USER node

EXPOSE 3000

# ヘルスチェック（/api/health エンドポイントを使用）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node scripts/healthcheck.js

CMD ["node", "dist/server.js"]
