# ClaudeWork

AI-powered development workspace with Next.js integration.

## Getting Started

### Installation

ClaudeWorkはnpxを使って簡単に起動できます。

```bash
npx claude-work
```

### Environment Variables

起動前に以下の環境変数を設定する必要があります。

#### Required Environment Variables

- `AUTH_TOKEN`: 認証トークン（必須）
- `SESSION_SECRET`: セッション暗号化用のシークレットキー（必須、32文字以上）

#### Optional Environment Variables

- `PORT`: サーバーポート（省略可、デフォルト: 3000）
- `DATABASE_URL`: データベースURL（省略可、デフォルト: file:./data/claudework.db）
- `NODE_ENV`: 実行環境（development/production）
- `LOG_LEVEL`: ログレベル（debug/info/warn/error）
- `ALLOWED_ORIGINS`: CORS許可オリジン（カンマ区切り）
- `ALLOWED_PROJECT_DIRS`: 許可するプロジェクトディレクトリ（カンマ区切り）

### Setup

1. `.env.example`をコピーして`.env`ファイルを作成:

```bash
cp .env.example .env
```

2. `.env`ファイルを編集して必須の環境変数を設定:

```bash
# .env
AUTH_TOKEN=your-secure-token-here
SESSION_SECRET=your-32-character-or-longer-secret-key-here
PORT=3000
```

3. ClaudeWorkを起動:

```bash
npx claude-work
```

4. ブラウザで [http://localhost:3000](http://localhost:3000) を開く

### Local Development

開発用にリポジトリをクローンして作業する場合:

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

## Project Structure

```
claude-work/
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── services/     # Business logic and external services
│   ├── lib/          # Utility functions and helpers
│   └── bin/          # CLI entry point
├── docs/             # Documentation
├── prisma/           # Database schema and migrations
├── server.ts         # Custom Next.js server with WebSocket
└── package.json
```

## Technologies

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- React 19
- WebSocket (ws)
- Prisma ORM
- SQLite
- Zustand (State Management)

## Available Scripts

- `npm run dev` - 開発サーバーを起動
- `npm run build` - 本番用にビルド
- `npm run start` - 本番サーバーを起動
- `npm run lint` - ESLintを実行
- `npm run test` - テストを実行
- `npm run test:watch` - テストをwatch modeで実行

## Features

- プロジェクト管理: Gitリポジトリをプロジェクトとして登録
- セッション管理: AI対話セッションの作成と管理
- リアルタイム通信: WebSocketによるリアルタイム出力表示
- Git操作: diff、rebase、merge などのGit操作をUI上で実行
- 認証: トークンベースの認証システム

## Database

ClaudeWorkはSQLiteデータベースを使用します。デフォルトでは`./data/claudework.db`に保存されます。

初回起動時に自動的にデータベースが作成されます。

## Security Notes

- `AUTH_TOKEN`は安全な値に設定してください
- `SESSION_SECRET`は32文字以上のランダムな文字列を使用してください
- 本番環境では`ALLOWED_ORIGINS`を適切に設定してください
- 必要に応じて`ALLOWED_PROJECT_DIRS`でプロジェクトディレクトリを制限してください

## Requirements

- Node.js 20 以上
- Git

## License

Private
