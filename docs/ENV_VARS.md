# 環境変数リファレンス

ClaudeWork で使用可能な環境変数の一覧です。

## 必須環境変数

### CLAUDE_WORK_TOKEN

- **説明**: 認証トークン
- **形式**: 任意の文字列（推奨: 32文字以上のランダム文字列）
- **例**: `CLAUDE_WORK_TOKEN="my-secret-token-12345678"`
- **デフォルト**: なし（必須）

### SESSION_SECRET

- **説明**: セッション暗号化用のシークレットキー
- **形式**: 任意の文字列（32文字以上推奨）
- **例**: `SESSION_SECRET="your-32-character-or-longer-secret-key-here"`
- **デフォルト**: なし（必須）

## オプション環境変数

### PORT

- **説明**: サーバーポート
- **形式**: 整数（1024-65535）
- **例**: `PORT=3000`
- **デフォルト**: `3000`

### DATABASE_URL

- **説明**: SQLite データベースパス
- **形式**: `file:./path/to/database.db`
- **例**: `DATABASE_URL="file:./data/claudework.db"`
- **デフォルト**: `file:./data/claudework.db`

### NODE_ENV

- **説明**: 実行環境
- **形式**: `development` | `production` | `test`
- **例**: `NODE_ENV=production`
- **デフォルト**: `development`

### LOG_LEVEL

- **説明**: ログレベル
- **形式**: `error` | `warn` | `info` | `debug`
- **例**: `LOG_LEVEL=info`
- **デフォルト**: `info`

### ALLOWED_ORIGINS

- **説明**: CORS許可オリジン
- **形式**: カンマ区切りの URL リスト
- **例**: `ALLOWED_ORIGINS="http://localhost:3000,https://example.com"`
- **デフォルト**: なし

### ALLOWED_PROJECT_DIRS

- **説明**: 許可するプロジェクトディレクトリ
- **形式**: カンマ区切りのディレクトリパスリスト
- **例**: `ALLOWED_PROJECT_DIRS="/home/user/projects,/opt/repos"`
- **デフォルト**: なし（すべてのディレクトリを許可）

### PROCESS_IDLE_TIMEOUT_MINUTES

- **説明**: アイドル状態のClaude Codeプロセスを自動的に一時停止するまでの時間（分）
- **形式**: 整数（0 = 無効、5以上の値を推奨）
- **例**: `PROCESS_IDLE_TIMEOUT_MINUTES=30`
- **デフォルト**: `30`
- **備考**: 5分未満の値は自動的に5分に補正されます。0を設定するとアイドルタイムアウトは無効になります。

## 設定例

### .env ファイル

```env
CLAUDE_WORK_TOKEN=your-secret-token-here
SESSION_SECRET=your-32-character-or-longer-secret-key-here
PORT=3000
DATABASE_URL=file:./data/claudework.db
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_PROJECT_DIRS=/home/user/projects
PROCESS_IDLE_TIMEOUT_MINUTES=30
```

### コマンドライン

```bash
CLAUDE_WORK_TOKEN="your-token" SESSION_SECRET="your-secret" PORT=3001 npx claude-work
```
