# ProxyClient

## 概要

**目的**: network-filter-proxy の Management API と通信するHTTPクライアント

**責務**:
- proxy Management APIへのHTTPリクエスト送信
- ルールの同期（ClaudeWork DB -> proxy インメモリ）
- proxyのヘルスチェック
- コンテナ起動/停止時のルール適用・クリーンアップ

## 情報の明確性

### 明示された情報
- proxy Management APIのエンドポイント仕様（GET/PUT/DELETE /api/v1/rules）
- ルールはインメモリ（永続化なし）、ClaudeWork側のDBで永続化
- API_BIND_ADDR対応後は0.0.0.0バインドでDocker network経由アクセス

### 不明/要確認の情報
- なし（API仕様は確定済み）

---

## インターフェース

### 公開API/メソッド

#### `constructor(baseUrl?: string)`

**説明**: ProxyClientのインスタンスを作成する

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| baseUrl | string | No | proxy Management APIのベースURL。省略時は環境変数`PROXY_API_URL`またはデフォルト値`http://network-filter-proxy:8080`を使用 |

---

#### `healthCheck(): Promise<ProxyHealthStatus>`

**説明**: proxyのヘルスチェックを行い、稼働状態を返す

**戻り値**: `ProxyHealthStatus` - 稼働状態（uptime、アクティブ接続数、ルール数）

**例外**:
- `ProxyConnectionError`: proxyに接続できない場合

**使用例**:
```typescript
const client = new ProxyClient(); // 環境変数からデフォルトURLを使用
const health = await client.healthCheck();
// { status: 'healthy', uptime: 3600, activeConnections: 5, ruleCount: 12 }
```

---

#### `getAllRules(): Promise<ProxyRulesMap>`

**説明**: proxyに登録されている全ルールを取得する

**戻り値**: `ProxyRulesMap` - 送信元IPをキーとしたルールマップ

---

#### `setRules(sourceIP: string, entries: ProxyRuleEntry[]): Promise<ProxyRuleSet>`

**説明**: 指定した送信元IPのルールセットを丸ごと置換する

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| sourceIP | string | Yes | コンテナの送信元IPアドレス |
| entries | ProxyRuleEntry[] | Yes | 許可するホスト一覧 |

**戻り値**: `ProxyRuleSet` - 設定されたルールセット

**例外**:
- `ProxyValidationError`: ルール形式が不正な場合
- `ProxyConnectionError`: proxyに接続できない場合

**使用例**:
```typescript
await client.setRules('172.20.0.3', [
  { host: 'api.anthropic.com', port: 443 },
  { host: '*.github.com' },
]);
```

---

#### `deleteRules(sourceIP: string): Promise<void>`

**説明**: 指定した送信元IPのルールを削除する

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| sourceIP | string | Yes | コンテナの送信元IPアドレス |

---

#### `deleteAllRules(): Promise<void>`

**説明**: proxyの全ルールを削除する

---

### ルール同期ヘルパー（ProxyClient外部）

ルール同期ロジックはProxyClientの責務外として `src/lib/proxy-sync.ts` に配置:

#### `syncRulesForContainer(client, sourceIP, environmentId): Promise<void>`

**説明**: ClaudeWork DBのルールをproxy APIにPUTで同期する。NetworkFilterServiceからルール一覧を取得し、有効なルールのみをproxy形式に変換してProxyClient.setRulesで送信する。

#### `syncProxyRulesIfNeeded(environmentId): Promise<void>`

**説明**: 環境のフィルタリング状態を確認し、有効かつアクティブコンテナが存在する場合に全コンテナのルールを再同期するfire-and-forgetヘルパー。API層から呼び出される。

---

## 型定義

```typescript
interface ProxyHealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  activeConnections: number;
  ruleCount: number;
}

interface ProxyRuleEntry {
  host: string;
  port?: number;  // 0または省略で全ポート許可
}

interface ProxyRuleSet {
  source_ip: string;
  entries: ProxyRuleEntry[];
  updated_at: string;
}

type ProxyRulesMap = Record<string, ProxyRuleSet>;

class ProxyConnectionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ProxyConnectionError';
  }
}

class ProxyValidationError extends Error {
  constructor(message: string, public details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ProxyValidationError';
  }
}
```

## 依存関係

### 依存するコンポーネント
- なし（純粋なHTTPクライアント）

### 依存されるコンポーネント
- DockerAdapter: コンテナ起動時のルール同期（syncRulesForContainer経由）、停止時のルール削除
- proxy-sync.ts: ルール変更時のproxy同期ヘルパー
- [NetworkFilterService](network-filter-service.md) @network-filter-service.md: testConnectionのhealthCheck

## データフロー

### ルール同期フロー

```text
NetworkFilterService (DB)          ProxyClient           network-filter-proxy
       |                              |                        |
       |--- getRules(envId) --------->|                        |
       |<-- NetworkFilterRule[] ------|                        |
       |                              |                        |
       |                              |-- PUT /api/v1/rules/ ->|
       |                              |<-- 200 OK -------------|
       |                              |                        |
```

### コンテナ起動フロー

```text
DockerAdapter                    ProxyClient              network-filter-proxy
    |                               |                          |
    |-- createContainer() --------->|                          |
    |   (internal network接続)      |                          |
    |                               |                          |
    |-- syncRules(containerIP, ---->|                          |
    |   environmentId)              |-- PUT /api/v1/rules/ --->|
    |                               |<-- 200 OK --------------|
    |<-- done ----------------------|                          |
```

## 内部設計

### 設定

```typescript
// 環境変数またはdocker-compose.ymlから取得
const PROXY_API_URL = process.env.PROXY_API_URL || 'http://network-filter-proxy:8080';
```

### HTTP通信

Node.js標準の`fetch` APIを使用（外部ライブラリ不要）。

### ルール形式変換

ClaudeWork形式からproxy API形式への変換:

| ClaudeWork (NetworkFilterRule) | proxy API (ProxyRuleEntry) |
|-------------------------------|---------------------------|
| target: `api.anthropic.com` | host: `api.anthropic.com` |
| target: `*.github.com` | host: `*.github.com` |
| target: `10.0.0.0/8` | host: `10.0.0.0/8` |
| port: `443` | port: `443` |
| port: `null` | port: 省略（全ポート） |

### リトライ戦略

- ヘルスチェック: リトライなし（即時失敗）
- ルール設定/削除: 最大3回試行（初回 + 2回リトライ、指数バックオフ 1s, 2s）
- タイムアウト: 5秒

## エラー処理

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| ProxyConnectionError | proxyに接続できない | ログ出力、呼び出し元にエラー伝播。コンテナ起動は中止 |
| ProxyValidationError | ルール形式不正（proxy側バリデーション失敗） | ログ出力、該当ルールをスキップ |
| TimeoutError | API応答タイムアウト | リトライ後にProxyConnectionErrorとして伝播 |

## テスト観点

- [ ] 正常系: ヘルスチェックが正常応答を返す
- [ ] 正常系: ルール同期がDBのルールをproxy形式に変換して送信する
- [ ] 正常系: ルール削除がDELETEリクエストを送信する
- [ ] 異常系: proxy接続失敗時にProxyConnectionErrorをスローする
- [ ] 異常系: バリデーション失敗時にProxyValidationErrorをスローする
- [ ] 異常系: タイムアウト時にリトライ後エラーをスローする
- [ ] 変換: ClaudeWork形式のルールがproxy API形式に正しく変換される
- [ ] 変換: port=nullのルールがport省略に変換される

## 関連要件

- [US-002](../../requirements/network-filtering/stories/US-002.md) @../../requirements/network-filtering/stories/US-002.md: コンテナ起動時のフィルタリング自動適用
- [US-007](../../requirements/network-filtering/stories/US-007.md) @../../requirements/network-filtering/stories/US-007.md: proxy方式によるネットワークフィルタリング
