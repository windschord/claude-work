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
- **形式**: `file:path/to/database.db`（相対パスまたは絶対パス）
- **例**: `DATABASE_URL="file:../data/claudework.db"`（→ プロジェクトルートの `data/claudework.db`）
- **デフォルト**: `file:../data/claudework.db`

### DATA_DIR

- **説明**: データディレクトリのベースパス。`repos/`（リモートリポジトリの clone 先）と `environments/`（Docker 環境の認証情報）の親ディレクトリを指定する
- **形式**: 絶対パスまたは相対パス
- **例**: `DATA_DIR=/opt/claude-work/data`
- **デフォルト**: `<process.cwd()>/data`（未設定時はカレントディレクトリ配下の `data/`）
- **備考**: systemd 環境では `npx` キャッシュの再構築時にカレントディレクトリ内のデータを消失する可能性があるため、`DATABASE_URL` と同じディレクトリ（例: `/opt/claude-work/data`）を指定することを推奨します

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

### CLAUDE_CODE_PATH

- **説明**: Claude Code CLI の実行ファイルパス
- **形式**: 絶対パス、またはPATH上のコマンド名
- **例**:
  - `CLAUDE_CODE_PATH=/usr/local/bin/claude`（絶対パス）
  - `CLAUDE_CODE_PATH=claude`（コマンド名、`which` で自動解決）
- **デフォルト**: なし（`which claude` で自動検出）
- **検出優先順位**:
  1. 設定済みの値が `existsSync()` でファイルとして存在する場合、そのまま使用
  2. 設定値が非絶対パス（コマンド名）の場合、`which` で解決を試みる
  3. 未設定の場合、`which claude` で PATH から自動検出
- **備考**: systemd 環境では `claude-work` ユーザーの PATH に `claude` が含まれない場合があり、絶対パスでの指定を推奨

### PROCESS_IDLE_TIMEOUT_MINUTES

- **説明**: アイドル状態のClaude Codeプロセスを自動的に一時停止するまでの時間（分）
- **形式**: 整数（0 = 無効、5以上の値を推奨）
- **例**: `PROCESS_IDLE_TIMEOUT_MINUTES=30`
- **デフォルト**: `30`
- **備考**: 5分未満の値は自動的に5分に補正されます。0を設定するとアイドルタイムアウトは無効になります。

### PTY_DESTROY_GRACE_PERIOD_MS

- **説明**: クライアントが全て切断した後、PTYセッションを破棄するまでの猶予期間（ミリ秒）
- **形式**: 正の整数、または `-1`（PTY破棄を無効化）
- **例**:
  - `PTY_DESTROY_GRACE_PERIOD_MS=300000`（5分）
  - `PTY_DESTROY_GRACE_PERIOD_MS=-1`（破棄しない）
- **デフォルト**: `300000`（5分）
- **備考**: `-1`を指定すると、クライアントが全て切断してもPTYセッションを永続的に維持します。不正な値（0以下、NaN等、ただし-1を除く）はデフォルト値にフォールバックします。

### SCROLLBACK_BUFFER_SIZE

- **説明**: セッションごとのスクロールバックバッファの最大サイズ（バイト数）
- **形式**: 正の整数
- **例**: `SCROLLBACK_BUFFER_SIZE=204800`（200KB）
- **デフォルト**: `102400`（100KB）
- **備考**: 新しいWebSocketクライアントが接続した際に、過去のターミナル出力を再送するために使用されるバッファのサイズです。不正な値（0以下、NaN等）はデフォルト値にフォールバックします。

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
- パス: `<DATA_DIR>/environments/<environment-id>/`（デフォルト: `data/environments/<environment-id>/`）
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
DATA_DIR=./data
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
