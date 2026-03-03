# IptablesManager

## 概要

**目的**: iptablesコマンドの実行を抽象化し、フィルタリングルールの生成・適用・クリーンアップを行う

**責務**:
- iptablesチェインの作成・削除
- DOCKER-USER chainへのジャンプルール追加・削除
- ホワイトリストルールのiptablesコマンド生成
- ルールの一括適用（iptables-restore形式）
- 孤立ルールのクリーンアップ
- iptablesコマンドの利用可否チェック

**ファイルパス**: `src/services/iptables-manager.ts`

---

## インターフェース

### 公開メソッド

#### `checkAvailability(): Promise<boolean>`

**説明**: iptablesコマンドが利用可能かチェック

**処理**: `iptables --version` を実行し、成功すればtrue

---

#### `setupFilterChain(envId: string, resolvedRules: ResolvedRule[], containerSubnet: string): Promise<void>`

**説明**: 環境用のiptablesフィルタチェインを作成し、ホワイトリストルールを適用

**処理フロー**:
1. チェイン名生成: `CWFILTER-<envIdの先頭8文字>`
2. 既存チェインがあれば削除（冪等性確保）
3. 新規チェイン作成: `iptables -N <chain>`
4. DOCKER-USER chainにジャンプルール追加:
   `iptables -I DOCKER-USER -s <subnet> -j <chain>`
5. DNS通信許可:
   `iptables -A <chain> -p udp --dport 53 -j ACCEPT`
   `iptables -A <chain> -p tcp --dport 53 -j ACCEPT`
6. 確立済み接続の許可:
   `iptables -A <chain> -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`
7. ホワイトリストルール追加（各resolvedRuleに対して）:
   `iptables -A <chain> -d <ip> [-p tcp --dport <port>] -j ACCEPT`
8. デフォルトDROP:
   `iptables -A <chain> -j DROP`

**パラメータ**:
| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| envId | string | Yes | 環境ID |
| resolvedRules | ResolvedRule[] | Yes | IP解決済みルール |
| containerSubnet | string | Yes | コンテナサブネット |

**例外**:
- `IptablesError`: コマンド実行失敗

---

#### `removeFilterChain(envId: string): Promise<void>`

**説明**: 環境用のiptablesフィルタチェインを削除

**処理フロー**:
1. チェイン名生成: `CWFILTER-<envIdの先頭8文字>`
2. DOCKER-USER chainからジャンプルール削除:
   `iptables -D DOCKER-USER -j <chain>` (存在する全てのジャンプルール)
3. チェイン内ルール全削除: `iptables -F <chain>`
4. チェイン削除: `iptables -X <chain>`

---

#### `cleanupOrphanedChains(): Promise<void>`

**説明**: `CWFILTER-` プレフィックスを持つが、対応する環境が存在しないチェインを削除

**処理フロー**:
1. `iptables -L -n` で全チェインを取得
2. `CWFILTER-*` パターンにマッチするチェインを抽出
3. 各チェインに対して、対応する環境がDBに存在するか確認
4. 存在しないものを削除

---

#### `listActiveChains(): Promise<ActiveChainInfo[]>`

**説明**: 現在アクティブなフィルタチェイン一覧を取得

**戻り値**: `ActiveChainInfo[]` - チェイン名、ルール数、参照カウント

---

#### `generateIptablesRules(chainName: string, resolvedRules: ResolvedRule[], containerSubnet: string): string`

**説明**: iptables-restore形式のルールセットを生成（テスト用にも公開）

**戻り値**: iptables-restore形式のテキスト

---

## 内部設計

### チェイン命名規則

```
CWFILTER-<environmentIdの先頭8文字>
```

例: `CWFILTER-a1b2c3d4`

この命名規則により:
- iptablesのチェイン名長制限（30文字以下）に収まる
- 環境IDとの対応が追跡可能
- `CWFILTER-` プレフィックスで孤立ルールの特定が容易

### iptablesルールの構造

```
*filter
:CWFILTER-<id> - [0:0]

# DOCKER-USERからのジャンプ
-I DOCKER-USER -s <container-subnet> -j CWFILTER-<id>

# DNS許可
-A CWFILTER-<id> -p udp --dport 53 -j ACCEPT
-A CWFILTER-<id> -p tcp --dport 53 -j ACCEPT

# 確立済み接続
-A CWFILTER-<id> -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# ホワイトリスト（例）
-A CWFILTER-<id> -d 104.18.0.0/16 -p tcp --dport 443 -j ACCEPT
-A CWFILTER-<id> -d 140.82.112.0/20 -p tcp --dport 443 -j ACCEPT

# デフォルト拒否
-A CWFILTER-<id> -j DROP

COMMIT
```

### コマンド実行方式

- **HOST環境**: `child_process.execFile('iptables', [...args])` で直接実行
- **Docker Compose環境**: ClaudeWorkコンテナに`NET_ADMIN` capabilityが必要。`nsenter`経由でホストのネットワーク名前空間にアクセスするか、`--network=host`モードで実行

### 冪等性の確保

全ての操作は冪等に設計:
- `setupFilterChain`: 既存チェインがあれば先に削除してから再作成
- `removeFilterChain`: チェインが存在しない場合はエラーを抑制
- `cleanupOrphanedChains`: 毎回全チェインをスキャンして不要なもののみ削除

---

## 依存関係

### 依存するコンポーネント
- Node.js `child_process`: iptablesコマンド実行
- Winston logger: ログ出力

### 依存されるコンポーネント
- [NetworkFilterService](network-filter-service.md) @network-filter-service.md: フィルタリング適用時に呼び出し

## エラー処理

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| IptablesNotAvailable | iptablesコマンドが存在しない | 呼び出し元にエラーをスロー |
| IptablesPermissionDenied | root権限不足 | 呼び出し元にエラーをスロー |
| ChainAlreadyExists | チェイン作成時に既存 | 既存を削除してから再作成（冪等） |
| ChainNotFound | チェイン削除時に不存在 | エラーを抑制（冪等） |

## テスト観点

- [ ] 正常系: iptablesルール生成のフォーマット検証
- [ ] 正常系: チェイン作成・削除の冪等性
- [ ] 正常系: 孤立チェインのクリーンアップ
- [ ] 異常系: iptablesコマンド利用不可時のエラー
- [ ] 異常系: 権限不足時のエラー
- [ ] 境界値: ルール0件時のデフォルトDROPのみ

## 関連要件

- [REQ-002](../../requirements/network-filtering/stories/US-002.md) @../../requirements/network-filtering/stories/US-002.md: コンテナ起動時の自動適用
- [NFR-SEC-001](../../requirements/network-filtering/nfr/security.md) @../../requirements/network-filtering/nfr/security.md: デフォルト拒否ポリシー
- [NFR-SEC-004](../../requirements/network-filtering/nfr/security.md) @../../requirements/network-filtering/nfr/security.md: クリーンアップ
