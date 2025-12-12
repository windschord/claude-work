# ClaudeWork

ClaudeWorkプロジェクトのmonorepo構成

## プロジェクト構造

```
.
├── frontend/          # Next.js 14フロントエンド
├── backend/           # Python FastAPIバックエンド
├── docs/              # プロジェクトドキュメント
└── package.json       # ルートパッケージ設定（workspaces）
```

## 技術スタック

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript 5
- Tailwind CSS 3

### Backend
- Python 3.11+
- FastAPI
- uvicorn
- uv (パッケージマネージャ)

## セットアップ

### 前提条件
- Node.js 20+
- Python 3.11+
- uv (Python パッケージマネージャ)

### インストール

```bash
# フロントエンドの依存関係をインストール
npm install

# バックエンドの依存関係をインストール
cd backend
uv sync
```

## 開発サーバーの起動

### フロントエンド
```bash
# ルートディレクトリから
npm run dev:frontend

# または frontend ディレクトリで
cd frontend
npm run dev
```

開発サーバーは http://localhost:3000 で起動します

### バックエンド
```bash
# ルートディレクトリから
npm run dev:backend

# または backend ディレクトリで
cd backend
uv run uvicorn main:app --reload
```

APIサーバーは http://localhost:8000 で起動します
APIドキュメント: http://localhost:8000/docs

### 両方を同時起動
```bash
npm run dev
```

## プロジェクト初期化の確認

以下の受入基準を満たしています:

- [x] `package.json`がルートに存在し、workspaces設定がある
- [x] `frontend/package.json`が存在する
- [x] `frontend/`で`npm run dev`が起動する（依存関係インストール後）
- [x] `backend/pyproject.toml`が存在する
- [x] `backend/`で`uv run uvicorn main:app`が起動する
- [x] `.gitignore`が適切に設定されている

## APIエンドポイント

### バックエンド
- `GET /`: ウェルカムメッセージ
- `GET /health`: ヘルスチェック

## テスト

### E2Eテスト（Playwright）

E2Eテストはフロントエンドとバックエンドの統合テストを提供します。

#### テストの実行

```bash
# フロントエンドディレクトリに移動
cd frontend

# E2Eテストを実行（ヘッドレスモード）
npm run e2e

# UIモードで実行（対話的）
npm run e2e:ui

# ヘッドモードで実行（ブラウザが表示される）
npm run e2e:headed

# デバッグモード
npm run e2e:debug
```

#### 前提条件

E2Eテストを実行するには、以下の環境変数を設定してください：

```bash
# .env ファイルに以下を設定
AUTH_TOKEN=test-token-for-e2e
```

テストはフロントエンドとバックエンドを自動的に起動します（playwright.config.tsのwebServer設定）。

#### テストファイル

- `e2e/login.spec.ts`: ログインフローのテスト
- `e2e/projects.spec.ts`: プロジェクト管理のテスト
- `e2e/sessions.spec.ts`: セッション管理のテスト

#### テスト用フィクスチャ

- `e2e/fixtures/auth.ts`: 認証ヘルパー
- `e2e/fixtures/git-repo.ts`: テスト用Gitリポジトリ管理

## 開発ガイドライン

- コミットは親エージェントが行います
- 絵文字は使用しません
- TDD（テスト駆動開発）を推奨します
