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

# rustupはnodeユーザー権限でインストール（/home/node配下）
USER node

ENV RUSTUP_HOME=/home/node/.rustup
ENV CARGO_HOME=/home/node/.cargo
ENV PATH="${CARGO_HOME}/bin:${PATH}"

ARG RUSTUP_VERSION=1.28.1
# SHA256 checksums pinned from https://rust-lang.github.io/rustup/installation/other.html
ARG RUSTUP_SHA256_AMD64=a3339fb004c3d0bb9862ba0bce001861fe5cbde9c10d16591eb3f39ee6cd3e7f
ARG RUSTUP_SHA256_ARM64=c64b33db2c6b9385817ec0e49a84bcfe018ed6e328fe755c3c809580cc70ce7a

RUN ARCH="$(dpkg --print-architecture)" \
    && case "${ARCH}" in \
        amd64) RUST_ARCH="x86_64-unknown-linux-gnu"; EXPECTED_SHA256="${RUSTUP_SHA256_AMD64}" ;; \
        arm64) RUST_ARCH="aarch64-unknown-linux-gnu"; EXPECTED_SHA256="${RUSTUP_SHA256_ARM64}" ;; \
        *) echo "Unsupported architecture: ${ARCH}" && exit 1 ;; \
    esac \
    && curl --proto '=https' --tlsv1.2 -fsSL -o /tmp/rustup-init \
        "https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/${RUST_ARCH}/rustup-init" \
    && echo "${EXPECTED_SHA256}  /tmp/rustup-init" | sha256sum -c - \
    && chmod +x /tmp/rustup-init \
    && /tmp/rustup-init -y --default-toolchain stable --profile minimal \
    && rm /tmp/rustup-init \
    && . "${CARGO_HOME}/env" \
    && rustup component add rustfmt clippy
```

### 設計判断

- **rustup-initバイナリを直接使用**: `sh.rustup.rs` のシェルスクリプト経由ではなく、バージョン固定されたrustup-initバイナリを直接ダウンロードし、SHA256チェックサムで検証する
- **RUSTUP_VERSIONとSHA256をARGで固定**: バージョンとチェックサムをARGとして固定し、再現可能なビルドを保証。更新時はバージョンとチェックサムを一緒に更新する
- **nodeユーザーでインストール**: rustupはユーザーローカルにインストールされるため、rootへの切り替え不要
- **minimal profile**: 最小限のコンポーネントのみインストールし、イメージサイズを抑制
- **rustfmt + clippy追加**: 開発で一般的に使用されるツールを含める
- **アーキテクチャ自動判定**: `dpkg --print-architecture` でamd64/arm64を自動選択し、対応するrustupバイナリとチェックサムを使用

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
