# API 仕様概要

ClaudeWork の REST API とWebSocket API の概要です。

## プロジェクト API

### プロジェクト一覧取得

```http
GET /api/projects
```

### プロジェクト追加

```http
POST /api/projects
Content-Type: application/json

{
  "path": "/path/to/git/repo"
}
```

### プロジェクト削除

```http
DELETE /api/projects/{id}
```

### リモートリポジトリクローン

リモートGitリポジトリをクローンしてプロジェクトとして登録します。

```http
POST /api/projects/clone
Content-Type: application/json

{
  "url": "git@github.com:user/repo.git",
  "name": "optional-name",
  "cloneLocation": "docker",
  "githubPatId": "pat-uuid"
}
```

**パラメータ**:
- `url` (required): リモートリポジトリURL（SSH または HTTPS）
- `name` (optional): プロジェクト名。未指定時はURLから自動抽出
- `cloneLocation` (optional): `docker` | `host`（デフォルト: `docker`）
- `githubPatId` (optional): GitHub PAT ID（HTTPS プライベートリポジトリ用）

**レスポンス** (201):
```json
{
  "project": {
    "id": "uuid",
    "name": "repo",
    "path": "/docker-volumes/claude-repo-{id}",
    "remote_url": "git@github.com:user/repo.git",
    "clone_location": "docker"
  }
}
```

**エラー**:
- 400: 無効なURL形式
- 409: 同じURLのプロジェクトが既に存在
- 500: クローン失敗

### リモートリポジトリ更新（Pull）

リモートリポジトリから最新の変更を取得します。

```http
POST /api/projects/{id}/pull
```

**レスポンス** (200):
```json
{
  "success": true,
  "updated": true,
  "message": "Successfully pulled from remote"
}
```

**エラー**:
- 400: リモートURLが未設定
- 404: プロジェクトが存在しない
- 500: Pull失敗

### ブランチ一覧取得

プロジェクトのブランチ一覧を取得します。

```http
GET /api/projects/{id}/branches
```

**レスポンス** (200):
```json
{
  "branches": [
    {
      "name": "main",
      "isDefault": true,
      "isRemote": false
    },
    {
      "name": "feature-branch",
      "isDefault": false,
      "isRemote": false
    },
    {
      "name": "origin/main",
      "isDefault": false,
      "isRemote": true
    }
  ]
}
```

**エラー**:
- 404: プロジェクトが存在しない
- 500: ブランチ取得失敗

## セッション API

### セッション一覧取得

```http
GET /api/projects/{id}/sessions
```

### セッション作成

```http
POST /api/projects/{id}/sessions
Content-Type: application/json

{
  "name": "session-name",
  "prompt": "initial prompt",
  "environment_id": "docker-env-id",
  "source_branch": "main",
  "claude_code_options": {
    "model": "claude-opus-4-5"
  },
  "custom_env_vars": {
    "MY_VAR": "value"
  }
}
```

**パラメータ**:
- `name` (optional): セッション名。未指定時は自動生成
- `prompt` (optional): 初期プロンプト
- `environment_id` (optional): 実行環境ID。プロジェクトに`environment_id`が設定されていない場合に有効
- `source_branch` (optional): 作業ブランチ名。未指定時はデフォルトブランチ
- `claude_code_options` (optional): Claude Code CLIオプション（`model`, `allowedTools`, `permissionMode`, `additionalFlags`）
- `custom_env_vars` (optional): カスタム環境変数（キーは`^[A-Z_][A-Z0-9_]*$`形式）
- `dockerMode` (deprecated): Docker モードで実行。`environment_id` を優先使用してください

**実行環境の決定優先順位**:
1. プロジェクトの`environment_id`（設定済みの場合は最優先）
2. リクエストの`environment_id`（プロジェクトに設定がない場合）
3. プロジェクトの`clone_location`に基づく自動選択（`docker`→デフォルトDocker環境）
4. `dockerMode=true`（レガシー互換）

### セッション削除

```http
DELETE /api/sessions/{id}
```

## Git 操作 API

### Diff 取得

```http
GET /api/sessions/{id}/diff
```

### Rebase 実行

```http
POST /api/sessions/{id}/rebase
```

### Squash Merge 実行

```http
POST /api/sessions/{id}/merge
Content-Type: application/json

{
  "commit_message": "Merge commit message"
}
```

## 実行環境 API

### 環境一覧取得

```http
GET /api/environments
GET /api/environments?includeStatus=true
```

**レスポンス**:
```json
{
  "environments": [
    {
      "id": "host-default",
      "name": "Local Host",
      "type": "HOST",
      "description": "ローカル環境で直接実行",
      "config": "{}",
      "is_default": true,
      "status": {
        "available": true,
        "authenticated": true
      }
    }
  ]
}
```

### 環境作成

```http
POST /api/environments
Content-Type: application/json

{
  "name": "My Docker Env",
  "type": "DOCKER",
  "description": "開発用Docker環境"
}
```

**環境タイプ**:
- `HOST`: ローカル環境で直接実行
- `DOCKER`: Dockerコンテナ内で実行（認証分離）
- `SSH`: リモートサーバーで実行（未実装）

### 環境取得

```http
GET /api/environments/{id}
GET /api/environments/{id}?includeStatus=true
```

### 環境更新

```http
PUT /api/environments/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### 環境削除

```http
DELETE /api/environments/{id}
```

**注意**:
- デフォルト環境は削除できません（400エラー）
- 使用中のセッションがある場合は409エラー

## ランタイムスクリプト API

### スクリプト一覧取得

```http
GET /api/projects/{id}/scripts
```

### スクリプト実行

```http
POST /api/sessions/{id}/execute
Content-Type: application/json

{
  "script_id": "script-uuid"
}
```

## WebSocket API

### Claude Code WebSocket (メイン)

Claude Code との対話用ターミナルセッション。XTerm.js と連携し、Claude Code の対話モードを直接操作します。

```http
ws://localhost:3000/ws/claude/{sessionId}
```

**メッセージ形式**:

クライアント → サーバー:
```json
{
  "type": "input",
  "data": "user input text"
}
```

```json
{
  "type": "resize",
  "cols": 80,
  "rows": 24
}
```

```json
{
  "type": "restart"
}
```

サーバー → クライアント:
```json
{
  "type": "data",
  "content": "raw terminal output from Claude Code"
}
```

```json
{
  "type": "exit",
  "exitCode": 0
}
```

**特徴**:
- Claude Code は対話モードで起動（`--print` フラグなし）
- ターミナル出力は加工なしでクライアントに送信
- XTerm.js がターミナルエミュレーションを担当
- リサイズメッセージでターミナルサイズを同期

### セッション WebSocket

セッションイベントとスクリプト実行用。

```http
ws://localhost:3000/ws/sessions/{id}
```

**メッセージ形式**:

クライアント → サーバー:
```json
{
  "type": "input",
  "content": "user message"
}
```

サーバー → クライアント:
```json
{
  "type": "output",
  "content": "script output"
}
```

### シェルターミナル WebSocket

シェルセッション用（bash/zsh等）。

```http
ws://localhost:3000/ws/terminal/{id}
```

**メッセージ形式**:

クライアント → サーバー:
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

サーバー → クライアント:
```json
{
  "type": "data",
  "content": "total 48\ndrwxr-xr-x ..."
}
```
