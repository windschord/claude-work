# syntax=docker/dockerfile:1
# Claude Code Sandboxed Container with C/C++
# 基本のsandboxイメージを拡張し、C/C++開発環境を追加した実行環境
#
# 使用方法:
#   docker build -f docker/extensions/Dockerfile.cpp -t claude-work-env:cpp docker/
#
#   # ローカルビルドした基本イメージを使用
#   docker build -f docker/Dockerfile -t claude-work-sandbox:local docker/
#   docker build -f docker/extensions/Dockerfile.cpp --build-arg BASE_IMAGE=claude-work-sandbox:local \
#     -t claude-work-env:cpp docker/

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
