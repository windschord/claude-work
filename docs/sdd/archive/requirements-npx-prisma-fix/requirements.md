# 要件定義: npx 実行時の依存バージョン不整合修正

## 概要

`npx github:windschord/claude-work` 実行時に、ローカルにインストールされた依存関係のバージョンではなく、グローバルまたは最新バージョンが使用される問題を修正する。

## 背景

現状の問題:
1. `prepare` スクリプトで `npx prisma generate` を使用
2. CLI コード内で `npx prisma` や `npx pm2` を使用
3. これらは node_modules 内のバージョンではなく、グローバル/最新バージョンを使用する可能性がある
4. Prisma 7.x には破壊的変更があり、5.x で動作するコードが動かない

## ユーザーストーリー

### ストーリー1: npx での正常起動

**私は** ユーザーとして
**〜したい** `npx github:windschord/claude-work start` で正常に起動したい
**なぜなら** README に記載されている方法で使いたいから

#### 受入基準（EARS記法）

- **REQ-001**: `npx github:windschord/claude-work` を実行した時、システムは package.json で指定された Prisma バージョンを使用しなければならない
- **REQ-002**: CLI がセットアップを実行する時、システムは node_modules 内の prisma コマンドを使用しなければならない
- **REQ-003**: CLI が pm2 を実行する時、システムは node_modules 内の pm2 コマンドを使用しなければならない

## 非機能要件

### 互換性要件

- **NFR-001**: 修正は既存の開発ワークフロー（`pnpm install`, `pnpm run dev`）に影響を与えてはならない
- **NFR-002**: 修正は CI/CD 環境でも正常に動作しなければならない

## 依存関係

- Node.js 20以上
- Prisma 5.22.0
- pm2（dependencies に含まれる）

## スコープ外

- Prisma 7.x へのアップグレード
- pm2 以外のプロセスマネージャー対応
