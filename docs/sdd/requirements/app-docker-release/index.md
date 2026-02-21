# 要件定義: アプリケーションDockerイメージ公開とGitHub Release自動化

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | app-docker-release |
| 作成日 | 2026-02-22 |
| ステータス | ACTIVE |

## 背景

Claude WorkアプリケーションはPR#108でDocker上での動作が確認された。
これをセルフホスト可能なDockerイメージとして公開し、GitHub Releasesページからバージョン管理された形で配布できるようにする。

## スコープ

### 対象
- Claude Workアプリケーション本体のDockerイメージ（ルートの`Dockerfile`）
- GitHub Actions リリースワークフロー（`.github/workflows/release.yml`）

### 対象外
- 既存の `docker/Dockerfile`（Claudeが動くサンドボックス用）
- 既存の `.github/workflows/docker-publish.yml`（サンドボックス用）
- npm publishおよびnpxによる配布（別タスク）

## ユーザーストーリー

| ID | タイトル | 優先度 |
|----|---------|--------|
| [US-001](stories/US-001.md) | アプリケーションDockerイメージのビルドと公開 | High |
| [US-002](stories/US-002.md) | GitHub Releaseの自動作成 | High |

## 非機能要件

| ファイル | カテゴリ |
|---------|---------|
| [nfr/reliability.md](nfr/reliability.md) | 信頼性 |
| [nfr/security.md](nfr/security.md) | セキュリティ |

## EARS記法 要件一覧

### 機能要件

| ID | EARS記法 |
|----|---------|
| FR-001 | `v*` タグがGitにpushされた時、システムはGitHub Releaseを自動作成しなければならない |
| FR-002 | `v*` タグがGitにpushされた時、システムはアプリケーションDockerイメージをGHCRにpushしなければならない |
| FR-003 | DockerイメージのビルドはNext.jsアプリケーションとカスタムサーバー（server.ts）を含まなければならない |
| FR-004 | DockerイメージはDockerfileのマルチステージビルドで作成されなければならない |
| FR-005 | GitHub Releaseのリリースノートは、前回タグからのPR・コミット一覧をGitHubが自動生成しなければならない |
| FR-006 | DockerイメージはGHCRに `ghcr.io/<owner>/claude-work` として公開されなければならない |
| FR-007 | DockerイメージはDockerタグとして、semverタグ（例: `1.2.3`, `1.2`, `1`）および `latest` を付与されなければならない |
| FR-008 | DockerイメージはAMD64・ARM64のマルチプラットフォームでビルドされなければならない |
| FR-009 | SQLiteデータファイルは `/data` ボリュームにマウントされ、コンテナ再起動でデータが保持されなければならない |
| FR-010 | アプリケーションはデフォルトポート3000で起動しなければならない |
