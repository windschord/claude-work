# ネットワークフィルタリング API

## 概要

環境ごとのネットワークフィルタリングルールを管理するREST API。

---

## エンドポイント

### GET /api/environments/[id]/network-rules

**説明**: 環境のフィルタリングルール一覧を取得

**レスポンス** (200):
```json
{
  "rules": [
    {
      "id": "rule-uuid",
      "environment_id": "env-uuid",
      "target": "*.github.com",
      "port": 443,
      "description": "GitHub",
      "enabled": true,
      "created_at": "2026-03-03T00:00:00Z",
      "updated_at": "2026-03-03T00:00:00Z"
    }
  ]
}
```

**エラーレスポンス** (404):
```json
{ "error": "Environment not found" }
```

---

### POST /api/environments/[id]/network-rules

**説明**: 新しいフィルタリングルールを追加

**リクエストボディ**:
```json
{
  "target": "*.github.com",
  "port": 443,
  "description": "GitHub"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|---------------|
| target | string | Yes | ドメイン名/IP/ワイルドカード/CIDR形式 |
| port | number \| null | No | 1-65535の整数 |
| description | string | No | 最大200文字 |

**レスポンス** (201):
```json
{
  "rule": {
    "id": "rule-uuid",
    "environment_id": "env-uuid",
    "target": "*.github.com",
    "port": 443,
    "description": "GitHub",
    "enabled": true,
    "created_at": "2026-03-03T00:00:00Z",
    "updated_at": "2026-03-03T00:00:00Z"
  }
}
```

**エラーレスポンス** (400):
```json
{ "error": "Invalid target format" }
```

---

### PUT /api/environments/[id]/network-rules/[ruleId]

**説明**: 既存ルールを更新

**リクエストボディ**:
```json
{
  "target": "api.anthropic.com",
  "port": 443,
  "description": "Claude API",
  "enabled": true
}
```

**レスポンス** (200): 更新後のルールオブジェクト

**エラーレスポンス** (404):
```json
{ "error": "Rule not found" }
```

---

### DELETE /api/environments/[id]/network-rules/[ruleId]

**説明**: ルールを削除

**レスポンス** (204): No Content

---

### GET /api/environments/[id]/network-filter

**説明**: 環境のフィルタリング設定を取得

**レスポンス** (200):
```json
{
  "config": {
    "id": "config-uuid",
    "environment_id": "env-uuid",
    "enabled": false,
    "created_at": "2026-03-03T00:00:00Z",
    "updated_at": "2026-03-03T00:00:00Z"
  }
}
```

---

### PUT /api/environments/[id]/network-filter

**説明**: フィルタリングの有効/無効を切り替え

**リクエストボディ**:
```json
{
  "enabled": true
}
```

**レスポンス** (200): 更新後の設定オブジェクト

---

### POST /api/environments/[id]/network-filter/test

**説明**: 指定宛先への通信が許可/ブロックされるかをdry-runで判定

**リクエストボディ**:
```json
{
  "target": "api.anthropic.com",
  "port": 443
}
```

**レスポンス** (200):
```json
{
  "result": {
    "allowed": true,
    "matchedRule": {
      "id": "rule-uuid",
      "target": "api.anthropic.com",
      "port": 443,
      "description": "Claude API"
    }
  }
}
```

---

### GET /api/environments/[id]/network-rules/templates

**説明**: デフォルトルールテンプレートを取得

**レスポンス** (200):
```json
{
  "templates": [
    {
      "category": "Anthropic API",
      "rules": [
        { "target": "api.anthropic.com", "port": 443, "description": "Claude API" }
      ]
    },
    {
      "category": "npm",
      "rules": [
        { "target": "*.npmjs.org", "port": 443, "description": "npm registry" },
        { "target": "*.npmjs.com", "port": 443, "description": "npm registry" }
      ]
    }
  ]
}
```

---

### POST /api/environments/[id]/network-rules/templates/apply

**説明**: テンプレートからルールを一括適用

**リクエストボディ**:
```json
{
  "rules": [
    { "target": "api.anthropic.com", "port": 443, "description": "Claude API" },
    { "target": "*.github.com", "port": 443, "description": "GitHub" }
  ]
}
```

**レスポンス** (201):
```json
{
  "created": 2,
  "skipped": 0,
  "rules": [...]
}
```

---

## ファイル構成

```
src/app/api/environments/[id]/
├── network-rules/
│   ├── route.ts              # GET (一覧), POST (追加)
│   ├── [ruleId]/
│   │   └── route.ts          # PUT (更新), DELETE (削除)
│   └── templates/
│       ├── route.ts           # GET (テンプレート取得)
│       └── apply/
│           └── route.ts       # POST (テンプレート適用)
└── network-filter/
    ├── route.ts               # GET, PUT (フィルタリング設定)
    └── test/
        └── route.ts           # POST (通信テスト)
```

## 関連要件

- [REQ-001](../../requirements/network-filtering/stories/US-001.md) @../../requirements/network-filtering/stories/US-001.md: ルールCRUD
- [REQ-003](../../requirements/network-filtering/stories/US-003.md) @../../requirements/network-filtering/stories/US-003.md: テンプレート
- [REQ-004](../../requirements/network-filtering/stories/US-004.md) @../../requirements/network-filtering/stories/US-004.md: テスト機能
