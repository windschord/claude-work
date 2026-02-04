# 環境変数リファレンス

ClaudeWork で使用可能な環境変数の一覧です。

## オプション環境変数

### CLAUDE_WORK_TOKEN

- **説明**: 認証トークン（現在は未使用）
- **形式**: 任意の文字列（推奨: 32文字以上のランダム文字列）
- **例**: `CLAUDE_WORK_TOKEN="my-secret-token-12345678"`
- **デフォルト**: なし

### SESSION_SECRET

- **説明**: セッション暗号化用のシークレットキー（現在は未使用）
- **形式**: 任意の文字列（32文字以上推奨）
- **例**: `SESSION_SECRET="your-32-character-or-longer-secret-key-here"`
- **デフォルト**: なし

### PORT

- **説明**: サーバーポート
- **形式**: 整数（1024-65535）
- **例**: `PORT=3000`
- **デフォルト**: `3000`

### HOST

- **説明**: サーバーがバインドするホスト/IPアドレス
- **形式**: IPアドレスまたはホスト名
- **例**: `HOST=0.0.0.0`（全インターフェースでリッスン）
- **デフォルト**: `localhost`（ローカルのみ）
- **注意**: 外部からのアクセスを許可する場合は `0.0.0.0` を設定してください

### DATABASE_URL

- **説明**: SQLite データベースパス
- **形式**: `file:../path/to/database.db`（prisma/schema.prisma からの相対パス）
- **例**: `DATABASE_URL="file:../data/claudework.db"`（→ プロジェクトルートの `data/claudework.db`）
- **デフォルト**: `file:../data/claudework.db`

### NODE_ENV

- **説明**: 実行環境
- **形式**: `development` | `production` | `test`
- **例**: `NODE_ENV=production`
- **デフォルト**: `development`

### LOG_LEVEL

- **説明**: ログレベル
- **形式**: `error` | `warn` | `info` | `debug`
- **例**: `LOG_LEVEL=info`
- **デフォルト**: `info`

### ALLOWED_ORIGINS

- **説明**: CORS許可オリジン
- **形式**: カンマ区切りの URL リスト
- **例**: `ALLOWED_ORIGINS="http://localhost:3000,https://example.com"`
- **デフォルト**: なし

### ALLOWED_PROJECT_DIRS

- **説明**: 許可するプロジェクトディレクトリ
- **形式**: カンマ区切りのディレクトリパスリスト
- **例**: `ALLOWED_PROJECT_DIRS="/home/user/projects,/opt/repos"`
- **デフォルト**: なし（すべてのディレクトリを許可）

### PROCESS_IDLE_TIMEOUT_MINUTES

- **説明**: アイドル状態のClaude Codeプロセスを自動的に一時停止するまでの時間（分）
- **形式**: 整数（0 = 無効、5以上の値を推奨）
- **例**: `PROCESS_IDLE_TIMEOUT_MINUTES=30`
- **デフォルト**: `30`
- **備考**: 5分未満の値は自動的に5分に補正されます。0を設定するとアイドルタイムアウトは無効になります。

## Docker関連環境変数

### DOCKER_IMAGE_NAME

- **説明**: Docker統合機能で使用するイメージ名
- **形式**: 有効なDockerイメージ名
- **例**: `DOCKER_IMAGE_NAME=claude-code-sandboxed`
- **デフォルト**: `claude-code-sandboxed`

### DOCKER_IMAGE_TAG

- **説明**: Docker統合機能で使用するイメージタグ
- **形式**: 有効なDockerタグ
- **例**: `DOCKER_IMAGE_TAG=latest`
- **デフォルト**: `latest`

### DOCKER_MAX_CONTAINERS

- **説明**: 同時に実行可能なDockerコンテナ数の上限
- **形式**: 正の整数
- **例**: `DOCKER_MAX_CONTAINERS=5`
- **デフォルト**: `5`

### DOCKER_ENABLED

- **説明**: Docker統合機能の有効/無効（レガシー設定）
- **形式**: `true` | `false`
- **例**: `DOCKER_ENABLED=true`
- **デフォルト**: `true`
- **備考**: `false`に設定すると、レガシーDockerモードのセッション作成が無効になります。新しい実行環境機能では、環境ごとにDocker利用の有無を設定できます。

## 実行環境関連

### 概要

実行環境機能では、Claude Codeをローカル（HOST）、Docker、SSH（未実装）で実行できます。各環境は独立した認証情報を持ち、セッションごとに実行環境を選択できます。

### 認証ディレクトリ

Docker環境では、環境ごとに独立した認証ディレクトリが作成されます:
- パス: `data/environments/<environment-id>/`
- サブディレクトリ:
  - `claude/`: Claude認証情報
  - `config/claude/`: Claude設定ファイル

### 注意事項

- レガシーの`dockerMode`パラメータは非推奨です。新しい`environment_id`パラメータを使用してください
- デフォルトHOST環境はサーバー起動時に自動作成されます
- 既存の`docker_mode=true`セッションは、マイグレーションスクリプト（`npm run db:migrate-environments`）でレガシーDocker環境に移行できます

## 設定例

### .env ファイル

```env
PORT=3000
DATABASE_URL=file:../data/claudework.db
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_PROJECT_DIRS=/home/user/projects
PROCESS_IDLE_TIMEOUT_MINUTES=30

# Docker統合機能（オプション）
DOCKER_IMAGE_NAME=claude-code-sandboxed
DOCKER_IMAGE_TAG=latest
DOCKER_MAX_CONTAINERS=5
DOCKER_ENABLED=true
```

### コマンドライン

```bash
PORT=3001 npx claude-work
```
