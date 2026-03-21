# コンポーネント設計: DBスキーマ拡張

## 概要

SessionテーブルにChromeサイドカー関連のカラムを追加し、ExecutionEnvironment.config JSONにchromeSidecar設定オブジェクトの型定義を追加する。

## 対応要件

REQ-002-003, REQ-003-001, REQ-003-002, REQ-003-003

## Sessionテーブル拡張

### 新規カラム

| カラム名 | 型 | NULL可否 | デフォルト | 説明 |
|---------|------|----------|-----------|------|
| chrome_container_id | TEXT | YES | NULL | Chromeサイドカーのコンテナ名 (`cw-chrome-<session-id>` 形式) |
| chrome_debug_port | INTEGER | YES | NULL | ホストにマッピングされたデバッグポート番号 |

### スキーマ定義の変更

```typescript
// src/db/schema.ts - sessions テーブル
export const sessions = sqliteTable('Session', {
  // ... 既存カラム
  container_id: text('container_id'),

  // Chrome Sidecar関連（新規追加）
  chrome_container_id: text('chrome_container_id'),     // Chromeサイドカーコンテナ名
  chrome_debug_port: integer('chrome_debug_port'),      // ホスト側デバッグポート

  // ... 既存カラム続き
}, (table) => [
  // ... 既存インデックス
]);
```

### マイグレーション

Drizzle ORM の `db:generate` で自動生成される。マイグレーションSQL（参考）:

```sql
ALTER TABLE Session ADD COLUMN chrome_container_id TEXT;
ALTER TABLE Session ADD COLUMN chrome_debug_port INTEGER;
```

既存レコードはNULLのまま（後方互換性あり）。

## ExecutionEnvironment.config JSON拡張

### 型定義

```typescript
// src/types/environment.ts
export interface DockerEnvironmentConfig {
  // ... 既存フィールド
  imageSource?: 'existing' | 'dockerfile';
  imageName?: string;
  imageTag?: string;
  dockerfilePath?: string;
  dockerfileUploaded?: boolean;
  skipPermissions?: boolean;
  portMappings?: PortMapping[];
  volumeMounts?: VolumeMount[];

  // Chrome Sidecar設定（新規追加）
  chromeSidecar?: {
    enabled: boolean;
    image: string;    // デフォルト: 'chromium/headless-shell'
    tag: string;      // 固定バージョン必須、'latest'禁止
  };
}
```

### configデータ例

サイドカー未設定（デフォルト、後方互換）:

```json
{
  "imageName": "ghcr.io/windschord/claude-work-sandbox",
  "imageTag": "latest"
}
```

サイドカー有効:

```json
{
  "imageName": "ghcr.io/windschord/claude-work-sandbox",
  "imageTag": "latest",
  "chromeSidecar": {
    "enabled": true,
    "image": "chromium/headless-shell",
    "tag": "131.0.6778.204"
  }
}
```

### バリデーションルール

| フィールド | ルール | エラーメッセージ例 |
|-----------|--------|-----------------|
| chromeSidecar.enabled | boolean型、必須（chromeSidecarキーが存在する場合） | "enabled must be a boolean" |
| chromeSidecar.image | 文字列型、`[-a-z0-9._/]+` に適合、必須 | "image must be a valid Docker image name" |
| chromeSidecar.tag | 文字列型、必須、`latest`禁止 | "tag must be a specific version (latest is not allowed)" |
| chromeSidecarキー自体 | 存在しない場合は`enabled: false`として扱う | (バリデーションエラーなし) |

バリデーションは Environment API の PUT/POST エンドポイントで実行する。

## 後方互換性

- `chrome_container_id` と `chrome_debug_port` はNULL許可のため、既存レコードに影響なし
- `chromeSidecar` キーが config JSON に存在しない場合は `enabled: false` として扱う
- 既存のDockerAdapterConfig, AdapterFactory等は chromeSidecar キーを無視する（明示的に読み取らない限り）
