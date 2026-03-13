# 要件定義: Issue #192 - Dockerイメージへのiptablesパッケージ追加

## 概要

プロダクション用Dockerイメージ（runnerステージ）にiptablesがインストールされていないため、
ネットワークフィルタリング機能が動作しない問題を修正する。

## 要件 (EARS記法)

### FR-001: iptablesの提供

WHEN ネットワークフィルタリング機能が実行される
THE SYSTEM SHALL iptablesコマンドを使用してネットワークルールを設定できること

### FR-002: Dockerイメージへの組み込み

WHERE Dockerfileのrunnerステージ（Stage 5）
THE SYSTEM SHALL iptablesパッケージがインストールされていること

## 前提条件

- docker-compose.yml に `cap_add: [NET_ADMIN]` が設定済みであること（確認済み）
- iptablesパッケージの追加によりネットワークフィルタリングが機能すること
