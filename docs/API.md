# API 仕様概要

ClaudeWork の REST API とWebSocket API の概要です。

## 認証

すべての API リクエストには、セッションクッキーが必要です。

### ログイン

```http
POST /api/auth/login
Content-Type: application/json

{
  "token": "your-auth-token"
}
```

### ログアウト

```http
POST /api/auth/logout
```

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
  "model": "auto"
}
```

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
