# 技術的決定: DEC-001 - Docker内でのGit操作実行

## ステータス

**決定済み** - 2026-02-17

## コンテキスト

リモートリポジトリのクローン、更新、ブランチ取得をどこで実行するかを決定する必要がある。

### 選択肢

1. **ホスト環境で実行**
   - ホスト上でGit CLIを直接実行
   - 既存のGitServiceを活用
   - シンプルで実装が容易

2. **Docker環境内で実行**（採用）
   - Docker内でGit CLIを実行
   - 完全な環境分離
   - SSH認証の一貫性

3. **ハイブリッド**
   - クローンはホスト、その後Docker内で使用
   - 複雑な同期が必要

## 決定

**Docker環境内でGit操作を実行する**

## 根拠

### メリット

1. **完全な環境分離**:
   - ホストの環境（Gitバージョン、設定）に依存しない
   - Docker内で完結するため、環境の再現性が高い

2. **SSH認証の一貫性**:
   - Claude Code実行時もDocker内でSSH認証を使用
   - Git操作も同じSSH設定を使用
   - 認証周りの設定が統一される

3. **セキュリティ強化**:
   - Docker環境のセキュリティオプション（`--cap-drop=ALL`等）を活用
   - ホストへの影響を最小化

4. **将来の拡張性**:
   - SSH以外の認証方法を追加する際も、Docker内で完結
   - リモート実行環境（SSH）への拡張も容易

### デメリットと対応

1. **性能オーバーヘッド**:
   - Dockerコンテナ起動のオーバーヘッド
   - 対応: 軽量コンテナ、キャッシュ活用で最小化

2. **実装複雑度**:
   - Docker実行コマンドの構築が必要
   - 対応: DockerAdapterに抽象化、既存SSH設定マウント実装を活用

3. **デバッグの難しさ**:
   - Docker内での実行のため、直接的なデバッグが困難
   - 対応: 詳細なログ出力、エラーメッセージの改善

## 実装詳細

### Docker実行例

```bash
docker run --rm \
  -v /path/to/target:/workspace/target \
  -v ~/.ssh:/root/.ssh:ro \
  -v $SSH_AUTH_SOCK:/ssh-agent \
  -e SSH_AUTH_SOCK=/ssh-agent \
  -e GIT_TERMINAL_PROMPT=0 \
  node:20-alpine \
  git clone git@github.com:user/repo.git /workspace/target
```

### SSH認証設定

- `~/.ssh`ディレクトリ: 読み取り専用でマウント
- SSH Agentソケット: 転送
- `GIT_TERMINAL_PROMPT=0`: インタラクティブプロンプト無効化

## 影響範囲

- DockerAdapter: Git操作メソッドの追加
- RemoteRepoService: DockerAdapter経由でのGit操作呼び出し
- テスト: Docker環境でのテストが必要

## 代替案の却下理由

### 選択肢1: ホスト環境で実行

- 却下理由: 環境分離の原則に反する。Claude Code実行環境と統一されない。

### 選択肢3: ハイブリッド

- 却下理由: 複雑度が高い。ホストとDocker間の同期が必要で、エラーの可能性が増える。

## 参考資料

- 既存のDockerAdapter実装: `src/services/adapters/docker-adapter.ts`
- SSH設定マウント: 既に実装済み（89-103行目）
- 要件定義: US-003 - Docker内でのGit操作

## レビュー

- レビュアー: Claude Code
- レビュー日: 2026-02-17
- 承認: 承認済み
