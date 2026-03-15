# API設計: Settings Config拡張

## 概要

既存のAppConfig/ConfigServiceに`registry_firewall_enabled`フィールドを追加。

## 対応要件

REQ-007

## 変更箇所

### AppConfig型定義 (config-service.ts)

```typescript
export interface AppConfig {
  git_clone_timeout_minutes?: number;
  debug_mode_keep_volumes?: boolean;
  registry_firewall_enabled?: boolean;  // 追加
}

const DEFAULT_CONFIG: Required<AppConfig> = {
  git_clone_timeout_minutes: 5,
  debug_mode_keep_volumes: false,
  registry_firewall_enabled: true,  // デフォルト: 有効
};
```

### ConfigServiceメソッド追加

```typescript
getRegistryFirewallEnabled(): boolean {
  return this.config.registry_firewall_enabled;
}
```

### PUT /api/settings/config の拡張

リクエストボディに`registry_firewall_enabled`を追加:

```json
{
  "registry_firewall_enabled": true
}
```

バリデーション: `boolean`型チェック

### GET /api/settings/config のレスポンス変更

```json
{
  "config": {
    "git_clone_timeout_minutes": 5,
    "debug_mode_keep_volumes": false,
    "registry_firewall_enabled": true
  }
}
```

## UI側の利用

環境設定ページからAPIを呼び出してトグル状態を取得・更新:

```typescript
// 取得
const res = await fetch('/api/settings/config');
const { config } = await res.json();
const enabled = config.registry_firewall_enabled;

// 更新
await fetch('/api/settings/config', {
  method: 'PUT',
  body: JSON.stringify({ registry_firewall_enabled: !enabled }),
});
```
