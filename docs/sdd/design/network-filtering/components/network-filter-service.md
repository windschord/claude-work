# NetworkFilterService

## 概要

**目的**: ネットワークフィルタリングルールのCRUD管理、DNS解決、フィルタリング適用のオーケストレーション

**責務**:
- フィルタリングルールのCRUD操作（データベース永続化）
- 環境ごとのフィルタリング有効/無効管理
- ドメイン名のDNS解決とIPアドレスへの変換
- コンテナ起動時のフィルタリング適用オーケストレーション
- コンテナ停止時のクリーンアップオーケストレーション
- デフォルトテンプレートの提供
- 通信テスト（dry-run）の実行

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

#### `applyFilter(environmentId: string, containerSubnet: string): Promise<void>`

**説明**: コンテナ起動時にフィルタリングを適用。IptablesManagerを呼び出してiptablesルールを設定する。

**処理フロー**:
1. 環境のフィルタリング設定を確認
2. フィルタリングが無効なら何もしない
3. ルール一覧を取得
4. ドメインルールのDNS解決を実行
5. IptablesManagerにルール適用を依頼
6. 失敗時は例外をスローしてコンテナ起動を中止

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| environmentId | string | Yes | 環境ID |
| containerSubnet | string | Yes | コンテナのサブネット（例: 172.18.0.0/16） |

**例外**:
- `FilterApplicationError`: iptablesルール適用に失敗

---

#### `removeFilter(environmentId: string): Promise<void>`

**説明**: フィルタリングルールをクリーンアップ

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

#### `cleanupOrphanedRules(): Promise<void>`

**説明**: アプリケーション起動時に、孤立したiptablesルール（対応するコンテナが存在しないもの）をクリーンアップ

---

## 依存関係

### 依存するコンポーネント
- [IptablesManager](iptables-manager.md) @iptables-manager.md: iptablesルールの実行
- Drizzle ORM (src/lib/db.ts): データベース操作
- Node.js `dns` module: DNS解決

### 依存されるコンポーネント
- DockerAdapter (src/services/adapters/docker-adapter.ts): コンテナ起動・停止時に呼び出し
- API Routes: HTTP経由でのルール管理

## データフロー

### コンテナ起動時のフィルタリング適用

```
DockerAdapter.createSession()
  │
  ├─→ NetworkFilterService.getFilterConfig(envId)
  │     └─→ DB: SELECT FROM NetworkFilterConfig
  │
  ├─→ NetworkFilterService.applyFilter(envId, subnet)
  │     ├─→ DB: SELECT FROM NetworkFilterRule WHERE environment_id = envId
  │     ├─→ NetworkFilterService.resolveDomains(rules)
  │     │     └─→ dns.resolve4() / dns.resolve6()
  │     └─→ IptablesManager.setupFilterChain(envId, resolvedRules, subnet)
  │           ├─→ exec: iptables -N CWFILTER-<id>
  │           ├─→ exec: iptables -I DOCKER-USER -s <subnet> -j CWFILTER-<id>
  │           ├─→ exec: iptables -A CWFILTER-<id> -p udp --dport 53 -j ACCEPT
  │           ├─→ exec: iptables -A CWFILTER-<id> -d <ip> -p tcp --dport <port> -j ACCEPT
  │           └─→ exec: iptables -A CWFILTER-<id> -j DROP
  │
  └─→ Docker: コンテナ起動
```

## エラー処理

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| ValidationError | ルールの形式が不正 | エラーメッセージを返却、保存拒否 |
| FilterApplicationError | iptablesルール適用失敗 | コンテナ起動を中止、エラーログ出力 |
| DnsResolutionError | DNS解決失敗 | 警告ログ出力、該当ルールをスキップ |

## テスト観点

- [ ] 正常系: ルールのCRUD操作
- [ ] 正常系: ドメイン名のDNS解決
- [ ] 正常系: ワイルドカードドメインの解決
- [ ] 正常系: デフォルトテンプレートの適用
- [ ] 正常系: 重複ルール検出・スキップ
- [ ] 異常系: 不正なドメイン名/IPアドレスのバリデーション
- [ ] 異常系: DNS解決失敗時のフォールバック
- [ ] 異常系: iptables適用失敗時のフェイルセーフ
- [ ] 境界値: ポート番号0, 65535, null

## 関連要件

- [REQ-001](../../requirements/network-filtering/stories/US-001.md) @../../requirements/network-filtering/stories/US-001.md: ルールの設定管理
- [REQ-002](../../requirements/network-filtering/stories/US-002.md) @../../requirements/network-filtering/stories/US-002.md: コンテナ起動時の自動適用
- [REQ-003](../../requirements/network-filtering/stories/US-003.md) @../../requirements/network-filtering/stories/US-003.md: デフォルトテンプレート
- [REQ-004](../../requirements/network-filtering/stories/US-004.md) @../../requirements/network-filtering/stories/US-004.md: 状態確認・モニタリング
- [NFR-SEC](../../requirements/network-filtering/nfr/security.md) @../../requirements/network-filtering/nfr/security.md: セキュリティ要件
