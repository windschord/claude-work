# セットアップガイド

## 必要要件

- Node.js 20 以上
- Git
- Claude Code CLI（`npm install -g claude-code`）

## インストール

### npx で実行（推奨）

グローバルインストール不要で実行できます:

```bash
npx claude-work
```

### グローバルインストール

```bash
npm install -g claude-work
claude-work
```

## 初期設定

### 1. 認証トークン設定

環境変数で認証トークンを設定します:

```bash
export CLAUDE_WORK_TOKEN="your-secret-token"
export SESSION_SECRET="your-32-character-or-longer-secret-key"
```

または、`.env`ファイルを作成（最小構成）:

```env
CLAUDE_WORK_TOKEN=your-secret-token
SESSION_SECRET=your-32-character-or-longer-secret-key
PORT=3000
DATABASE_URL=file:./data/claudework.db
```

その他の環境変数については [ENV_VARS.md](ENV_VARS.md) を参照してください。

### 2. サーバー起動

```bash
npx claude-work
```

サーバーが起動したら、ブラウザで `http://localhost:3000` を開きます。

### 3. ログイン

設定した認証トークンでログインします。

### 4. プロジェクト追加

Git リポジトリのパスを指定してプロジェクトを追加します:

```text
/path/to/your/git/repo
```

### 5. セッション作成

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
