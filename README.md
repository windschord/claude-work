# ClaudeWork

Claude Codeを使用した複数セッション並列作業管理のためのWebアプリケーション

## プロジェクト概要

ClaudeWorkは、Claude Codeのセッションを複数同時に実行し、Git worktreeを活用した独立した作業環境で並列作業を実現するWebアプリケーションです。リアルタイムのClaude Code出力表示、ターミナル統合、差分表示などの機能を提供します。

## 主な機能

- **プロジェクト管理**: Gitリポジトリベースのプロジェクト管理（CRUD操作）
- **セッション管理**: 複数のClaude Codeセッションの並列実行
- **Claude Codeとの対話**: リアルタイムでの入力と出力表示
- **Git操作**: worktree管理、rebase、squash merge対応
- **差分表示**: react-diff-viewerによる変更の可視化
- **ターミナル統合**: XTerm.jsによるブラウザ内ターミナル
- **テーマ切替**: ライト/ダークモード対応
- **レスポンシブUI**: モバイル端末にも対応

## プロジェクト構造

```
.
├── frontend/          # Next.js 14フロントエンド
├── backend/           # Python FastAPIバックエンド
├── docs/              # プロジェクトドキュメント
├── data/              # データベースファイル
└── package.json       # ルートパッケージ設定（workspaces）
```

## 技術スタック

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript 5
- Tailwind CSS 3
- Zustand (状態管理)
- React Hook Form
- XTerm.js (ターミナル)
- react-diff-viewer-continued (差分表示)
- react-markdown (マークダウン表示)

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy 2.0 (ORM)
- Alembic (マイグレーション)
- aiosqlite (非同期SQLite)
- WebSocket (リアルタイム通信)
- structlog (構造化ログ)

## セットアップ

### 前提条件
- Node.js 20以上
- Python 3.11以上
- Git 2.30以上
- uv (Pythonパッケージマネージャ)

### リポジトリのクローン

```bash
git clone <repository-url>
cd claude-work
```

### 依存関係のインストール

#### フロントエンド
```bash
npm install
```

#### バックエンド
```bash
cd backend
uv sync
```

### 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
# .env.exampleをコピー
cp .env.example .env

# 必要に応じて編集
nano .env
```

#### 必須の環境変数

| 変数名 | 説明 | デフォルト値 | 例 |
|--------|------|------------|-----|
| `AUTH_TOKEN` | 認証トークン（セキュアなランダム文字列） | - | `openssl rand -hex 32`で生成 |
| `DATABASE_URL` | データベース接続URL | `sqlite+aiosqlite:///./data/claudework.db` | SQLiteファイルパス |
| `CORS_ORIGINS` | CORSで許可するオリジン | `http://localhost:3000` | カンマ区切りで複数指定可 |
| `NEXT_PUBLIC_API_URL` | バックエンドAPIのURL | `http://localhost:8000` | - |
| `NEXT_PUBLIC_WS_URL` | WebSocketのURL | `ws://localhost:8000` | - |
| `GIT_REPOS_PATH` | Gitリポジトリのベースパス | `/home` | `/home/username/projects` |

#### オプションの環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `LOG_LEVEL` | ログレベル (debug/info/warning/error) | `info` |

### 開発サーバーの起動

#### フロントエンドのみ
```bash
# ルートディレクトリから
npm run dev:frontend

# または frontend ディレクトリで
cd frontend
npm run dev
```

開発サーバーは http://localhost:3000 で起動します

#### バックエンドのみ
```bash
# ルートディレクトリから
npm run dev:backend

# または backend ディレクトリで
cd backend
uv run uvicorn app.main:app --reload
```

APIサーバーは http://localhost:8000 で起動します
APIドキュメント: http://localhost:8000/docs

#### フロントエンドとバックエンドを同時起動
```bash
npm run dev
```

### Docker Composeでの起動

```bash
# 環境変数を設定
cp .env.example .env
nano .env

# コンテナをビルドして起動
docker-compose up -d

# ログを確認
docker-compose logs -f

# 停止
docker-compose down
```

アクセス先:
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- APIドキュメント: http://localhost:8000/docs

## API仕様概要

### 認証エンドポイント
- `POST /api/auth/login`: ログイン
- `POST /api/auth/logout`: ログアウト

### プロジェクト管理
- `GET /api/projects`: プロジェクト一覧取得
- `POST /api/projects`: プロジェクト作成
- `GET /api/projects/{id}`: プロジェクト詳細取得
- `PUT /api/projects/{id}`: プロジェクト更新
- `DELETE /api/projects/{id}`: プロジェクト削除

### セッション管理
- `GET /api/sessions`: セッション一覧取得
- `POST /api/sessions`: セッション作成
- `GET /api/sessions/{id}`: セッション詳細取得
- `PUT /api/sessions/{id}`: セッション更新
- `DELETE /api/sessions/{id}`: セッション削除
- `POST /api/sessions/{id}/start`: セッション開始
- `POST /api/sessions/{id}/stop`: セッション停止

### Git操作
- `GET /api/git/diff`: 差分取得
- `POST /api/git/rebase`: rebase実行
- `POST /api/git/squash-merge`: squash merge実行

### WebSocket
- `WS /ws/sessions/{id}`: セッション用WebSocket（Claude Code通信）
- `WS /ws/sessions/{id}/terminal`: ターミナル用WebSocket

### その他
- `GET /health`: ヘルスチェック
- `GET /`: APIルート情報

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

## トラブルシューティング

### データベースの初期化

データベースに問題がある場合は、以下のコマンドで再初期化できます：

```bash
cd backend
rm -f data/claudework.db
uv run alembic upgrade head
```

### ポートが既に使用されている場合

別のプロセスがポートを使用している場合は、プロセスを終了するか、別のポートを使用してください：

```bash
# 使用中のプロセスを確認
lsof -i :3000  # フロントエンド
lsof -i :8000  # バックエンド

# プロセスを終了
kill -9 <PID>
```

### Docker Composeでボリュームエラーが発生する場合

```bash
# ボリュームを削除して再作成
docker-compose down -v
docker-compose up -d
```

## ライセンス

このプロジェクトのライセンスについては、プロジェクトオーナーにお問い合わせください。

## 貢献

貢献を歓迎します。プルリクエストを送信する前に、以下を確認してください：

1. コードがリンターを通過すること
2. テストが全て成功すること
3. コミットメッセージが明確であること
