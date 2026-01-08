# セットアップガイド

## 必要要件

- Node.js 20 以上
- Docker 20.10 以上（Docker Desktop または Docker Engine）
- Claude Code CLI（ホストマシンにインストール済みであること）

## クイックスタート

### 1. Dockerイメージのビルド

セッション用のDockerイメージを事前にビルドしてください:

```bash
docker build -t claudework-session:latest -f docker/Dockerfile docker/
```

### 2. サーバー起動

```bash
npx claude-work start   # バックグラウンドで起動
npx claude-work stop    # 停止
```

または、フォアグラウンドで起動:

```bash
npx claude-work         # Ctrl+C で停止
```

初回実行時は以下が自動的にセットアップされます:

| ステップ | 処理内容 |
|---------|---------|
| 1. 環境設定 | `.env` がなければ `.env.example` からコピー |
| 2. Prisma | クライアントがなければ自動生成 |
| 3. データベース | DBがなければ自動作成 |
| 4. ビルド | `.next` がなければ自動ビルド |
| 5. 起動 | サーバー起動 |

サーバーが起動したら、ブラウザで `http://localhost:3000` を開きます。

### CLI コマンド

```bash
npx claude-work          # フォアグラウンドで起動
npx claude-work start    # バックグラウンドで起動（pm2経由）
npx claude-work stop     # 停止
npx claude-work restart  # 再起動
npx claude-work status   # 状態確認
npx claude-work logs     # ログ表示
npx claude-work help     # ヘルプ
```

## 環境変数のカスタマイズ

デフォルト設定で動作しますが、必要に応じて `.env` を編集できます:

```env
# データベースURL（通常は変更不要）
DATABASE_URL=file:../data/claudework.db

# ポート（オプション）
PORT=3000

# Dockerソケット（オプション、デフォルト: /var/run/docker.sock）
DOCKER_SOCKET=/var/run/docker.sock

# セッション用Dockerイメージ（オプション）
SESSION_IMAGE=claudework-session:latest
```

その他の環境変数については [ENV_VARS.md](ENV_VARS.md) を参照してください。

## 使い方

### 1. セッション作成

ホームページでセッションを作成します:

1. 「新しいセッション」ボタンをクリック
2. セッション名を入力
3. リポジトリURL（GitHubなど）を入力
4. ブランチ名を指定（オプション）
5. 「作成」をクリック

### 2. セッション開始

セッション一覧からセッションを選択し、「Start」ボタンでコンテナを起動します。
ターミナルが表示され、Claude Codeを直接操作できます。

### 3. セッション管理

- **Start**: コンテナを起動
- **Stop**: コンテナを停止
- **Delete**: セッションとコンテナを削除

## トラブルシューティング

### Dockerデーモンが起動していない

```bash
# Docker Desktop を起動するか、以下のコマンドでDocker Engineを起動
sudo systemctl start docker
```

### Dockerイメージがない

```bash
# イメージをビルド
docker build -t claudework-session:latest -f docker/Dockerfile docker/
```

### データベースエラー

データベースファイルが破損した場合、削除して再起動します:

```bash
rm -rf data/claudework.db
npx claude-work
```

### ポート競合

ポート 3000 が使用中の場合、別のポートを指定します:

```bash
PORT=3001 npx claude-work
```

### コンテナが起動しない

Docker logs でエラーを確認:

```bash
docker logs <container_id>
```

### 認証情報がマウントされない

Claude Code の認証情報（`~/.claude`）がホストに存在することを確認:

```bash
ls -la ~/.claude
```
