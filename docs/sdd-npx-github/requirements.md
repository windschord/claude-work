# 要件定義: npx GitHub リポジトリ対応

## 概要

`npx github:user/claude-work` 形式でGitHubリポジトリから直接インストール・実行できるようにする。
これにより、npm registryへの公開前にブランチ状態で動作確認が可能となる。

## 背景

現状の問題:
1. `dist/` が `.gitignore` に含まれており、GitHubリポジトリに含まれない
2. `prepare` スクリプトがないため、GitHubからのインストール時にビルドが実行されない
3. `npx github:user/claude-work` を実行すると `dist/src/bin/cli.js` が存在せずエラーになる

## ユーザーストーリー

### ストーリー1: GitHubリポジトリからの直接インストール・実行

**私は** 開発者として
**〜したい** `npx github:windschord/claude-work` でツールを実行したい
**なぜなら** npm registryへの公開前にブランチ状態で動作確認できるから

#### 受入基準（EARS記法）

- **REQ-001**: `npx github:windschord/claude-work` を実行した時、システムは自動的にビルドを実行し、CLIが起動しなければならない
- **REQ-002**: `npx github:windschord/claude-work#branch-name` を実行した時、システムは指定ブランチのコードでCLIが起動しなければならない
- **REQ-003**: `npm install` を実行した時、システムはprepareフックで `npx prisma generate` と `npm run build` を自動的に実行しなければならない

### ストーリー2: npx動作のE2Eテスト

**私は** 開発者として
**〜したい** npxでの動作が設計通りかをテストで確認したい
**なぜなら** リリース前に確実に動作することを保証したいから

#### 受入基準（EARS記法）

- **REQ-004**: E2Eテストを実行した時、システムは `npm pack` で作成したtarballからCLIが正常に起動することを検証しなければならない
- **REQ-005**: E2Eテストを実行した時、システムは `claude-work help` がヘルプメッセージを出力することを検証しなければならない
- **REQ-006**: E2Eテストを実行した時、システムは `claude-work status` が実行できることを検証しなければならない

**注記**: `start` / `stop` コマンドのE2Eテストは、バックグラウンドプロセス管理の複雑さから本スコープでは除外する。

## 非機能要件

### 互換性要件

- **NFR-001**: `prepare` スクリプトの追加は、既存の開発ワークフロー（`npm install`）に影響を与えてはならない
- **NFR-002**: `prepare` スクリプトは、CI/CD環境でも正常に動作しなければならない

### テスト要件

- **NFR-003**: E2Eテストは独立した一時ディレクトリで実行し、プロジェクト本体に影響を与えてはならない

## 依存関係

- Node.js 20以上
- npm（npxコマンド）
- Gitリポジトリへのアクセス

## スコープ外

- npm registryへの公開作業
- Docker環境でのnpx実行テスト
- Windows環境でのテスト（Linux/macOSのみ対象）
