# Rust Extension

## 概要

**目的**: Rust開発環境を基本イメージに追加する拡張Dockerfile

**責務**:
- Rustコンパイラ（stable）の提供
- Cargo（パッケージマネージャ/ビルドツール）の提供
- rustup（ツールチェイン管理）の提供

## 情報の明確性

### 明示された情報
- Rust, cargoが必要

---

## ファイル

**パス**: `docker/extensions/Dockerfile.rust`

## Dockerfile設計

```dockerfile
ARG BASE_IMAGE=ghcr.io/windschord/claude-work-sandbox:latest
FROM ${BASE_IMAGE}

LABEL description="Sandboxed environment for running Claude Code with Rust"

# rustupはnodeユーザー権限でインストール（/home/node配下にインストールされる）
USER node

ENV RUSTUP_HOME=/home/node/.rustup
ENV CARGO_HOME=/home/node/.cargo
ENV PATH="${CARGO_HOME}/bin:${PATH}"

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal \
    && rustup component add rustfmt clippy
```

### 設計判断

- **rustup公式インストーラを使用**: aptのrustcパッケージはバージョンが古く、rustupによるツールチェイン管理が標準的
- **nodeユーザーでインストール**: rustupはユーザーローカルにインストールされるため、rootへの切り替え不要
- **minimal profile**: 最小限のコンポーネントのみインストールし、イメージサイズを抑制
- **rustfmt + clippy追加**: 開発で一般的に使用されるツールを含める

## インストールされるツール

| ツール | 提供元 | 用途 |
|-------|--------|------|
| rustc | rustup | Rustコンパイラ |
| cargo | rustup | パッケージマネージャ/ビルドツール |
| rustup | 公式インストーラ | ツールチェイン管理 |
| rustfmt | rustup component | コードフォーマッタ |
| clippy | rustup component | Linter |

## 環境変数

| 変数名 | 値 | 目的 |
|--------|-----|------|
| RUSTUP_HOME | `/home/node/.rustup` | rustupインストール先 |
| CARGO_HOME | `/home/node/.cargo` | Cargoホームディレクトリ |
| PATH | `${CARGO_HOME}/bin:${PATH}` | cargo/rustcコマンドへのパス |

## レジストリタグ

- `ghcr.io/windschord/claude-work-sandbox:rust`
- `ghcr.io/windschord/claude-work-sandbox:rust-sha-xxxxx`

## 依存関係

### 依存するコンポーネント
- [Base Image](base-image.md) @base-image.md: `FROM ${BASE_IMAGE}` で継承
- Base Imageのcurlを使用してrustupをダウンロード

## テスト観点

- [ ] ビルド成功
- [ ] `rustc --version` が実行可能
- [ ] `cargo --version` が実行可能
- [ ] `rustup show` が正常動作
- [ ] Hello Worldプログラムのビルドと実行が成功
- [ ] nodeユーザーで実行される
