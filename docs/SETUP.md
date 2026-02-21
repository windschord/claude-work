# セットアップガイド

## 必要要件

- Node.js 20 以上
- Git
- Claude Code CLI（インストール済みであること）
- **Docker Desktop または Docker Engine**（推奨、デフォルト実行環境）

### Docker環境（推奨）

ClaudeWorkはDockerをデフォルトの実行環境として使用します:

- **セキュリティ**: 隔離された環境でClaude Codeを実行
- **SSH鍵の自動マウント**: `~/.ssh/` がコンテナに読み取り専用でマウントされ、プライベートリポジトリへのアクセスが可能
- **独立した認証**: 環境ごとに独立したClaude認証情報を管理
- **必要ディスク容量**: 最低 4GB（Docker イメージとボリューム用）

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
| 2. データベース | スキーマを自動適用 |
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
- **プロンプト**: 初期プロンプトを入力

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
