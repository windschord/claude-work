# TASK-004: DNS解決とルール変換ロジックの実装

## 説明

NetworkFilterServiceにドメイン名のDNS解決機能と通信テスト（dry-run）機能を追加する。

- **対象ファイル**:
  - `src/services/network-filter-service.ts` （既存に追加）
  - `src/services/__tests__/network-filter-service-dns.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/network-filter-service.md`（resolveDomains, testConnection）
- **設計参照**: `docs/sdd/design/network-filtering/decisions/DEC-002.md`

## 技術的文脈

- Node.js `dns/promises` モジュール使用（`dns.resolve4`, `dns.resolve6`）
- ワイルドカードドメイン: ベースドメインと一般的なサブドメインを解決
- メモリ内キャッシュ（Map）、TTL: 5分
- 通信テスト: ルールマッチングのdry-run（実際の通信は行わない）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | DNS解決方式、キャッシュ戦略、ワイルドカード処理（DEC-002に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/services/__tests__/network-filter-service-dns.test.ts`

```typescript
// dns/promisesをモックしてテスト
// テストケース（DNS解決）:
// 1. resolveDomains: 通常ドメインをIPv4に解決できる
// 2. resolveDomains: 通常ドメインをIPv6に解決できる
// 3. resolveDomains: ワイルドカードドメインのベースドメインを解決
// 4. resolveDomains: ワイルドカードドメインの一般的サブドメインを解決試行
// 5. resolveDomains: IPアドレスルールはそのまま通過
// 6. resolveDomains: CIDR形式はそのまま通過
// 7. resolveDomains: DNS解決失敗時は警告ログを出力しスキップ
// 8. resolveDomains: キャッシュヒット時はDNS解決を再実行しない
// 9. resolveDomains: キャッシュTTL超過時はDNS解決を再実行する
//
// テストケース（通信テスト）:
// 10. testConnection: ホワイトリスト内のドメインはallowed: true
// 11. testConnection: ホワイトリスト外のドメインはallowed: false
// 12. testConnection: ポート指定ありルールで異なるポートはblocked
// 13. testConnection: ポート指定なしルールは全ポートallowed
// 14. testConnection: マッチしたルール情報が返却される
// 15. testConnection: フィルタリング無効時は全てallowed
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

`src/services/network-filter-service.ts` に追加するメソッド:

```typescript
// DNS解決
async resolveDomains(rules: NetworkFilterRule[]): Promise<ResolvedRule[]>

// 通信テスト（dry-run）
async testConnection(environmentId: string, target: string, port?: number): Promise<TestResult>

// 内部: DNSキャッシュ管理
private dnsCache: Map<string, { ips: string[], expiry: number }>
private async resolveWithCache(domain: string): Promise<string[]>
private clearExpiredCache(): void
```

型定義:
```typescript
interface ResolvedRule {
  ips: string[];
  port: number | null;
  description?: string;
  originalTarget: string;
}

interface TestResult {
  allowed: boolean;
  matchedRule?: {
    id: string;
    target: string;
    port: number | null;
    description?: string;
  };
}
```

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] `resolveDomains` メソッドが実装されている
- [ ] 通常ドメイン、ワイルドカード、IP、CIDRの全パターンが正しく処理される
- [ ] DNSキャッシュが実装されている（TTL: 5分）
- [ ] DNS解決失敗時にスキップ（フェイルオープンではなく警告）される
- [ ] `testConnection` メソッドが実装されている（dry-run）
- [ ] テストが15件以上あり、全て通過する

## 依存関係
TASK-003（NetworkFilterServiceの基本構造）

## 推定工数
40分

## ステータス
`DONE`

## 完了サマリー

DNS解決（resolveDomains）と通信テスト（testConnection）をTDD手順で実装。全15件のテストが通過。
