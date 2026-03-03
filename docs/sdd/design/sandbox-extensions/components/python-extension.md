# Python Extension

## 概要

**目的**: Python3開発環境を基本イメージに追加する拡張Dockerfile

**責務**:
- Python3インタプリタの提供
- pip (パッケージマネージャ) の提供
- venv (仮想環境) の提供
- pip user installパスのPATH追加

## 情報の明確性

### 明示された情報
- Python3, pip, venvが必要

---

## ファイル

**パス**: `docker/extensions/Dockerfile.python`

## Dockerfile設計

```dockerfile
ARG BASE_IMAGE=ghcr.io/windschord/claude-work-sandbox:latest
FROM ${BASE_IMAGE}

LABEL description="Sandboxed environment for running Claude Code with Python"

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER node

# pip user installのパスをPATHに追加
ENV PATH="/home/node/.local/bin:${PATH}"
```

## インストールされるツール

| ツール | 提供元 | 用途 |
|-------|--------|------|
| python3 | apt (Debian) | Pythonインタプリタ |
| pip3 | apt (python3-pip) | パッケージインストール |
| venv | apt (python3-venv) | 仮想環境の作成 |

## 環境変数

| 変数名 | 値 | 目的 |
|--------|-----|------|
| PATH | `/home/node/.local/bin:${PATH}` | pip user install先をPATHに含める |

## レジストリタグ

- `ghcr.io/windschord/claude-work-sandbox:python`
- `ghcr.io/windschord/claude-work-sandbox:python-sha-xxxxx`

## 依存関係

### 依存するコンポーネント
- [Base Image](base-image.md) @base-image.md: `FROM ${BASE_IMAGE}` で継承

## テスト観点

- [ ] ビルド成功
- [ ] `python3 --version` が実行可能
- [ ] `pip3 --version` が実行可能
- [ ] `python3 -m venv /tmp/test-venv` が成功
- [ ] nodeユーザーで実行される
