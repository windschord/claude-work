# [BugFix] Docker Compose環境でのiptables実行権限・nftables互換性修正

## ステータス: DONE

## 関連

- 分析レポート: `docs/sdd/troubleshooting/2026-03-06-iptables-permission-nftables/analysis.md`
- 設計: `docs/sdd/design/network-filtering/components/iptables-manager.md`

## タスク内容

### タスク1: Dockerfile修正（sudo + nsenter設定）

**対象ファイル**: `Dockerfile`

**変更内容**:
runner stageで以下を実施:

1. `sudo`パッケージを既存のapt-get installに追加
2. nodeユーザーにnsenterのpasswordless sudo許可を設定

```dockerfile
# sudoインストール（既存のapt-get installに追加）
&& apt-get install -y --no-install-recommends docker-ce-cli iptables sudo \

# nodeユーザーがnsenter + iptablesをpasswordless sudoで実行できるように設定
RUN echo "node ALL=(root) NOPASSWD: /usr/bin/nsenter" > /etc/sudoers.d/iptables-node \
    && chmod 0440 /etc/sudoers.d/iptables-node
```

### タスク2: docker-compose.yml修正

**対象ファイル**: `docker-compose.yml`

**変更内容**:
nsenterでホストの名前空間にアクセスするための権限設定を追加:

```yaml
pid: host
cap_add:
  - NET_ADMIN
  - SYS_ADMIN
  - SYS_PTRACE
security_opt:
  - apparmor=unconfined
```

### タスク3: IptablesManager修正（nsenter対応）

**対象ファイル**: `src/services/iptables-manager.ts`

**変更内容**:
- `_useNsenter`フラグ追加（`RUNNING_IN_DOCKER`環境変数で判定）
- `_iptables()`ヘルパー: Docker環境では `sudo nsenter -t 1 -n iptables` 経由で実行
- `_iptablesRestore()`ヘルパー: Docker環境では `sudo nsenter -t 1 -n iptables-restore` 経由で実行
- 全てのiptables直接呼び出しをヘルパー経由に変更

### タスク4: 設計ドキュメント更新

**対象ファイル**: `docs/sdd/design/network-filtering/components/iptables-manager.md`

**変更内容**: 「コマンド実行方式」セクションを全面更新:
- nsenterアーキテクチャの詳細記載
- 必要なdocker-compose.yml設定の記載
- Dockerfile設定の記載
- iptables-nft vs iptables-legacy の説明

### タスク5: ビルド・動作検証

1. ローカルでDockerイメージをビルド
2. コンテナ起動して以下を確認:
   - nodeユーザーで `sudo nsenter -t 1 -n iptables -S DOCKER-USER` が成功すること
3. NWフィルタを有効化してセッション起動
4. `iptables -L CWFILTER-*` でルールが適用されていることを確認
5. サンドボックスコンテナから通信テスト（許可先/非許可先）

**検証結果**: 全項目成功（分析レポート参照）
