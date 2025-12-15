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

### セッション WebSocket

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
  "content": "claude response"
}
```

### ターミナル WebSocket

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
