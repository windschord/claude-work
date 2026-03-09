# NetworkFilterService

## 概要

**目的**: ネットワークフィルタリングルールのCRUD管理、DNS解決、フィルタリング適用のオーケストレーション

**責務**:
- フィルタリングルールのCRUD操作（データベース永続化）
- 環境ごとのフィルタリング有効/無効管理
- ドメイン名のDNS解決とIPアドレスへの変換
- デフォルトテンプレートの提供
- 通信テスト（dry-run）の実行

> **注意**: iptables方式廃止に伴い、以下のメソッドは削除されました:
> - `applyFilter(environmentId, containerSubnet)`: コンテナ起動時のフィルタリング適用
> - `removeFilter(environmentId)`: コンテナ停止時のクリーンアップ
> - `cleanupOrphanedRules()`: 孤立iptablesルールのクリーンアップ（server.tsからの呼び出しも削除済み）
>
> また `FilterApplicationError` クラスおよびmutex（`withFilterLock`）も削除されました。
> proxy方式（US-007）実装時にフィルタ適用ロジックは再設計されます。

**ファイルパス**: `src/services/network-filter-service.ts`

---

## インターフェース

### 公開メソッド

#### `getRules(environmentId: string): Promise<NetworkFilterRule[]>`

**説明**: 指定環境のフィルタリングルール一覧を取得

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| environmentId | string | Yes | 環境ID |

**戻り値**: `NetworkFilterRule[]` - ルール一覧

---

#### `createRule(environmentId: string, input: CreateRuleInput): Promise<NetworkFilterRule>`

**説明**: 新しいフィルタリングルールを作成

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| environmentId | string | Yes | 環境ID |
| input.target | string | Yes | ドメイン名、IP、ワイルドカード、CIDR |
| input.port | number \| null | No | ポート番号（null = 全ポート） |
| input.description | string | No | ルールの説明 |

**戻り値**: `NetworkFilterRule` - 作成されたルール

**例外**:
- `ValidationError`: target形式が不正な場合

**バリデーションルール**:
- ドメイン名: RFC準拠、先頭`*.`によるワイルドカード許可
- IPアドレス: IPv4/IPv6形式
- CIDR: `x.x.x.x/y` 形式
- ポート: 1-65535の整数、またはnull

---

#### `updateRule(ruleId: string, input: UpdateRuleInput): Promise<NetworkFilterRule>`

**説明**: 既存ルールを更新

---

#### `deleteRule(ruleId: string): Promise<void>`

**説明**: ルールを削除

---

#### `getFilterConfig(environmentId: string): Promise<NetworkFilterConfig>`

**説明**: 環境のフィルタリング設定を取得

**戻り値**: `NetworkFilterConfig` - フィルタリングの有効/無効状態

---

#### `updateFilterConfig(environmentId: string, enabled: boolean): Promise<NetworkFilterConfig>`

**説明**: フィルタリングの有効/無効を切り替え

---

#### ~~`applyFilter(environmentId: string, containerSubnet: string): Promise<void>`~~ (廃止済み)

> iptables方式廃止により削除されました。proxy方式（US-007）実装時に再設計予定。

---

#### ~~`removeFilter(environmentId: string): Promise<void>`~~ (廃止済み)

> iptables方式廃止により削除されました。

---

#### `resolveDomains(rules: NetworkFilterRule[]): Promise<ResolvedRule[]>`

**説明**: ドメイン名を含むルールをDNS解決し、IPアドレスに変換

**処理フロー**:
1. ルールをIP系（IP、CIDR）とドメイン系に分類
2. IP系はそのまま通過
3. ドメイン系は`dns.resolve4`/`dns.resolve6`で解決
4. ワイルドカード（`*.example.com`）は`example.com`を解決
5. 解決結果をキャッシュ（TTL: 5分）

**戻り値**: `ResolvedRule[]` - IPアドレスに変換済みのルール

---

#### `testConnection(environmentId: string, target: string, port?: number): Promise<TestResult>`

**説明**: 指定した宛先への通信が許可/ブロックされるかをdry-runで判定

**戻り値**: `TestResult` - `{ allowed: boolean, matchedRule?: NetworkFilterRule }`

---

#### `getDefaultTemplates(): DefaultTemplate[]`

**説明**: デフォルトルールテンプレートを返す

**戻り値**: ハードコードされたテンプレート一覧

```typescript
const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    category: 'Anthropic API',
    rules: [
      { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
    ],
  },
  {
    category: 'npm',
    rules: [
      { target: '*.npmjs.org', port: 443, description: 'npm registry' },
      { target: '*.npmjs.com', port: 443, description: 'npm registry' },
    ],
  },
  {
    category: 'GitHub',
    rules: [
      { target: '*.github.com', port: 443, description: 'GitHub' },
      { target: '*.githubusercontent.com', port: 443, description: 'GitHub content' },
    ],
  },
  {
    category: 'PyPI',
    rules: [
      { target: 'pypi.org', port: 443, description: 'Python Package Index' },
      { target: '*.pythonhosted.org', port: 443, description: 'PyPI packages' },
    ],
  },
  {
    category: 'Docker Hub',
    rules: [
      { target: '*.docker.io', port: 443, description: 'Docker Hub' },
      { target: '*.docker.com', port: 443, description: 'Docker Hub' },
    ],
  },
];
```

---

#### `applyTemplates(environmentId: string, ruleInputs: CreateRuleInput[]): Promise<NetworkFilterRule[]>`

**説明**: テンプレートからルールを一括追加（重複スキップ）

---

#### ~~`cleanupOrphanedRules(): Promise<void>`~~ (廃止済み)

> iptables方式廃止により削除されました。server.tsからの呼び出しも削除済み。

---

## 依存関係

### 依存するコンポーネント
- ~~[IptablesManager](iptables-manager.md)~~: **廃止済み**（削除済み）
- Drizzle ORM (src/lib/db.ts): データベース操作
- Node.js `dns` module: DNS解決

### 依存されるコンポーネント
- ~~DockerAdapter (src/services/adapters/docker-adapter.ts)~~: フィルタ適用・解除の呼び出しは削除済み（ルール管理APIは引き続き利用）
- API Routes: HTTP経由でのルール管理

## データフロー

### コンテナ起動時のフィルタリング適用（現状：iptables廃止後）

> iptables方式廃止後、DockerAdapterからのフィルタ適用ロジックは削除されました。
> proxy方式（US-007）実装後に新しいフローが追加される予定です。
>
> **注意**: `getFilterConfig` / `updateFilterConfig`による`enabled`設定は現在もDBに保存されますが、
> 実際の通信制御には反映されません。US-007（proxy方式）完了までフィルタリングは機能しないため、
> `enabled: true`であっても通信は制限されません。

```text
DockerAdapter.createSession()
  │
  └─→ Docker: コンテナ起動（ネットワークフィルタリングなし）
```

## エラー処理

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| ValidationError | ルールの形式が不正 | エラーメッセージを返却、保存拒否 |
| ~~FilterApplicationError~~ | ~~iptablesルール適用失敗~~ | **廃止済み**（クラス削除） |
| DnsResolutionError | DNS解決失敗 | 警告ログ出力、該当ルールをスキップ |

## テスト観点

- [ ] 正常系: ルールのCRUD操作
- [ ] 正常系: ドメイン名のDNS解決
- [ ] 正常系: ワイルドカードドメインの解決
- [ ] 正常系: デフォルトテンプレートの適用
- [ ] 正常系: 重複ルール検出・スキップ
- [ ] 異常系: 不正なドメイン名/IPアドレスのバリデーション
- [ ] 異常系: DNS解決失敗時のフォールバック
- [ ] ~~異常系: iptables適用失敗時のフェイルセーフ~~ (廃止済み - proxy方式で再設計予定)
- [ ] 境界値: ポート番号0, 65535, null

## 関連要件

- [REQ-001](../../requirements/network-filtering/stories/US-001.md) @../../requirements/network-filtering/stories/US-001.md: ルールの設定管理
- [REQ-002](../../requirements/network-filtering/stories/US-002.md) @../../requirements/network-filtering/stories/US-002.md: コンテナ起動時の自動適用
- [REQ-003](../../requirements/network-filtering/stories/US-003.md) @../../requirements/network-filtering/stories/US-003.md: デフォルトテンプレート
- [REQ-004](../../requirements/network-filtering/stories/US-004.md) @../../requirements/network-filtering/stories/US-004.md: 状態確認・モニタリング
- [NFR-SEC](../../requirements/network-filtering/nfr/security.md) @../../requirements/network-filtering/nfr/security.md: セキュリティ要件
