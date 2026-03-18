# Docker Compose環境でのiptables実行権限・nftables互換性問題

## 問題概要

Docker Compose環境でNetworkFilter機能を有効化してセッションを起動すると、iptablesコマンドの実行に失敗し、フェイルセーフによりコンテナ起動が中止される。

## 現象

### エラー1: Permission denied

```text
iptables v1.8.9 (nf_tables): Could not fetch rule set generation id: Permission denied (you must be root)
```

- `checkAvailability()` で `iptables --version` は成功するが、`iptables -S DOCKER-USER` で権限エラー
- `docker-compose.yml` で `cap_add: NET_ADMIN` は設定済み

### エラー2: nftables互換性エラー（rootで実行した場合）

```text
iptables v1.8.9 (nf_tables): chain `DOCKER-USER' in table `filter' is incompatible, use 'nft' tool.
```

- rootユーザーでコンテナのネットワーク名前空間から `iptables -S DOCKER-USER` を実行しても、DOCKER-USERチェインはホストの名前空間にのみ存在するためアクセス不可

### フェイルセーフの動作

```text
FilterApplicationError: iptablesが利用不可のためフィルタリングを適用できません
```

- 設計通り、iptablesが利用不可と判定 → コンテナを停止・削除（無防備状態での稼働を防止）

## 根本原因

### 原因1: 非rootユーザーでのiptables実行権限

- `Dockerfile:116` で `USER node` に切り替え（セキュリティのため非root実行）
- `docker-compose.yml` で `cap_add: NET_ADMIN` を設定しているが、これは**コンテナのcapability bounding set**にNET_ADMINを追加するだけ
- 非rootプロセスがiptablesを実行するには、バイナリにfile capability (`setcap cap_net_admin+ep`)を設定するか、sudoでroot権限を取得する必要がある

### 原因2: コンテナ名前空間とホスト名前空間の分離

- DOCKER-USERチェインはホストのネットワーク名前空間に存在する
- コンテナは独自のネットワーク名前空間を持つため、コンテナ内からiptablesを実行してもホストのDOCKER-USERチェインにはアクセスできない
- `nsenter -t 1 -n` でホストのネットワーク名前空間に入る必要がある

## 試行した修正アプローチ

### アプローチ1: setcap file capability（失敗）

- `setcap cap_net_admin+ep` でiptablesバイナリにcapability付与を試みた
- DockerのセキュリティモデルではFile capabilityによる非rootユーザーへのcapability昇格が制限される
- `/run/xtables.lock` のPermission deniedも発生

### アプローチ2: sudo + iptables-legacy（失敗）

- sudoでroot権限を取得し、iptables-legacyを使用する方式
- ホストのDockerがnftablesでチェインを管理しているため、legacyテーブルにはDOCKER-USERが存在しない
- `iptables-legacy -S DOCKER-USER` → `iptables: No chain/target/match by that name.`

### アプローチ3: sudo nsenter + iptables-nft（成功）

- `sudo nsenter -t 1 -n iptables` でホストのネットワーク名前空間に入ってiptablesを実行
- ホストのiptables（nft）がそのまま使用されるため、DOCKER-USERチェインに正常にアクセス可能
- 必要な設定: `pid: host`, `cap_add: [NET_ADMIN, SYS_ADMIN, SYS_PTRACE]`, `security_opt: [apparmor=unconfined]`

## 仕様との照合

- **設計ドキュメント** (`docs/sdd/design/network-filtering/components/iptables-manager.md`):
  - Docker Compose環境でのnsenter方式が未記載だった
- **乖離分類**: 仕様漏れ
  - nsenterによるホスト名前空間アクセスの方法が未定義
  - docker-compose.ymlの必要な権限設定が未記載

## 最終修正内容

### 1. Dockerfile変更

- `sudo`パッケージのインストール追加
- 制限付きヘルパースクリプト(`iptables-host.sh`)の作成（iptables/iptables-restoreのみ許可）
- nodeユーザーにヘルパースクリプトのみpasswordless sudo許可（nsenterの直接実行は不許可）

### 2. docker-compose.yml変更

- `pid: host` 追加（nsenterでホストのPID 1にアクセスするため）
- `cap_add: [NET_ADMIN, SYS_ADMIN, SYS_PTRACE]` 追加
- `security_opt: [apparmor=unconfined]` 追加

### 3. IptablesManager変更 (src/services/iptables-manager.ts)

- `_useNsenter`フラグ追加（`RUNNING_IN_DOCKER`環境変数で判定）
- `_iptables()`と`_iptablesRestore()`ヘルパーメソッド追加
- Docker環境では `sudo iptables-host.sh iptables` 経由で実行（制限付きヘルパースクリプト）

### 4. 設計ドキュメント更新

- nsenterアーキテクチャの詳細記載
- 必要なdocker-compose.yml設定の記載

## 検証結果

1. iptablesルール適用成功（CWFILTERチェイン作成、DOCKER-USERからのジャンプ確認）
2. 通信テスト成功:
   - 許可先(api.anthropic.com:443) → HTTP 404（接続成功）
   - 非許可先(github.com, google.com) → タイムアウト（DROP動作確認）
3. セッション停止後のクリーンアップ → CWFILTERチェインが残存（Issue #193の別問題として追跡）
