# API設計: Environment API拡張

## 概要

環境APIの作成・更新エンドポイントにchromeSidecar設定のバリデーションを追加する。

## 対応要件

REQ-003-001, REQ-003-002, REQ-003-003

## 変更エンドポイント

### PUT /api/environments/:id

既存のconfig JSONバリデーションに、chromeSidecar固有のバリデーションルールを追加する。

### POST /api/environments

環境作成時も同様のバリデーションを適用する。

## バリデーション仕様

### リクエストボディ (config部分)

```json
{
  "config": {
    "imageName": "ghcr.io/windschord/claude-work-sandbox",
    "imageTag": "latest",
    "chromeSidecar": {
      "enabled": true,
      "image": "chromium/headless-shell",
      "tag": "131.0.6778.204"
    }
  }
}
```

### バリデーションルール

| フィールド | ルール | HTTPステータス | エラーメッセージ |
|-----------|--------|--------------|-----------------|
| chromeSidecar | オプション（省略時はenabled:falseとして扱う） | - | - |
| chromeSidecar.enabled | boolean型、必須（chromeSidecarが存在する場合） | 400 | "chromeSidecar.enabled is required and must be a boolean" |
| chromeSidecar.image | 文字列型、`/^[-a-z0-9._/]+$/` に適合、必須 | 400 | "chromeSidecar.image must be a valid Docker image name" |
| chromeSidecar.tag | 文字列型、空文字不可、`latest`不可、必須 | 400 | "chromeSidecar.tag must be a specific version (latest is not allowed)" |
| chromeSidecar + type=HOST | chromeSidecarは無視される（HOST環境には適用不可） | - | - |

### バリデーション実装箇所

環境APIのバリデーションロジック内に追加する。

```typescript
function validateChromeSidecarConfig(
  config: Record<string, unknown>
): string | null {
  if (!config.chromeSidecar) return null; // 省略OK

  const sidecar = config.chromeSidecar as Record<string, unknown>;

  if (typeof sidecar.enabled !== 'boolean') {
    return 'chromeSidecar.enabled is required and must be a boolean';
  }

  if (!sidecar.enabled) return null; // disabled時はimage/tagのバリデーション不要

  if (typeof sidecar.image !== 'string' || !/^[-a-z0-9._/]+$/.test(sidecar.image)) {
    return 'chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, hyphens)';
  }

  if (typeof sidecar.tag !== 'string' || sidecar.tag.trim() === '') {
    return 'chromeSidecar.tag is required';
  }

  if (sidecar.tag === 'latest') {
    return 'chromeSidecar.tag must be a specific version (latest is not allowed for reproducibility)';
  }

  return null;
}
```

## レスポンス

変更なし。既存のEnvironmentレスポンスにconfig JSONが含まれており、chromeSidecarもその中に格納される。

## 後方互換性

- chromeSidecarキーが存在しないconfig JSONは引き続き有効
- 既存の環境レコードに変更は不要
- HOST環境のconfigにchromeSidecarが含まれていても無視される（エラーにはしない）
