# セットアップガイド

## 必要要件

- Node.js 20 以上
- Git
- Claude Code CLI（インストール済みであること）

## クイックスタート

```bash
npx claude-work
```

これだけで起動できます。初回実行時は以下が自動的にセットアップされます:

| ステップ | 処理内容 |
|---------|---------|
| 1. 環境設定 | `.env` がなければ `.env.example` からコピー |
| 2. Prisma | クライアントがなければ自動生成 |
| 3. データベース | DBがなければ自動作成 |
| 4. ビルド | `.next` がなければ自動ビルド |
| 5. 起動 | サーバー起動 |

サーバーが起動したら、ブラウザで `http://localhost:3000` を開きます。

## 環境変数のカスタマイズ

デフォルト設定で動作しますが、本番環境では `.env` を編集してください:

```env
# 認証トークン（ログインに使用）
CLAUDE_WORK_TOKEN=your-secret-token

# セッションシークレット（32文字以上）
SESSION_SECRET=your-32-character-or-longer-secret-key

# データベースURL（通常は変更不要）
DATABASE_URL=file:../data/claudework.db

# ポート（オプション）
PORT=3000
```

その他の環境変数については [ENV_VARS.md](ENV_VARS.md) を参照してください。

## 使い方

### 1. ログイン

設定した認証トークン（デフォルト: `your-secure-token-here`）でログインします。

### 2. プロジェクト追加

Git リポジトリのパスを指定してプロジェクトを追加します:

```text
/path/to/your/git/repo
```

### 3. セッション作成

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
