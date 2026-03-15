# コンポーネント設計: Registry Firewall Client

## 概要

ClaudeWorkバックエンドからregistry-firewallのAPIにアクセスするためのクライアントモジュール。

## 対応要件

REQ-008, REQ-009, REQ-010, NFR-SEC-001, NFR-AVA-002

## ファイル

`src/services/registry-firewall-client.ts`

## インターフェース

```typescript
export interface RegistryFirewallHealthResponse {
  status: 'healthy' | 'unhealthy' | 'stopped';
  registries?: string[];
  version?: string;
}

export interface BlockLogEntry {
  timestamp: string;
  package_name: string;
  registry: string;
  reason: string;
  severity?: string;
}

export interface BlockLogsResponse {
  blocks: BlockLogEntry[];
  total: number;
}

export class RegistryFirewallClient {
  private baseUrl: string;
  private apiToken: string | undefined;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.REGISTRY_FIREWALL_URL || 'http://registry-firewall:8080';
    this.apiToken = process.env.REGISTRY_FIREWALL_API_TOKEN || undefined;
    this.timeout = 2000; // NFR-AVA-002: 2秒タイムアウト
  }

  /** ヘルスチェック */
  async getHealth(): Promise<RegistryFirewallHealthResponse>;

  /** ブロックログ取得 */
  async getBlocks(limit?: number): Promise<BlockLogsResponse>;

  /** UIプロキシ用: パスをそのまま転送 */
  async proxyRequest(path: string, options?: RequestInit): Promise<Response>;
}
```

## 実装詳細

### 認証

```typescript
private getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (this.apiToken) {
    headers['Authorization'] = `Bearer ${this.apiToken}`;
  }
  return headers;
}
```

### ヘルスチェック

- `/health`エンドポイントにGETリクエスト
- 2秒のタイムアウト(NFR-AVA-002)
- タイムアウトまたは接続エラー時は`{ status: 'stopped' }`を返す
- registry-firewallが認証不要のエンドポイント

### エラーハンドリング

- 接続エラー: `{ status: 'stopped' }`を返す(例外をスローしない)
- 認証エラー(401/403): ログに記録し、適切なエラーを返す
- タイムアウト: `AbortController`で制御

## シングルトンパターン

既存の`ProxyClient`と同様のシングルトンパターンを使用:

```typescript
let instance: RegistryFirewallClient | null = null;

export function getRegistryFirewallClient(): RegistryFirewallClient {
  if (!instance) {
    instance = new RegistryFirewallClient();
  }
  return instance;
}
```
