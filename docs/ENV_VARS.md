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
- **備考**: Docker Compose環境では `docker-compose.yml` の `environment` および Dockerfile の `ENV` で `DATA_DIR=/data` が設定されており、ボリュームマウント先 `/data` と一致します

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
- **備考**: Docker Compose環境ではサンドボックスコンテナ内に Claude CLI がプリインストールされているため、通常は設定不要（アプリコンテナ自体には含まれない）

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
- **例**: `DOCKER_IMAGE_NAME=ghcr.io/windschord/claude-work-sandbox`
- **デフォルト**: `ghcr.io/windschord/claude-work-sandbox`

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
- **デフォルト**: `false`（未設定時。Docker Compose環境では`docker-compose.yml`で`true`に設定済み）
- **備考**: `true`に設定すると、セッション作成UIにレガシーDockerモードオプションが表示されます。新しい実行環境機能では、環境ごとにDocker利用の有無を設定できます。

### RUNNING_IN_DOCKER

- **説明**: アプリケーションがDockerコンテナ内で動作していることを明示的に指定。`true` に設定するとDocker内動作と判定される。`/.dockerenv` ファイルの存在でも自動検出される
- **形式**: `true` | 未設定
- **例**: `RUNNING_IN_DOCKER=true`
- **デフォルト**: 未設定
- **備考**: `docker-compose.yml` で自動設定済み（`true`）。未設定の場合でも `/.dockerenv` ファイルが存在すればDocker内と判定される

### ALLOW_HOST_ENVIRONMENT

- **説明**: Dockerコンテナ内でもHOST環境の作成・利用を許可する。`true` に設定するとHOST環境が利用可能になる。Docker-in-Dockerやホストネットワークモードなど特殊な構成向け
- **形式**: `true` | 未設定
- **例**: `ALLOW_HOST_ENVIRONMENT=true`
- **デフォルト**: 未設定（Docker内ではHOST環境無効）
- **備考**: `docker-compose.yml` にコメントアウト状態で記載。通常のDocker Compose環境では設定不要

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

## Docker Compose 固有の環境変数

Docker Compose（`docker compose up`）で起動する場合に使用する環境変数です。`docker-compose.yml` 内で参照されます。

### HOST_PORT

- **説明**: ホスト側にマッピングするポート番号。コンテナ内部は常に `PORT=3000` で動作する
- **形式**: 整数（1024-65535）
- **例**: `HOST_PORT=3001`
- **デフォルト**: `3000`
- **備考**: `docker-compose.yml` の `ports` セクションで使用される。ホストのポート3000が使用中の場合に変更する

### DOCKER_GID

- **説明**: ホストの docker グループの GID。コンテナ内の `node` ユーザーが `/var/run/docker.sock` にアクセスするために必要
- **形式**: 整数（GID）
- **例**: `DOCKER_GID=999`
- **デフォルト**: なし（Linux では必須。未設定の場合、`docker-compose.yml` のフォールバック値 `0` が使用され、コンテナ内の `node` ユーザーがrootグループに追加されます）
- **取得方法**: `stat -c '%g' /var/run/docker.sock`
- **備考**: `docker-compose.yml` の `group_add` で使用される。Linux 環境ではホストの docker グループ GID を必ず設定してください。macOS の Docker Desktop では docker.sock のパーミッションが異なるため通常は設定不要です

### リモートリポジトリのクローン先

リモートリポジトリのクローン先は `DATA_DIR` から `${DATA_DIR}/repos` として自動算出されます（デフォルト: `/data/repos`）。個別に変更する環境変数は現在提供されていません。

### Docker Compose のケーパビリティ設定

`docker-compose.yml` では以下の Linux ケーパビリティが追加されます:

| ケーパビリティ | 用途 |
|--------------|------|
| `NET_ADMIN` | ネットワークフィルタリング機能でiptablesの `DOCKER-USER` チェーンを管理するために必要。サンドボックスコンテナからの外部通信を制御する |

> **セキュリティ注意**: `NET_ADMIN` はネットワーク設定変更権限を与えます。ClaudeWorkはこの権限をiptablesによるサンドボックスコンテナのネットワーク制御のみに使用します。

### Docker Compose のボリュームマウント

`docker-compose.yml` では以下のボリュームがマウントされます:

| ボリューム | コンテナパス | 用途 |
|-----------|------------|------|
| `claudework-data` (named volume) | `/data` | SQLiteデータベース、環境認証情報 |
| `/var/run/docker.sock` | `/var/run/docker.sock` | ホストのDockerデーモンへのアクセス |

> **開発者向け**: `docker-compose.override.yml` で `./data:/data` バインドマウントに切り替えることも可能です。

`docker.sock` のマウントにより、ClaudeWorkコンテナからホストのDockerデーモンを操作し、サンドボックスコンテナ（Claude Code実行用）を起動・管理できます。

> **セキュリティ警告**: `/var/run/docker.sock` のマウントはホストの Docker デーモンへのフルアクセスを許可するため、信頼できる環境でのみ使用してください。本番環境では [Rootless Docker](https://docs.docker.com/engine/security/rootless/) やソケットプロキシの導入を検討してください。

## 設定例

### .env ファイル

```env
HOST_PORT=3000
LOG_LEVEL=info
# HOST_PORT を変更した場合は ALLOWED_ORIGINS のポート番号も合わせること
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_PROJECT_DIRS=/data/repos
```

### コマンドライン

```bash
HOST_PORT=3001 docker compose up -d
```

