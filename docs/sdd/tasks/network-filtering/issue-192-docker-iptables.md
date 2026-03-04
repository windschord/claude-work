# タスク: Issue #192 - Dockerイメージへのiptablesパッケージ追加

## ステータス: DONE

## タスク詳細

### TASK-192-01: Dockerfileへのiptables追加

**説明**: Dockerfileのrunnerステージにiptablesをインストールするよう修正する

**対象ファイル**: `Dockerfile`

**受入基準**:
- [x] runnerステージのapt-getコマンドにiptablesが追加されている
- [x] 既存のdocker-ce-cliインストールが維持されている
- [x] 既存のユニットテストが通過する

**完了サマリー**: Dockerfile Line 87のapt-getコマンドに `iptables` を追加した。
