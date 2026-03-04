# 設計書: Issue #195 - ワイルドカードドメイン解決の改善

## 概要

`network-filter-service.ts` の `resolveWildcardDomain` メソッドを拡張し、
既知サービスのIPレンジ（CIDR）とサービス固有サブドメインをワイルドカードルールと連動させる。

## 変更対象ファイル

1. `src/services/network-filter-service.ts` - コアロジックの変更
2. `src/components/environments/NetworkRuleForm.tsx` - UIヘルプテキストの更新
3. `src/services/__tests__/network-filter-service.test.ts` - テストの追加

## 設計詳細

### 1. 既知サービスのCIDR定義（`network-filter-service.ts`）

`COMMON_SUBDOMAINS` 定数と同じスコープに以下の定数を追加する。

```typescript
/**
 * 既知サービスのIPレンジ（CIDRブロック）
 * ワイルドカードドメインで指定された場合、DNS解決に加えてこれらのCIDRも含める
 * 参考: https://api.github.com/meta
 */
const KNOWN_SERVICE_CIDRS: Record<string, string[]> = {
  'github.com': [
    '140.82.112.0/20',  // GitHub
    '192.30.252.0/22',  // GitHub
    '185.199.108.0/22', // GitHub Pages/CDN
    '143.55.64.0/20',   // GitHub
  ],
  'githubusercontent.com': [
    '185.199.108.0/22', // GitHub content delivery
  ],
};

/**
 * サービス固有の追加サブドメイン
 * COMMON_SUBDOMAINS に加えて解決を試みる
 */
const SERVICE_SPECIFIC_SUBDOMAINS: Record<string, string[]> = {
  'github.com': ['codeload', 'objects', 'pkg', 'ghcr', 'copilot-proxy'],
  // 'raw' は COMMON_SUBDOMAINS に含まれるため省略
  'githubusercontent.com': ['objects', 'avatars', 'user-images', 'camo'],
  'npmjs.org': ['registry'],
  'npmjs.com': ['registry'],
};
```

### 2. `resolveWildcardDomain` メソッドの変更

既存メソッドに2つのステップを追加する。

**変更前:**
```typescript
private async resolveWildcardDomain(baseDomain: string): Promise<string[]> {
  const allIps = new Set<string>();
  const baseIps = await this.resolveWithCache(baseDomain);
  baseIps.forEach((ip) => { allIps.add(ip); });
  for (const subdomain of COMMON_SUBDOMAINS) {
    const fqdn = `${subdomain}.${baseDomain}`;
    const subIps = await this.resolveWithCache(fqdn);
    subIps.forEach((ip) => { allIps.add(ip); });
  }
  return Array.from(allIps);
}
```

**変更後:**
```typescript
private async resolveWildcardDomain(baseDomain: string): Promise<string[]> {
  const allIps = new Set<string>();

  // ベースドメインを解決
  const baseIps = await this.resolveWithCache(baseDomain);
  baseIps.forEach((ip) => { allIps.add(ip); });

  // 一般的なサブドメインとサービス固有サブドメインを重複排除して並列解決
  const candidateSubdomains = new Set([
    ...COMMON_SUBDOMAINS,
    ...(SERVICE_SPECIFIC_SUBDOMAINS[baseDomain] ?? []),
  ]);

  await Promise.all(
    Array.from(candidateSubdomains).map(async (subdomain) => {
      const fqdn = `${subdomain}.${baseDomain}`;
      const subIps = await this.resolveWithCache(fqdn);
      subIps.forEach((ip) => { allIps.add(ip); });
    })
  );

  // 既知サービスのCIDRブロックを追加（DNS解決なし）
  const knownCidrs = KNOWN_SERVICE_CIDRS[baseDomain];
  if (knownCidrs) {
    knownCidrs.forEach(cidr => { allIps.add(cidr); });
  }

  return Array.from(allIps);
}
```

### 3. UIヘルプテキストの更新（`NetworkRuleForm.tsx`）

ワイルドカード入力時に表示されるヘルプテキストを更新する。

**変更前:**
```tsx
<p className="text-xs text-blue-700 dark:text-blue-300">
  {baseDomain} の全てのサブドメインにマッチします
</p>
```

**変更後:**
```tsx
<p className="text-xs text-blue-700 dark:text-blue-300">
  {baseDomain} の全てのサブドメインにマッチします。
  主要サブドメインのDNS解決で対応しますが、全サブドメインを網羅するにはCIDR形式（例: 140.82.112.0/20）の使用を推奨します。
</p>
```

## CIDRの取り扱い

`ResolvedRule.ips` 配列にCIDRが混在することになるが、`iptables-manager.ts` はすでに `-d` フラグでCIDRに対応している。
`isIpOrCidr` 関数も既にCIDRを認識するため、既存コードの変更は不要。

## テスト設計

### 追加するテストケース（`resolveWildcardDomain` 経由 / `resolveDomains` 経由）

1. `github.com` に対して `SERVICE_SPECIFIC_SUBDOMAINS['github.com']` のサブドメインが解決される
2. `github.com` に対して `KNOWN_SERVICE_CIDRS['github.com']` のCIDRが含まれる
3. `githubusercontent.com` に対して固有サブドメインとCIDRが含まれる
4. `npmjs.org` に対して `registry` サブドメインが解決される
5. 未知ドメイン（`example.com`）に対してはCIDR追加なしで動作する

### テスト実装のポイント

- `dns.resolve4` をモック (`vi.spyOn`) して、各サブドメインの解決をシミュレート
- CIDRが `ips` 配列に直接追加されることを検証（DNS解決なし）
- 未知ドメインでは `KNOWN_SERVICE_CIDRS` にヒットしないことを確認

## 影響範囲

- **変更**: `src/services/network-filter-service.ts`（内部ロジックのみ）
- **変更**: `src/components/environments/NetworkRuleForm.tsx`（ヘルプテキストのみ）
- **追加**: テストケース
- **既存動作への影響**: `COMMON_SUBDOMAINS` の解決を `SERVICE_SPECIFIC_SUBDOMAINS` と統合し、`Set` による重複排除と `Promise.all` による並列解決に変更。`COMMON_SUBDOMAINS` 自体の定義は変更なしだが、`SERVICE_SPECIFIC_SUBDOMAINS` の追加により解決対象のサブドメインは増加。
- **破壊的変更なし**

## 関連ドキュメント

- [要件定義書](../../requirements/network-filtering/issue-195-wildcard-resolution.md)
- [タスク書](../../tasks/network-filtering/issue-195-wildcard-resolution.md)
