# C++ Extension

## 概要

**目的**: C/C++開発環境を基本イメージに追加する拡張Dockerfile

**責務**:
- GCC/G++コンパイラの提供
- CMake（ビルドシステム）の提供
- Make（ビルドツール）の提供
- GDB（デバッガ）の提供

## 情報の明確性

### 明示された情報
- gcc/g++, cmake, makeが必要

---

## ファイル

**パス**: `docker/extensions/Dockerfile.cpp`

## Dockerfile設計

```dockerfile
ARG BASE_IMAGE=ghcr.io/windschord/claude-work-sandbox:latest
FROM ${BASE_IMAGE}

LABEL description="Sandboxed environment for running Claude Code with C/C++"

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        gdb \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER node
```

### 設計判断

- **build-essential**: gcc, g++, make, libc-devを一括インストール（Debianの標準メタパッケージ）
- **cmake**: モダンC++プロジェクトのビルドシステムとして必須
- **gdb**: デバッグ用途（Claude Codeが利用する可能性）
- **追加の環境変数不要**: 全ツールが標準パスにインストールされる

## インストールされるツール

| ツール | 提供元 | 用途 |
|-------|--------|------|
| gcc | apt (build-essential) | Cコンパイラ |
| g++ | apt (build-essential) | C++コンパイラ |
| make | apt (build-essential) | ビルドツール |
| cmake | apt | ビルドシステム |
| gdb | apt | デバッガ |

## 環境変数

追加の環境変数なし（全ツールがデフォルトPATHに含まれる）

## レジストリタグ

- `ghcr.io/windschord/claude-work-sandbox:cpp`
- `ghcr.io/windschord/claude-work-sandbox:cpp-sha-xxxxx`

## 依存関係

### 依存するコンポーネント
- [Base Image](base-image.md) @base-image.md: `FROM ${BASE_IMAGE}` で継承

## テスト観点

- [ ] ビルド成功
- [ ] `gcc --version` が実行可能
- [ ] `g++ --version` が実行可能
- [ ] `cmake --version` が実行可能
- [ ] `make --version` が実行可能
- [ ] Hello Worldプログラム（C/C++）のビルドと実行が成功
- [ ] nodeユーザーで実行される
