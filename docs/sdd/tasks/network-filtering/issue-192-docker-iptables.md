# タスク: Issue #192 - Dockerイメージへのiptablesパッケージ追加

## ステータス: DONE

## タスク詳細

### TASK-192-01: Dockerfileへのiptables追加

**説明**: Dockerfileのrunnerステージにiptablesをインストールするよう修正する

**対象ファイル**: `Dockerfile`

**受入基準**:
- [x] runnerステージのapt-getコマンドにiptablesが追加されている
- [x] 既存のdocker-ce-cliインストールが維持されている
- [x] 既存テストに回帰がないこと（202件中201件成功、1件は既知の無関連失敗）

**完了サマリー**: runnerステージのapt-getコマンドに `iptables` を追加した。
