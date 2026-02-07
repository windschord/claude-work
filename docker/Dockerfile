# syntax=docker/dockerfile:1
# Claude Code Sandboxed Container
# Claude Workで使用する隔離されたClaude Code実行環境

FROM node:20-slim

LABEL maintainer="Claude Work"
LABEL description="Sandboxed environment for running Claude Code"

# 必要最低限のツールをインストール (git, gh, openssh-client, curl, wget, bash)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        openssh-client \
        curl \
        wget \
        bash \
        ca-certificates \
    && mkdir -p /etc/apt/keyrings \
    && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Claude Codeをインストール
RUN npm install -g @anthropic-ai/claude-code

# nodeユーザーを使用（node:20-slimに既存のUID 1000）
# /home/claude → /home/node のシンボリックリンク
RUN [ -e /home/claude ] || ln -s /home/node /home/claude

# SSHディレクトリの準備（マウント用）
RUN mkdir -p /home/node/.ssh \
    && chmod 700 /home/node/.ssh \
    && chown node:node /home/node/.ssh

# Claude設定ディレクトリの準備（マウント用）
RUN mkdir -p /home/node/.claude /home/node/.config/claude \
    && chmod 700 /home/node/.claude /home/node/.config/claude \
    && chown -R node:node /home/node/.claude /home/node/.config

# ワークスペースディレクトリの準備
RUN mkdir -p /workspace && chown node:node /workspace

USER node

ENV HOME=/home/node
ENV TERM=xterm-256color
ENV COLORTERM=truecolor

WORKDIR /workspace

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD claude --version || exit 1

CMD ["claude"]
