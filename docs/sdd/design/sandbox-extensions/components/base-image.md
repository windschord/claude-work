# Base Image

## 概要

**目的**: Claude Codeの実行に必要な最小限の環境を提供する基本Dockerイメージ

**責務**:
- Node.js 20ランタイムの提供
- Claude Code CLIのインストール
- Git, gh (GitHub CLI), SSH, curl, wget等の基本ツールの提供
- 非rootユーザー（node）での実行
- ワークスペース（/workspace）とSSH/Claude設定ディレクトリの準備

## 情報の明確性

### 明示された情報
- 既存の `docker/Dockerfile` がそのままベースイメージとなる
- 変更不要（現状維持）

---

## ファイル

**パス**: `docker/Dockerfile`

## 構成要素

| レイヤー | 内容 |
|---------|------|
| ベースイメージ | `node:20-slim` |
| システムツール | git, openssh-client, curl, wget, bash, ca-certificates, gh |
| Claude Code | `@anthropic-ai/claude-code`（npm global install） |
| ユーザー設定 | node (UID 1000), /home/claude -> /home/node symlink |
| ディレクトリ | /workspace, /home/node/.ssh, /home/node/.claude, /home/node/.config/claude |

## インターフェース

### 拡張イメージへの提供

全拡張イメージが継承時に利用可能なもの:

- **ユーザー**: `node` (UID 1000)
- **作業ディレクトリ**: `/workspace`
- **環境変数**: `HOME=/home/node`, `TERM=xterm-256color`, `COLORTERM=truecolor`
- **npm/npx**: グローバルインストール済み
- **ヘルスチェック**: `claude --version`

### レジストリ

- `ghcr.io/windschord/claude-work-sandbox:latest`
- `ghcr.io/windschord/claude-work-sandbox:sha-xxxxx`

## 依存関係

### 依存するコンポーネント
- なし（ルートイメージ）

### 依存されるコンポーネント
- [Python Extension](python-extension.md) @python-extension.md
- [Go Extension](golang-extension.md) @golang-extension.md
- [Rust Extension](rust-extension.md) @rust-extension.md
- [C++ Extension](cpp-extension.md) @cpp-extension.md
- [Chrome DevTools Extension](chrome-devtools-extension.md) @chrome-devtools-extension.md

## テスト観点

- [x] ビルド成功（CI既存）
- [x] `claude --version` 実行可能（HEALTHCHECK既存）
- [x] nodeユーザーで実行される
- [x] /workspaceディレクトリが存在する
