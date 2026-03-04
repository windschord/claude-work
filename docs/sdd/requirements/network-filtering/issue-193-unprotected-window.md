# 要件定義: ネットワークフィルタリング無保護ウィンドウの修正 (Issue #193)

## 概要

- **Issue**: #193 ネットワークフィルタリング: コンテナ起動からフィルタ適用までの無保護ウィンドウ
- **優先度**: High（セキュリティ問題）
- **種別**: バグ修正

## 背景・問題

現在の実装では、コンテナ起動 (`container.start()`) からiptablesフィルタ適用 (`applyFilter()`) 完了までの間に、コンテナがネットワークへの無制限アクセスが可能な状態（無保護ウィンドウ）が存在する。

### 問題のあるフロー

```text
container.start()          ← ネットワーク通信可能になる
getContainerSubnet()       ← コンテナ情報取得（inspect呼び出し）
applyFilter()              ← DNS解決 + iptables-restore（数秒かかる可能性）
waitForContainerReady()    ← Claude Code起動待ち
```

この間、Claude Codeがネットワーク通信を開始できる可能性がある。

## ユーザーストーリー

### US-193-001: セキュアなコンテナ起動

**ストーリー**: セキュリティ管理者として、ネットワークフィルタリングが有効な環境でコンテナが起動する際、iptablesルールが適用されるまでコンテナがネットワーク通信を行えないようにしたい。これにより、フィルタリングルールをバイパスして外部通信が行われるリスクを排除できる。

**受入基準**:
- フィルタリングが有効な環境でコンテナ起動時、iptablesルール適用完了前にコンテナがネットワーク通信できないこと
- フィルタリングが無効な環境では従来通りの動作を維持すること
- コンテナはiptablesルール適用後に正常にネットワーク通信できること（ホワイトリストルールに従って）

### US-193-002: 既存機能への影響なし

**ストーリー**: 開発者として、この修正によって既存のコンテナ起動フローや他の機能が影響を受けないことを確認したい。

**受入基準**:
- フィルタリングが無効な環境では、コンテナ起動フローが変更されないこと
- フィルタリングが有効な環境でも、コンテナは正常に起動し、Claude Codeが動作すること
- 既存のテストがすべてパスすること

## 機能要件

### REQ-193-001: コンテナ起動前のネットワーク分離

フィルタリングが有効な環境において:
- コンテナ作成時に `NetworkMode: 'none'` を使用し、ネットワーク無し状態で起動する
- コンテナ起動後にDockerのbridgeネットワークに接続する
- ネットワーク接続後にgetContainerSubnetでサブネットを取得し、iptablesルールを適用する

### REQ-193-002: フィルタリング有効判定

- `networkFilterService.getFilterConfig(environmentId)` を用いてフィルタリングの有効/無効を判定する
- `NetworkFilterService` に `isFilterEnabled(environmentId)` ヘルパーメソッドを追加する
- このメソッドはフィルタリング設定を確認し、設定が存在しかつ有効な場合のみ `true` を返す

### REQ-193-003: エラーハンドリング

- ネットワーク接続に失敗した場合、コンテナをクリーンアップしてエラーをスローする
- applyFilterが失敗した場合の既存のエラーハンドリングを維持する

## 非機能要件

### NFR-193-001: セキュリティ

- フィルタリング有効時の無保護ウィンドウを最小化する（start時点でネットワークなし、bridge接続からiptables適用完了までの短い時間のみ許容）
- フィルタリング無効時は既存動作を維持する

### NFR-193-002: 互換性

- DockerのNetworkModeに関するDockerAPIの仕様に準拠する
- dockerodeのAPIを使用してネットワーク操作を行う

### NFR-193-003: テスト容易性

- すべての変更がユニットテストでカバーされること
- 既存のテストを壊さないこと

## 関連ドキュメント

- 設計書: [docs/sdd/design/network-filtering/issue-193-unprotected-window.md](../../design/network-filtering/issue-193-unprotected-window.md)
- タスク: [docs/sdd/tasks/network-filtering/issue-193-unprotected-window.md](../../tasks/network-filtering/issue-193-unprotected-window.md)
- 既存要件: [docs/sdd/requirements/network-filtering/index.md](index.md)
