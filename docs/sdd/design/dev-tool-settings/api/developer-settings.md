# API: Developer Settings

## 概要

**ベースパス**: `/api/developer-settings`
**目的**: Git設定（username, email）の管理API（グローバル設定とプロジェクト別設定）

## 情報の明確性

### 明示された情報
- 認証方式: 現時点では認証なし（将来的に実装予定）
- レート制限: なし
- エラーレスポンス形式: 統一されたJSON形式

### 不明/要確認の情報

なし（すべて確認済み）

---

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/developer-settings/global | グローバルGit設定取得 |
| PUT | /api/developer-settings/global | グローバルGit設定更新 |
| GET | /api/developer-settings/project/:projectId | プロジェクト別Git設定取得 |
| PUT | /api/developer-settings/project/:projectId | プロジェクト別Git設定更新 |
| DELETE | /api/developer-settings/project/:projectId | プロジェクト別Git設定削除 |

---

## GET /api/developer-settings/global

**説明**: グローバルGit設定を取得（全プロジェクト共通のデフォルト設定）

### リクエスト

**ヘッダー**: なし

**クエリパラメータ**: なし

### レスポンス

**成功時 (200 OK)**:
```json
{
  "id": "uuid",
  "scope": "GLOBAL",
  "git_username": "john.doe",
  "git_email": "john@example.com",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**設定が存在しない場合 (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "グローバル設定が見つかりません"
  }
}
```

---

## PUT /api/developer-settings/global

**説明**: グローバルGit設定を更新（存在しない場合は新規作成）

### リクエスト

**ヘッダー**:
| ヘッダー | 必須 | 説明 |
|---------|------|------|
| Content-Type | Yes | application/json |

**ボディ**:
```json
{
  "git_username": "john.doe",
  "git_email": "john@example.com"
}
```

### バリデーションルール

| フィールド | ルール |
|-----------|--------|
| git_username | 任意、1-100文字 |
| git_email | 任意、メールアドレス形式（RFC 5322準拠） |

**注意**: 両方のフィールドがnullまたは空文字の場合はエラー

### レスポンス

**成功時 (200 OK)**:
```json
{
  "id": "uuid",
  "scope": "GLOBAL",
  "git_username": "john.doe",
  "git_email": "john@example.com",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**バリデーションエラー (400 Bad Request)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Git Email の形式が正しくありません",
    "details": {
      "field": "git_email",
      "value": "invalid-email"
    }
  }
}
```

---

## GET /api/developer-settings/project/:projectId

**説明**: プロジェクト別Git設定を取得（存在しなければグローバル設定を返す）

### リクエスト

**パスパラメータ**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| projectId | string (UUID) | プロジェクトID |

**ヘッダー**: なし

**クエリパラメータ**: なし

### レスポンス

**成功時 (200 OK) - プロジェクト設定が存在する場合**:
```json
{
  "id": "uuid",
  "scope": "PROJECT",
  "project_id": "project-uuid",
  "git_username": "work.user",
  "git_email": "work@company.com",
  "created_at": "2024-01-10T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "effective_settings": {
    "git_username": "work.user",
    "git_email": "work@company.com",
    "source": "project"
  }
}
```

**成功時 (200 OK) - プロジェクト設定が存在せず、グローバル設定を適用**:
```json
{
  "id": null,
  "scope": "PROJECT",
  "project_id": "project-uuid",
  "git_username": null,
  "git_email": null,
  "created_at": null,
  "updated_at": null,
  "effective_settings": {
    "git_username": "john.doe",
    "git_email": "john@example.com",
    "source": "global"
  }
}
```

**プロジェクトが存在しない場合 (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "プロジェクトが見つかりません"
  }
}
```

---

## PUT /api/developer-settings/project/:projectId

**説明**: プロジェクト別Git設定を更新（存在しない場合は新規作成）

### リクエスト

**パスパラメータ**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| projectId | string (UUID) | プロジェクトID |

**ヘッダー**:
| ヘッダー | 必須 | 説明 |
|---------|------|------|
| Content-Type | Yes | application/json |

**ボディ**:
```json
{
  "git_username": "work.user",
  "git_email": "work@company.com"
}
```

### バリデーションルール

| フィールド | ルール |
|-----------|--------|
| git_username | 任意、1-100文字 |
| git_email | 任意、メールアドレス形式（RFC 5322準拠） |

### レスポンス

**成功時 (200 OK)**:
```json
{
  "id": "uuid",
  "scope": "PROJECT",
  "project_id": "project-uuid",
  "git_username": "work.user",
  "git_email": "work@company.com",
  "created_at": "2024-01-10T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**プロジェクトが存在しない場合 (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "プロジェクトが見つかりません"
  }
}
```

---

## DELETE /api/developer-settings/project/:projectId

**説明**: プロジェクト別Git設定を削除（グローバル設定にフォールバック）

### リクエスト

**パスパラメータ**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| projectId | string (UUID) | プロジェクトID |

**ヘッダー**: なし

### レスポンス

**成功時 (204 No Content)**:
```
（レスポンスボディなし）
```

**設定が存在しない場合 (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "プロジェクト設定が見つかりません"
  }
}
```

---

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| VALIDATION_ERROR | 400 | 入力値エラー（メール形式不正等） |
| NOT_FOUND | 404 | リソースが見つからない |
| INTERNAL_ERROR | 500 | サーバー内部エラー |

## セキュリティ

- **認証**: 現時点では認証なし（将来的に実装予定）
- **認可**: なし
- **レート制限**: なし
- **CORS**: Next.js のデフォルト設定を使用

## 関連コンポーネント

- [DeveloperSettingsService](../components/developer-settings-service.md) @../components/developer-settings-service.md: 設定の保存・読み取り・優先順位解決
- [DeveloperSettings テーブル](../database/schema.md#developersettings) @../database/schema.md: データ永続化

## 関連要件

- [US-001](../../requirements/dev-tool-settings/stories/US-001.md) @../../requirements/dev-tool-settings/stories/US-001.md: グローバル Git 設定の管理
- [US-002](../../requirements/dev-tool-settings/stories/US-002.md) @../../requirements/dev-tool-settings/stories/US-002.md: プロジェクト別 Git 設定の上書き
- [NFR-PERF-001](../../requirements/dev-tool-settings/nfr/performance.md) @../../requirements/dev-tool-settings/nfr/performance.md: 設定読み込み性能（100ms以内）
