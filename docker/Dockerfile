# syntax=docker/dockerfile:1
# Claude Code Sandboxed Container
# Claude Workで使用する隔離されたClaude Code実行環境

FROM node:20-slim

# メタデータ
LABEL maintainer="Claude Work"
LABEL description="Sandboxed environment for running Claude Code"
LABEL version="1.0"

# 必要なツールをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Claude Codeをインストール
RUN npm install -g @anthropic-ai/claude-code

# nodeユーザーを使用（node:20-slimでは既にUID 1000のnodeユーザーが存在）
# /home/claudeを/home/nodeへのシンボリックリンクとして作成
# 理由: 設計ドキュメントでは/home/claudeを参照していたが、node:20-slimイメージでは
# 既にnodeユーザー（UID 1000）が存在するため、新しいユーザーを作成する代わりに
# 既存のnodeユーザーを使用。シンボリックリンクにより/home/claudeへのパス参照も動作する
RUN ln -s /home/node /home/claude

# SSHディレクトリの準備（マウント用）
RUN mkdir -p /home/node/.ssh \
    && chmod 700 /home/node/.ssh \
    && chown node:node /home/node/.ssh

# Claude設定ディレクトリの準備（マウント用）
RUN mkdir -p /home/node/.claude \
    && mkdir -p /home/node/.config/claude \
    && chown -R node:node /home/node/.claude \
    && chown -R node:node /home/node/.config

# ワークスペースディレクトリの準備
RUN mkdir -p /workspace \
    && chown node:node /workspace

# 非rootユーザーに切り替え
USER node

# 環境変数設定
ENV HOME=/home/node
ENV TERM=xterm-256color
ENV COLORTERM=truecolor

# 作業ディレクトリ
WORKDIR /workspace

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD claude --version || exit 1

# デフォルトコマンド
CMD ["claude"]
