# Go Extension

## 概要

**目的**: Go開発環境を基本イメージに追加する拡張Dockerfile

**責務**:
- Go言語コンパイラとツールチェインの提供
- GOPATH, GOROOTの設定
- PATHへのGoバイナリパス追加

## 情報の明確性

### 明示された情報
- Go言語が必要

---

## ファイル

**パス**: `docker/extensions/Dockerfile.golang`

## Dockerfile設計

```dockerfile
ARG BASE_IMAGE=ghcr.io/windschord/claude-work-sandbox:latest
FROM ${BASE_IMAGE}

LABEL description="Sandboxed environment for running Claude Code with Go"

ARG GO_VERSION=1.24.1
# SHA256 checksums pinned from https://go.dev/dl/ (信頼済みのハッシュを事前固定)
ARG GO_SHA256_AMD64=cb2396bae64183cdccf81a9a6df0aea3bce9511fc21469fb89a0c00470088073
ARG GO_SHA256_ARM64=8df5750ffc0281017fb6070fba450f5d22b600a02081dceef47966ffaf36a3af

USER root

RUN ARCH="$(dpkg --print-architecture)" \
    && case "${ARCH}" in \
        amd64) EXPECTED_SHA256="${GO_SHA256_AMD64}" ;; \
        arm64) EXPECTED_SHA256="${GO_SHA256_ARM64}" ;; \
        *) echo "Unsupported architecture: ${ARCH}" && exit 1 ;; \
    esac \
    && curl -fsSL -o /tmp/go.tar.gz "https://dl.google.com/go/go${GO_VERSION}.linux-${ARCH}.tar.gz" \
    && echo "${EXPECTED_SHA256}  /tmp/go.tar.gz" | sha256sum -c - \
    && rm -rf /usr/local/go \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz \
    && chown -R root:root /usr/local/go

USER node

ENV GOROOT=/usr/local/go
ENV GOPATH=/home/node/go
ENV PATH="${GOPATH}/bin:${GOROOT}/bin:${PATH}"
```

### 設計判断

- **公式tarball方式を採用**: aptのgolangパッケージはバージョンが古いことが多いため、公式サイトから最新安定版をインストール
- **GO_VERSIONをARGで指定**: バージョン固定と更新の容易性を両立
- **SHA256チェックサム検証**: ダウンロードしたtarballをSHA256で検証し、改ざんや破損を検知。チェックサムはARGとして固定し、バージョン更新時に一緒に更新する
- **既存Goディレクトリの削除**: `rm -rf /usr/local/go` で既存のGoインストールを確実に除去してから展開する
- **アーキテクチャ自動判定**: `dpkg --print-architecture` でamd64/arm64を自動選択（マルチプラットフォーム対応）

## インストールされるツール

| ツール | 提供元 | 用途 |
|-------|--------|------|
| go | 公式tarball | Goコンパイラ/ツールチェイン |

## 環境変数

| 変数名 | 値 | 目的 |
|--------|-----|------|
| GOROOT | `/usr/local/go` | Goインストール先 |
| GOPATH | `/home/node/go` | Goワークスペース |
| PATH | `${GOPATH}/bin:${GOROOT}/bin:${PATH}` | goコマンド/インストール済みバイナリへのパス |

## レジストリタグ

- `ghcr.io/windschord/claude-work-sandbox:golang`
- `ghcr.io/windschord/claude-work-sandbox:golang-sha-xxxxx`

## 依存関係

### 依存するコンポーネント
- [Base Image](base-image.md) @base-image.md: `FROM ${BASE_IMAGE}` で継承

## テスト観点

- [ ] ビルド成功
- [ ] `go version` が実行可能
- [ ] Hello Worldプログラムのビルドと実行が成功
- [ ] nodeユーザーで実行される
