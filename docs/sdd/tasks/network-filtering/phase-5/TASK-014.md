# TASK-014: NetworkFilterServiceのDNS解決機能削除

## 説明

NetworkFilterServiceからDNS解決関連の機能を削除し、コードを簡素化する。proxyがドメインベースで直接フィルタリングするため、ClaudeWork側のDNS解決は不要。

- **対象ファイルパス**:
  - 実装: `src/services/network-filter-service.ts`（修正）
  - テスト削除: `src/services/__tests__/network-filter-service-dns.test.ts`（ファイル削除）
  - テスト修正: `src/services/__tests__/network-filter-service.test.ts`（DNS関連テスト削除）
- **参照設計**: `docs/sdd/design/network-filtering/components/network-filter-service.md`

## 技術的文脈

- フレームワーク: Next.js 15, TypeScript
- テスト: vitest
- 参照すべき既存コード: `src/services/network-filter-service.ts`（現在805行）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | DNS解決機能は全て削除。CRUD、バリデーション、テンプレート、testConnection（文字列ベース）は保持 |
| 不明/要確認の情報 | なし |

## 削除対象

### 削除するメソッド・プロパティ
- `dnsCache` プロパティ（Map）
- `resolveDomains()` メソッド（publicメソッド）
- `resolveWildcardDomain()` メソッド（private）
- `resolveWithCache()` メソッド（private）
- `clearExpiredCache()` メソッド（private）
- `isIpOrCidr()` メソッド（private）- resolveDomains内でのみ使用

### 削除する定数
- `DNS_CACHE_TTL_MS`
- `COMMON_SUBDOMAINS`
- `KNOWN_SERVICE_CIDRS`
- `SERVICE_SPECIFIC_SUBDOMAINS`

### 削除する型
- `DnsCacheEntry` interface
- `ResolvedRule` interface（exportされているがリポジトリ全体で外部使用なし。要確認）

### 削除するimport
- `import dns from 'dns/promises';`

### 保持するメソッド（変更なし）
- `getRules()`, `createRule()`, `updateRule()`, `deleteRule()`
- `getFilterConfig()`, `isFilterEnabled()`, `updateFilterConfig()`
- `getDefaultTemplates()`, `applyTemplates()`
- `testConnection()` - dry-run通信テスト（文字列ベースマッチング）
- `matchesTarget()` - ルールマッチング（testConnectionで使用）
- `validateTarget()`, `validatePort()`, `isValidIPv4()`
- `isIPv4InCidr()`, `ipToNumber()` - CIDRマッチング（matchesTargetで使用）
- `normalizeTarget()`
- `isDockerComposeEnvironment()`, `getFilterNetworkName()`

### テストファイル
- `network-filter-service-dns.test.ts`: **ファイル全体を削除**
- `network-filter-service.test.ts`: DNS関連テスト（`resolveDomains`呼び出し等）があれば削除
- `network-filter-service-compose.test.ts`: DNS関連テストがあれば削除

## 実装手順

1. `ResolvedRule`型の外部使用箇所をリポジトリ全体で確認（`grep -r "ResolvedRule" .`、src/外のテスト・スクリプト含む）
2. DNS関連テストファイル削除: `src/services/__tests__/network-filter-service-dns.test.ts`
3. `network-filter-service.test.ts` からDNS関連テスト削除
4. `network-filter-service.ts` からDNS関連コード削除
5. テスト実行: 残存テストが全て通過することを確認
6. コミット

## 受入基準

- [x] `dns` importが削除されている
- [x] `resolveDomains`, `resolveWildcardDomain`, `resolveWithCache`, `clearExpiredCache` メソッドが存在しない
- [x] DNS関連定数（COMMON_SUBDOMAINS等）が存在しない
- [x] `network-filter-service-dns.test.ts` が削除されている
- [x] CRUD、バリデーション、テンプレート、testConnection機能は正常動作
- [x] `npm test -- src/services/__tests__/network-filter-service.test.ts` で全テスト通過
- [x] ESLintエラーがゼロ

## 依存関係

TASK-013（ProxyClient）と同一PRで適用する前提。DNS解決削除はproxyがドメインベースで直接フィルタリングすることが前提のため、proxy方式導入前に単独で適用するとドメインルールが成立しなくなる

## 推定工数

20分

## ステータス

`DONE`

## 完了サマリー

DNS解決関連のコードをすべて削除した。削除対象はresolveDomains、resolveWildcardDomain、resolveWithCache、clearExpiredCacheなどの関数と関連する型定義・定数である。テストファイルnetwork-filter-service-dns.test.tsも削除。全テスト（29件）通過。ESLintエラーなし。
