# API設計: Session API拡張

## 概要

セッションAPIのレスポンスにChromeサイドカー情報（コンテナID、デバッグポート）を追加する。

## 対応要件

REQ-004-002, REQ-004-003

## 変更エンドポイント

### GET /api/sessions/:id

レスポンスに chrome_container_id と chrome_debug_port を追加する。

#### レスポンス例 (サイドカーあり)

```json
{
  "id": "abc-123",
  "name": "my-session",
  "status": "running",
  "container_id": "claude-env-xxx-12345",
  "chrome_container_id": "cw-chrome-abc-123",
  "chrome_debug_port": 32789,
  ...
}
```

#### レスポンス例 (サイドカーなし)

```json
{
  "id": "abc-123",
  "name": "my-session",
  "status": "running",
  "container_id": "claude-env-xxx-12345",
  "chrome_container_id": null,
  "chrome_debug_port": null,
  ...
}
```

### GET /api/projects/:id/sessions

セッション一覧のレスポンスにも同様に chrome_container_id と chrome_debug_port を含める。

### DELETE /api/sessions/:id

セッション削除時、DockerAdapter.destroySession がサイドカーのクリーンアップを担当するため、APIレイヤーでの追加処理は不要。

## アクセス制御

REQ-004-003 では「セッション所有者または管理者権限を持つユーザーのみ」にChrome情報の表示を制限する要件がある。

現状のclaude-workには認証/認可機能が存在しないため、以下の方針とする:

1. 現時点: chrome_debug_port は全セッションAPIレスポンスに含める
2. 将来の認証機能実装時: APIミドルウェアでユーザー権限を検証し、権限がない場合は chrome_debug_port を null にマスクする

この方針により、将来の認証機能追加時にAPIレスポンスの構造変更が不要となる。
