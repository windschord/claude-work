# IptablesManager

> **廃止済み**: このコンポーネントは廃止されました。`src/services/iptables-manager.ts` は削除済みです。
> proxy方式（US-007）への移行が予定されています。仕様は別ブランチで策定中です。

## 概要（廃止前の記録）

**目的**: iptablesコマンドの実行を抽象化し、フィルタリングルールの生成・適用・クリーンアップを行う

**廃止理由**: Docker Compose環境でのホストiptablesへのアクセスに `pid: host`, `NET_ADMIN`, `SYS_ADMIN`, `SYS_PTRACE` 等の特権設定が必要で、セキュリティリスクが高く設定の複雑性も大きいため廃止。proxy方式に移行予定。

**ファイルパス**: `src/services/iptables-manager.ts` (削除済み)

---

## インターフェース

### 公開メソッド

#### `checkAvailability(): Promise<boolean>`

**説明**: iptablesコマンドが利用可能かチェック

**処理**: `iptables --version`、`iptables-restore --version`、`iptables -S DOCKER-USER` を実行し、全て成功すればtrue（バイナリ存在 + 権限確認）

---

#### `setupFilterChain(envId: string, resolvedRules: ResolvedRule[], containerSubnet: string): Promise<void>`

**説明**: 環境用のiptablesフィルタチェインを作成し、ホワイトリストルールを適用

**処理フロー**:
1. チェイン名生成: `CWFILTER-<sha256(envId)の先頭12文字>`
2. 既存チェインがあれば削除（冪等性確保）
3. iptables-restore形式で一括適用（チェイン作成、ルール追加を1回で実行）
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
1. チェイン名生成: `CWFILTER-<sha256(envId)の先頭12文字>`
2. DOCKER-USER chainからジャンプルール削除:
   `iptables -S DOCKER-USER` でルール一覧を取得し、`-j <chain>` を含む全ルールを `-A` → `-D` に変換して削除（追加時と同一条件で削除）
3. チェイン内ルール全削除: `iptables -F <chain>`
4. チェイン削除: `iptables -X <chain>`

---

#### `cleanupOrphanedChains(): Promise<void>`

**説明**: `CWFILTER-` プレフィックスを持ち、参照カウントが0のチェインを孤立チェインとして削除

**処理フロー**:
1. `iptables -L -n` で全チェインを取得
2. `CWFILTER-*` パターンにマッチするチェインを抽出
3. 各チェインの参照カウント（references）を確認
4. references==0（どこからもジャンプされていない）チェインのみ削除

---

#### `listActiveChains(): Promise<ActiveChainInfo[]>`

**説明**: 現在アクティブなフィルタチェイン一覧を取得

**戻り値**: `ActiveChainInfo[]` - チェイン名、参照カウント、envIdプレフィックス

---

#### `generateIptablesRules(chainName: string, resolvedRules: ResolvedRule[], containerSubnet: string): string`

**説明**: iptables-restore形式のルールセットを生成（テスト用にも公開）

**戻り値**: iptables-restore形式のテキスト

---

## 内部設計

### チェイン命名規則

```text
CWFILTER-<sha256(environmentId)の先頭12文字>
```

例: `CWFILTER-a1b2c3d4e5f6`

この命名規則により:
- iptablesのチェイン名長制限（30文字以下）に収まる
- 環境IDとの対応が追跡可能
- `CWFILTER-` プレフィックスで孤立ルールの特定が容易

### iptablesルールの構造

```text
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

- **HOST環境**: `child_process.execFile('iptables', [...args])` で直接実行（root権限が必要）
- **Docker Compose環境**: `sudo /usr/local/sbin/iptables-host.sh iptables ...` で実行（制限付きヘルパースクリプト経由）

#### Docker Compose環境での実行アーキテクチャ

Docker Compose環境ではDOCKER-USERチェインはホストのネットワーク名前空間に存在する。コンテナ独自のネットワーク名前空間からはアクセスできないため、制限付きヘルパースクリプトを介してホストの名前空間に入りiptablesを操作する。

```text
ClaudeWorkコンテナ (node user)
  └→ sudo /usr/local/sbin/iptables-host.sh iptables ...
       └→ ヘルパースクリプト: コマンド名を検証（iptables/iptables-restoreのみ許可）
            └→ nsenter -t 1 -n -- iptables ...
                 └→ ホストのネットワーク名前空間でiptablesを実行
```

#### セキュリティ設計

nodeユーザーに`nsenter`の直接sudo実行を許可すると、任意のコマンドをホスト名前空間で実行できてしまう。これを防ぐため、iptables/iptables-restoreのみを許可するヘルパースクリプト(`iptables-host.sh`)を介してnsenterを実行する。sudoers設定はこのヘルパースクリプトのみを許可する。

#### 必要な設定

**docker-compose.yml:**
```yaml
pid: host          # nsenterでホストのPID 1の名前空間にアクセスするため
cap_add:
  - NET_ADMIN      # iptablesルールの操作に必要
  - SYS_ADMIN      # nsenterで名前空間にアクセスするために必要
  - SYS_PTRACE     # /proc/1/ns/netへのアクセスに必要
security_opt:
  - apparmor=unconfined  # AppArmorによるnsenterブロックを回避
```

**Dockerfile:**
```dockerfile
# 制限付きヘルパースクリプト（iptables/iptables-restoreのみ許可）
COPY <<'HELPER' /usr/local/sbin/iptables-host.sh
#!/bin/sh
set -eu
case "$1" in
  iptables|iptables-restore) ;;
  *) echo "Unsupported command: $1" >&2; exit 1 ;;
esac
exec /usr/bin/nsenter -t 1 -n -- "$@"
HELPER
# nodeユーザーにはこのヘルパーのみをpasswordless sudoで許可
RUN echo "node ALL=(root) NOPASSWD: /usr/local/sbin/iptables-host.sh" > /etc/sudoers.d/iptables-node
```

#### iptables-nft vs iptables-legacy

ホストのDockerバージョンによって、DOCKER-USERチェインがnftablesまたはlegacy xtablesで管理される。`nsenter -t 1 -n` はネットワーク名前空間のみを切り替えるため、実行される `iptables` バイナリ自体はコンテナ側で解決される。結果として、コンテナのiptables-nftバイナリがホストネットワーク名前空間上のDOCKER-USERチェインへアクセスできる。

#### IptablesManager の実行モード判定

`isRunningInDocker()`（`RUNNING_IN_DOCKER`環境変数または`/.dockerenv`存在で判定）:
- `true`: `sudo /usr/local/sbin/iptables-host.sh iptables`（または `iptables-restore`）経由で実行
- 未設定/false: `iptables` を直接実行（HOST環境）

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
