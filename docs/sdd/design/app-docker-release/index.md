# 設計書: アプリケーションDockerイメージ公開とGitHub Release自動化

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | app-docker-release |
| 作成日 | 2026-02-22 |
| ステータス | ACTIVE |
| 関連要件 | [requirements/app-docker-release/index.md](../../requirements/app-docker-release/index.md) |

## アーキテクチャ概要

```text
git tag v0.2.0 && git push --tags
        ↓
.github/workflows/release.yml が起動
        ↓
 ┌──────────────────────────────────┐
 │  release job (ubuntu-latest)     │
 │  ├─ Docker マルチプラットフォームビルド │
 │  │   ├─ linux/amd64             │
 │  │   └─ linux/arm64             │
 │  ├─ GHCRへpush                  │
 │  │   ├─ ghcr.io/<owner>/claude-work:0.2.0 │
 │  │   ├─ ghcr.io/<owner>/claude-work:0.2   │
 │  │   ├─ ghcr.io/<owner>/claude-work:0     │
 │  │   └─ ghcr.io/<owner>/claude-work:latest│
 │  └─ GitHub Release作成          │
 │      └─ 自動リリースノート生成   │
 └──────────────────────────────────┘
```

## 作成ファイル

| ファイル | 役割 |
|---------|------|
| `Dockerfile` | アプリ本体のマルチステージビルド定義 |
| `.dockerignore` | Dockerビルドコンテキスト除外設定 |
| `.github/workflows/release.yml` | リリースワークフロー |

## Dockerfile 設計

### マルチステージビルド構成

```text
Stage 1: base
  └─ node:20-slim
  └─ ネイティブモジュールビルドツール（python3, make, g++）
  └─ pnpm@9 インストール

Stage 2: deps-prod（本番用依存関係のみ）
  └─ pnpm install --prod --frozen-lockfile
  ※ better-sqlite3, node-pty がここでコンパイルされる

Stage 3: deps-all（ビルド用の全依存関係）
  └─ pnpm install --frozen-lockfile

Stage 4: builder（アプリビルド）
  └─ deps-allのnode_modulesを使用
  └─ pnpm run build（Next.js + TypeScriptサーバー）
  └─ DATABASE_URL=file:/tmp/build.db（ビルド用の一時DB）

Stage 5: runner（本番実行環境）
  └─ node:20-slim（最小イメージ）
  └─ deps-prodのnode_modulesのみコピー（devDeps除外）
  └─ builderの dist/, .next/ をコピー
  └─ /data をVOLUME（SQLiteデータ永続化）
  └─ USER node（非rootユーザー実行）
```

### 環境変数

| 変数 | デフォルト | 説明 |
|-----|---------|------|
| `PORT` | `3000` | アプリケーションポート |
| `DATABASE_URL` | `file:/data/claudework.db` | SQLiteファイルパス |
| `NODE_ENV` | `production` | Node.js実行モード |
| `DATA_DIR` | `/data` | データディレクトリ |

### ボリューム

| マウントパス | 内容 |
|------------|------|
| `/data` | SQLiteデータファイル、環境設定（永続化が必要） |

### ポート

| ポート | プロトコル | 説明 |
|-------|---------|------|
| `3000` | TCP | HTTPアプリケーションサーバー |

### 使用例

```bash
docker run -d \
  -p 3000:3000 \
  -v ./claude-work-data:/data \
  ghcr.io/<owner>/claude-work:latest
```

## release.yml 設計

### トリガー

```yaml
on:
  push:
    tags:
      - 'v*'
```

`v0.2.0` のようなタグをpushすると起動。

### 必要なパーミッション

```yaml
permissions:
  contents: write   # GitHub Release作成に必要
  packages: write   # GHCRへのpushに必要
```

### Dockerタグ戦略

`v0.2.0` タグpush時:
- `ghcr.io/<owner>/claude-work:0.2.0`（完全バージョン）
- `ghcr.io/<owner>/claude-work:0.2`（マイナーバージョン）
- `ghcr.io/<owner>/claude-work:0`（メジャーバージョン）
- `ghcr.io/<owner>/claude-work:latest`（最新版）

### GitHub Release

- `softprops/action-gh-release@v2` を使用
- `generate_release_notes: true` で前回タグ以降のPR・コミットを自動収集
- `make_latest: true` で最新リリースとしてマーク

### ビルドキャッシュ

- GitHub Actions Cache（`type=gha`）を使用
- `cache-to: type=gha,mode=max` でレイヤーを最大限キャッシュ

## .dockerignore 設計

ビルドコンテキストから除外するもの:
- `.git/`, `.gitignore`
- `node_modules/`（コンテナ内で再インストールする）
- `data/`（ランタイムデータ）
- `.next/`（コンテナ内でビルドする）
- `dist/`（コンテナ内でビルドする）
- `.env`（シークレットを含む可能性がある）
- `docker/`（サンドボックス用の別Dockerfile）
- `logs/`, `*.log`
- テストファイル（`**/__tests__/`, `*.test.ts`）
- `docs/`（ドキュメントは不要）
- `.worktrees/`（Gitワークツリー）

## セキュリティ考慮事項

1. 非rootユーザー実行: `USER node`（UID 1000）
2. 認証: `GITHUB_TOKEN`のみ使用（外部シークレット不要）
3. `.env`ファイルはDockerビルドコンテキストから除外
4. ネイティブモジュールビルドツール（python3, make, g++）は`base`ステージのみに存在し、最終`runner`ステージには含まない

## 逆順レビュー: 要件との整合性

| 要件ID | 設計での対応 |
|-------|------------|
| FR-001 | release.yml の `on.push.tags: v*` |
| FR-002 | `docker/build-push-action` でGHCRへpush |
| FR-003 | builderステージで `pnpm run build`（next + server） |
| FR-004 | 5ステージのマルチステージビルド |
| FR-005 | `softprops/action-gh-release` の `generate_release_notes: true` |
| FR-006 | `ghcr.io/<owner>/claude-work` |
| FR-007 | `docker/metadata-action` のsemverタグ戦略 |
| FR-008 | `platforms: linux/amd64,linux/arm64` |
| FR-009 | `/data` ボリューム + `DATABASE_URL=file:/data/claudework.db` |
| FR-010 | `EXPOSE 3000` + `PORT=3000` |
