# セットアップガイド

## 必要要件

- Git（リポジトリのクローンに使用）
- Docker Engine 20.10 以上
- Docker Compose V2.24 以上

## セットアップ

Docker Composeを使用すると、環境構築なしで起動できます。

### 手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/windschord/claude-work.git
cd claude-work

# 2. .env を作成
cp .env.example .env

# 3. (Linux のみ) docker.sock のアクセス権を設定
#    macOS / Docker Desktop では不要（docker.sock のパーミッションが異なるため）
grep -q '^DOCKER_GID=' .env && sed -i "s/^DOCKER_GID=.*/DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)/" .env || echo "DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)" >> .env

# 4. 起動
docker compose up -d
```

ブラウザで `http://localhost:3000`（`HOST_PORT` を変更した場合は該当ポート）を開きます。

### 設定のカスタマイズ

セットアップ手順で作成した `.env` を編集して設定を変更できます（`.env.example` を参考）:

主な設定:

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `HOST_PORT` | ホスト側のポート番号 | `3000` |
| `LOG_LEVEL` | ログレベル | `info` |
| `ALLOWED_ORIGINS` | CORS許可オリジン | なし |
| `ALLOWED_PROJECT_DIRS` | 許可するプロジェクトディレクトリ | なし（全て許可） |
| `DOCKER_GID` | ホストの docker.sock グループ GID（Linux のみ） | なし |

### Docker Compose コマンド

```bash
docker compose up -d           # バックグラウンドで起動
docker compose down            # 停止
docker compose up -d --build   # 再ビルドして起動
docker compose logs -f         # ログ表示
docker compose ps              # 状態確認
```

### ポート変更

```bash
HOST_PORT=3001 docker compose up -d
```

永続的に変更するには `.env` の `HOST_PORT` を直接編集してください。

## 使い方

### 1. プロジェクト追加

#### ローカルGitリポジトリから追加

既存のGitリポジトリのパスを指定:

```text
/path/to/your/git/repo
```

#### リモートリポジトリからクローン

GitHub/GitLabなどのリモートリポジトリから直接クローン:

**SSH URL（推奨）:**
```text
git@github.com:user/repo.git
```

**HTTPS URL:**
```text
https://github.com/user/repo.git
```

**保存場所の選択:**
- **Docker環境**（推奨）: SSH Agent認証が自動で利用可能
- **ホスト環境**: ローカルのGit設定を使用

**プライベートリポジトリ（HTTPS）:**
- GitHub Personal Access Token (PAT) を事前に設定画面で登録
- クローン時にPATを選択

### 2. セッション作成

プロジェクトを開き、以下を設定してセッションを作成:

- **セッション名**: 任意の名前（省略可）
- **ブランチ**: 作業するブランチを選択
- **実行環境**: Docker（推奨）、Host、SSH から選択
- **権限スキップ**: Docker環境選択時に `--dangerously-skip-permissions` オプションの動作を設定（Docker環境のみ）
  - 環境デフォルト・有効・無効から選択可能
- **プロンプト**: 初期プロンプトを入力

### 3. Docker環境の詳細設定

Docker環境ではポートマッピングやボリュームマウントを設定できます。Settings → Environments から各環境の設定を行います。

詳細は [Docker環境詳細設定ガイド](DOCKER_ENVIRONMENT.md) を参照してください。

## トラブルシューティング

### コンテナの問題

#### コンテナが起動しない

```bash
# ログを確認
docker compose logs

# コンテナの状態を確認
docker compose ps -a
```

#### ポート競合

ポート 3000 が使用中の場合:

```bash
HOST_PORT=3001 docker compose up -d
```

#### ビルドエラー

```bash
# キャッシュなしで再ビルド
docker compose build --no-cache
docker compose up -d
```

#### データベースエラー

```bash
# DBを削除して再起動（データは失われます）
rm -f data/claudework.db*
docker compose down && docker compose up -d
```

#### docker.sock の権限エラー

コンテナ内から Docker 操作ができない場合（`permission denied` エラーや `/api/health` で `dockerEnabled=false`）:

```bash
# ホストの docker グループ GID を確認
stat -c '%g' /var/run/docker.sock

# .env に DOCKER_GID を設定
echo "DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)" >> .env

# コンテナを再作成して反映
docker compose up -d --force-recreate
```

`docker-compose.yml` の `group_add` がこの GID を使用して、`node` ユーザーに docker.sock へのアクセス権を付与します。

### Docker実行環境のトラブルシューティング

#### Docker が見つからない

Docker がインストールされているか確認します:

```bash
docker --version
```

インストールされていない場合は [Docker 公式サイト](https://docs.docker.com/get-docker/) からインストールしてください。

#### Docker デーモンが起動していない

```bash
# macOS / Windows
# Docker Desktop を起動

# Linux
sudo systemctl start docker
```

#### Docker イメージのビルド

Docker イメージがない場合は自動的にビルドされますが、手動でビルドすることもできます:

```bash
docker build -t claude-code-sandboxed:latest docker/
```

#### Dockerコンテナの権限エラー（Linux）

Linux でユーザーを docker グループに追加します:

```bash
sudo usermod -aG docker $USER
# ログアウト後、再ログインが必要
```

#### ボリュームマウントエラー

Docker Desktop の設定で、プロジェクトディレクトリへのファイル共有を許可してください。

#### 認証情報が見つからない

Dockerモードで Claude Code を使用するには、事前に Claude Code でログインしておく必要があります:

```bash
claude login
```
