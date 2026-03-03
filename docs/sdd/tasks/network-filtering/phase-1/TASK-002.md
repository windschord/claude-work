# TASK-002: IptablesManagerの実装

## 説明

iptablesコマンドの実行を抽象化するサービスクラスを新規作成する。iptablesルールの生成、適用、クリーンアップを行う。

- **対象ファイル**:
  - `src/services/iptables-manager.ts` （新規作成）
  - `src/services/__tests__/iptables-manager.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/iptables-manager.md`

## 技術的文脈

- `child_process.execFile` でiptablesコマンドを実行
- チェイン命名規則: `CWFILTER-<envIdの先頭8文字>`
- DOCKER-USER chainにジャンプルールを追加
- Winstonロガー使用（`src/lib/logger.ts`）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | チェイン命名規則、iptablesルール構造、DOCKER-USER chain使用（設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/services/__tests__/iptables-manager.test.ts`

```typescript
// child_process.execFileをモックしてテスト
// テストケース:
// 1. checkAvailability: iptablesが利用可能な場合trueを返す
// 2. checkAvailability: iptablesが利用不可な場合falseを返す
// 3. setupFilterChain: 正しいiptablesコマンドが生成される
//    - チェイン作成、DOCKER-USERジャンプ、DNS許可、conntrack、ホワイトリスト、DROP
// 4. setupFilterChain: 既存チェインがある場合は削除してから再作成（冪等性）
// 5. removeFilterChain: チェイン削除コマンドが正しく生成される
// 6. removeFilterChain: チェインが存在しない場合はエラーを抑制
// 7. generateIptablesRules: iptables-restore形式のルール文字列を生成
// 8. generateIptablesRules: ポート指定なしのルールが全ポート許可になる
// 9. generateIptablesRules: CIDR形式のルールが正しく処理される
// 10. cleanupOrphanedChains: CWFILTER-プレフィックスのチェインを検出・削除
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装: `src/services/iptables-manager.ts`

主要メソッド:
- `checkAvailability(): Promise<boolean>`
- `setupFilterChain(envId, resolvedRules, containerSubnet): Promise<void>`
- `removeFilterChain(envId): Promise<void>`
- `cleanupOrphanedChains(): Promise<void>`
- `listActiveChains(): Promise<ActiveChainInfo[]>`
- `generateIptablesRules(chainName, resolvedRules, containerSubnet): string`

型定義:
```typescript
interface ResolvedRule {
  ips: string[];        // 解決済みIPアドレスまたはCIDR
  port: number | null;  // ポート番号（null=全ポート）
  description?: string;
}

interface ActiveChainInfo {
  chainName: string;
  referenceCount: number;
  envIdPrefix: string;
}
```

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [x] `src/services/iptables-manager.ts` が作成されている
- [x] iptablesコマンドの利用可否チェックが実装されている
- [x] チェイン作成・削除が冪等に実装されている
- [x] iptables-restore形式のルール生成が正しい
- [x] DOCKER-USER chainへのジャンプルール追加・削除が実装されている
- [x] 孤立チェインのクリーンアップが実装されている
- [x] テストが10件以上あり、全て通過する
- [x] Winstonロガーでログが出力される

## 依存関係
なし（TASK-001と並列実行可能）

## 推定工数
40分

## ステータス
`DONE`

## 完了サマリー

依存性注入パターンを用いてIptablesManagerを実装。テストは13件全て通過。
- `src/services/iptables-manager.ts`: IptablesManagerクラス実装
- `src/services/__tests__/iptables-manager.test.ts`: 13件のテスト（全通過）
