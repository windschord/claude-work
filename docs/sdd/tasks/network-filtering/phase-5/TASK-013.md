# TASK-013: ProxyClient新規作成

## 説明

network-filter-proxy Management APIと通信するHTTPクライアントを新規作成する。

- **対象ファイルパス**:
  - 実装: `src/services/proxy-client.ts`（新規作成）
  - テスト: `src/services/__tests__/proxy-client.test.ts`（新規作成）
- **参照設計**: `docs/sdd/design/network-filtering/components/proxy-client.md`

## 技術的文脈

- Node.js標準の`fetch` APIを使用（外部ライブラリ不要）
- proxy Management API仕様:
  - GET /api/v1/health - ヘルスチェック
  - GET /api/v1/rules - 全ルール一覧
  - PUT /api/v1/rules/{sourceIP} - ルールセット置換
  - DELETE /api/v1/rules/{sourceIP} - ルール削除
  - DELETE /api/v1/rules - 全ルール削除
- 環境変数: `PROXY_API_URL`（デフォルト: `http://network-filter-proxy:8080`）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | API仕様、型定義、エラー処理戦略、リトライ戦略は全て設計書で確定 |
| 不明/要確認の情報 | なし |

## 実装する型・メソッド

### エラークラス

```typescript
class ProxyConnectionError extends Error {
  constructor(message: string, public cause?: Error)
}

class ProxyValidationError extends Error {
  constructor(message: string, public details?: Array<{ field: string; message: string }>)
}
```

### 型定義

```typescript
interface ProxyHealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  activeConnections: number;
  ruleCount: number;
}

interface ProxyRuleEntry {
  host: string;
  port?: number;
}

interface ProxyRuleSet {
  source_ip: string;
  entries: ProxyRuleEntry[];
  updated_at: string;
}

type ProxyRulesMap = Record<string, ProxyRuleSet>;
```

### ProxyClientクラス

```typescript
class ProxyClient {
  constructor(baseUrl?: string)  // デフォルト: process.env.PROXY_API_URL || 'http://network-filter-proxy:8080'
  healthCheck(): Promise<ProxyHealthStatus>
  getAllRules(): Promise<ProxyRulesMap>
  setRules(sourceIP: string, entries: ProxyRuleEntry[]): Promise<ProxyRuleSet>
  deleteRules(sourceIP: string): Promise<void>
  deleteAllRules(): Promise<void>
  syncRules(sourceIP: string, environmentId: string): Promise<void>
}
```

### syncRulesの処理フロー

1. `networkFilterService.getRules(environmentId)` で有効ルール取得
2. `enabled === true` のルールのみフィルタ
3. ClaudeWork形式 -> proxy API形式に変換（`target` -> `host`, `port` -> `port`、`port === null`の場合は省略）
4. `PUT /api/v1/rules/{sourceIP}` で送信

### リトライ戦略

- ヘルスチェック: リトライなし
- ルール同期（setRules/deleteRules/syncRules）: 最大3回、指数バックオフ（1s, 2s, 4s）
- 全APIコール: タイムアウト5秒

## 実装手順（TDD）

1. テスト作成: `src/services/__tests__/proxy-client.test.ts`
   - 正常系: healthCheckが正常応答を返す
   - 正常系: setRulesがPUTリクエストを送信する
   - 正常系: deleteRulesがDELETEリクエストを送信する
   - 正常系: syncRulesがDBルールをproxy形式に変換して送信する
   - 正常系: port=nullのルールがport省略に変換される
   - 異常系: 接続失敗時にProxyConnectionErrorをスローする
   - 異常系: バリデーション失敗（422）時にProxyValidationErrorをスローする
   - 異常系: タイムアウト時にリトライ後エラーをスローする
   - 異常系: syncRulesでフィルタリング無効時はルール同期しない
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: `src/services/proxy-client.ts` を作成
5. テスト通過を確認
6. 実装コミット

### テストのモック戦略

- `global.fetch` をモック（`vi.fn()`）
- `networkFilterService.getRules` をモック（syncRulesテスト用）
- `networkFilterService.isFilterEnabled` をモック

## 受入基準

- [ ] `src/services/proxy-client.ts` が存在する
- [ ] TypeScriptの型定義（ProxyHealthStatus, ProxyRuleEntry等）がexportされている
- [ ] ProxyConnectionError, ProxyValidationErrorがexportされている
- [ ] ヘルスチェック、ルールCRUD、syncRulesが実装されている
- [ ] リトライロジック（指数バックオフ）が実装されている
- [ ] テストが8つ以上ある
- [ ] `npm test -- src/services/__tests__/proxy-client.test.ts` で全テスト通過
- [ ] ESLintエラーがゼロ

## 依存関係

なし（最初に着手可能）

## 推定工数

40分

## ステータス

`IN_PROGRESS`
