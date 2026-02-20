# API: SSH Keys

## 概要

**ベースパス**: `/api/ssh-keys`
**目的**: SSH鍵ペアの管理API（登録・一覧取得・削除）

## 情報の明確性

### 明示された情報
- 認証方式: 現時点では認証なし（将来的に実装予定）
- レート制限: なし
- エラーレスポンス形式: 統一されたJSON形式
- SSH鍵形式: OpenSSH形式（PEM/RFC4716）

### 不明/要確認の情報

なし（すべて確認済み）

---

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/ssh-keys | SSH鍵一覧取得 |
| POST | /api/ssh-keys | SSH鍵登録 |
| DELETE | /api/ssh-keys/:id | SSH鍵削除 |

---

## GET /api/ssh-keys

**説明**: 登録済みSSH鍵の一覧を取得（秘密鍵は含まない、公開鍵のみ）

### リクエスト

**ヘッダー**: なし

**クエリパラメータ**: なし

### レスポンス

**成功時 (200 OK)**:
```json
[
  {
    "id": "uuid-1",
    "name": "GitHub Personal",
    "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
    "has_passphrase": false,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": "uuid-2",
    "name": "Bitbucket Work",
    "public_key": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...",
    "has_passphrase": false,
    "created_at": "2024-01-20T14:30:00Z",
    "updated_at": "2024-01-20T14:30:00Z"
  }
]
```

**鍵が1つも登録されていない場合 (200 OK)**:
```json
[]
```

---

## POST /api/ssh-keys

**説明**: 新しいSSH鍵ペアを登録（秘密鍵はAES-256で暗号化して保存）

### リクエスト

**ヘッダー**:
| ヘッダー | 必須 | 説明 |
|---------|------|------|
| Content-Type | Yes | application/json |

**ボディ**:
```json
{
  "name": "GitHub Personal",
  "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA...\n-----END OPENSSH PRIVATE KEY-----",
  "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
  "passphrase": "optional-passphrase"
}
```

### バリデーションルール

| フィールド | ルール |
|-----------|--------|
| name | 必須、1-100文字、ユニーク（既存の名前と重複不可） |
| private_key | 必須、有効なOpenSSH秘密鍵形式 |
| public_key | 任意（省略時は秘密鍵から自動生成を試行） |
| passphrase | 任意、パスフレーズ保護された鍵の場合に指定 |

**鍵フォーマット**:
- RSA (2048/4096 bit)
- Ed25519
- ECDSA

### レスポンス

**成功時 (201 Created)**:
```json
{
  "id": "uuid",
  "name": "GitHub Personal",
  "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
  "has_passphrase": false,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**バリデーションエラー (400 Bad Request) - 名前重複**:
```json
{
  "error": {
    "code": "DUPLICATE_SSH_KEY_NAME",
    "message": "この名前は既に使用されています。別の名前を入力してください",
    "details": {
      "field": "name",
      "value": "GitHub Personal"
    }
  }
}
```

**バリデーションエラー (400 Bad Request) - 無効な鍵**:
```json
{
  "error": {
    "code": "INVALID_SSH_KEY",
    "message": "有効な SSH 鍵ファイルを選択してください（OpenSSH 形式）",
    "details": {
      "field": "private_key"
    }
  }
}
```

**暗号化エラー (500 Internal Server Error)**:
```json
{
  "error": {
    "code": "ENCRYPTION_ERROR",
    "message": "SSH鍵の暗号化に失敗しました"
  }
}
```

---

## DELETE /api/ssh-keys/:id

**説明**: SSH鍵を削除（データベースから完全削除）

### リクエスト

**パスパラメータ**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| id | string (UUID) | SSH鍵ID |

**ヘッダー**: なし

### レスポンス

**成功時 (204 No Content)**:
```
（レスポンスボディなし）
```

**鍵が存在しない場合 (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "SSH鍵が見つかりません"
  }
}
```

---

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| VALIDATION_ERROR | 400 | 入力値エラー（名前空白等） |
| DUPLICATE_SSH_KEY_NAME | 409 | SSH鍵名が既に存在 |
| INVALID_SSH_KEY | 400 | 無効なSSH鍵ファイル |
| ENCRYPTION_ERROR | 500 | 暗号化/復号化エラー |
| NOT_FOUND | 404 | リソースが見つからない |
| INTERNAL_ERROR | 500 | サーバー内部エラー |

## セキュリティ

### 暗号化
- **秘密鍵の暗号化**: AES-256-CBC アルゴリズム
- **マスターキー**: 環境変数 `ENCRYPTION_MASTER_KEY` から取得
- **IV**: 鍵ごとにランダム生成（16バイト）

### データ保護
- **秘密鍵は画面に表示しない**: APIレスポンスに秘密鍵を含めない
- **公開鍵のみ返却**: GET リクエストでは公開鍵のみ返却

### 認証・認可
- **認証**: 現時点では認証なし（将来的に実装予定）
- **認可**: なし
- **レート制限**: なし

## 関連コンポーネント

- [SshKeyService](../components/ssh-key-service.md) @../components/ssh-key-service.md: SSH鍵の登録・削除・バリデーション
- [EncryptionService](../components/encryption-service.md) @../components/encryption-service.md: 秘密鍵の暗号化・復号化
- [SshKey テーブル](../database/schema.md#sshkey) @../database/schema.md: データ永続化

## 関連要件

- [US-003](../../requirements/dev-tool-settings/stories/US-003.md) @../../requirements/dev-tool-settings/stories/US-003.md: SSH 鍵ペアの登録・管理
- [NFR-SEC-001](../../requirements/dev-tool-settings/nfr/security.md) @../../requirements/dev-tool-settings/nfr/security.md: SSH 秘密鍵の暗号化保存
- [NFR-PERF-002](../../requirements/dev-tool-settings/nfr/performance.md) @../../requirements/dev-tool-settings/nfr/performance.md: 設定保存性能（500ms以内）
