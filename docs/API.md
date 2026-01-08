# API 仕様概要

ClaudeWork の REST API とWebSocket API の概要です。

## セッション API

### セッション一覧取得

```http
GET /api/sessions
```

**レスポンス**:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "name": "session-name",
      "repoUrl": "https://github.com/user/repo.git",
      "branch": "main",
      "status": "running",
      "containerId": "container-id",
      "volumeName": "volume-name",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### セッション作成

```http
POST /api/sessions
Content-Type: application/json

{
  "name": "session-name",
  "repoUrl": "https://github.com/user/repo.git",
  "branch": "main"
}
```

**レスポンス**:
```json
{
  "id": "uuid",
  "name": "session-name",
  "repoUrl": "https://github.com/user/repo.git",
  "branch": "main",
  "status": "created",
  "containerId": null,
  "volumeName": "claudework-session-name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### セッション取得

```http
GET /api/sessions/{id}
```

### セッション削除

```http
DELETE /api/sessions/{id}
```

セッションとそれに関連するコンテナ、ボリュームを削除します。

## セッションアクション API

### コンテナ起動

```http
POST /api/sessions/{id}/start
```

セッションのDockerコンテナを起動します。

**レスポンス**:
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "status": "running",
    "containerId": "container-id"
  }
}
```

### コンテナ停止

```http
POST /api/sessions/{id}/stop
```

セッションのDockerコンテナを停止します。

**レスポンス**:
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "status": "stopped",
    "containerId": "container-id"
  }
}
```

### コンテナ再起動

```http
POST /api/sessions/{id}/restart
```

セッションのDockerコンテナを再起動します。

## WebSocket API

### Docker セッション WebSocket

Dockerコンテナ内のターミナルとの対話用。XTerm.js と連携し、Claude Code を直接操作します。

```http
ws://localhost:3000/ws/session/{sessionId}
```

**接続時**:
- コンテナが起動していない場合は自動的に起動
- `docker exec` で PTY セッションを作成
- ターミナル出力をWebSocket経由でクライアントに送信

**メッセージ形式**:

クライアント -> サーバー:
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

サーバー -> クライアント:
```json
{
  "type": "data",
  "content": "raw terminal output"
}
```

```json
{
  "type": "exit",
  "exitCode": 0
}
```

```json
{
  "type": "error",
  "message": "error description"
}
```

**特徴**:
- `docker exec` で PTY セッションを作成
- ターミナル出力は加工なしでクライアントに送信
- XTerm.js がターミナルエミュレーションを担当
- リサイズメッセージでターミナルサイズを同期
- 接続切断時にPTYセッションを自動クリーンアップ

## ステータス値

セッションの `status` フィールドは以下の値を取ります:

| ステータス | 説明 |
|-----------|------|
| `created` | セッション作成済み、コンテナ未起動 |
| `running` | コンテナ実行中 |
| `stopped` | コンテナ停止中 |
| `error` | エラー発生 |

## エラーレスポンス

すべてのAPIは以下の形式でエラーを返します:

```json
{
  "error": "Error message description"
}
```

| HTTPステータス | 説明 |
|---------------|------|
| 400 | リクエストパラメータが不正 |
| 404 | セッションが見つからない |
| 500 | サーバー内部エラー |
