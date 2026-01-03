# セットアップガイド

## 必要要件

- Node.js 20 以上
- Git
- Claude Code CLI（インストール済みであること）

### オプション要件（Dockerモード使用時）

- Docker Desktop または Docker Engine
- 最低 4GB のディスク空き容量（Docker イメージ用）

## クイックスタート

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
```

その他の環境変数については [ENV_VARS.md](ENV_VARS.md) を参照してください。

## 使い方

### 1. プロジェクト追加

Git リポジトリのパスを指定してプロジェクトを追加します:

```text
/path/to/your/git/repo
```

### 2. セッション作成

プロジェクトを開き、セッション名とプロンプトを入力してセッションを作成します。

## トラブルシューティング

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

### Claude Code が見つからない

Claude Code CLI がインストールされているか確認します:

```bash
claude --version
```

インストールされていない場合:

```bash
npm install -g claude-code
```

### Dockerモードのトラブルシューティング

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
