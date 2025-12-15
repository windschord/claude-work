# ClaudeWork

ClaudeWork は、Claude Code セッションをブラウザから管理するための Web ベースツールです。複数のセッションを並列で実行し、Git worktree を使用して各セッションを独立した環境で管理します。

## 主な機能

- **セッション管理**: 複数の Claude Code セッションを並列実行
- **Git worktree 統合**: セッションごとに独立した Git 環境
- **リアルタイム通信**: WebSocket によるリアルタイム出力表示
- **Diff 表示**: Git diff をビジュアルに表示
- **Git 操作**: rebase、squash merge などの Git 操作をブラウザから実行
- **実行スクリプト**: テスト実行、ビルドなどの定型作業を簡単に実行
- **ターミナル統合**: ブラウザ内でターミナル操作
- **ライト/ダークモード**: テーマ切り替え対応
- **モバイル対応**: レスポンシブデザイン

## セットアップ

詳細は [SETUP.md](docs/SETUP.md) を参照してください。

### クイックスタート

```bash
npx claude-work
```

初回起動時に認証トークンを設定します:

```bash
export CLAUDE_WORK_TOKEN="your-secret-token"
export SESSION_SECRET="your-32-character-or-longer-secret"
npx claude-work
```

ブラウザで `http://localhost:3000` を開き、設定したトークンでログインします。

## 環境変数

詳細は [ENV_VARS.md](docs/ENV_VARS.md) を参照してください。

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `CLAUDE_WORK_TOKEN` | 認証トークン | なし（必須） |
| `SESSION_SECRET` | セッション暗号化用シークレット | なし（必須） |
| `PORT` | サーバーポート | 3000 |
| `DATABASE_URL` | SQLite データベースパス | file:./data/claudework.db |
| `NODE_ENV` | 実行環境 | development |
| `LOG_LEVEL` | ログレベル | info |
| `ALLOWED_ORIGINS` | CORS許可オリジン | なし |
| `ALLOWED_PROJECT_DIRS` | 許可するプロジェクトディレクトリ | なし（すべてのディレクトリを許可） |

## API 仕様

詳細は [API.md](docs/API.md) を参照してください。

## ライセンス

Apache License 2.0 - 詳細は [LICENSE](LICENSE) を参照してください。

## 技術スタック

- **フロントエンド**: Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand
- **バックエンド**: Next.js API Routes, Prisma, SQLite, WebSocket (ws)
- **その他**: XTerm.js, react-diff-viewer-continued, Headless UI, next-themes

## 貢献

Issue や Pull Request は歓迎します。

## サポート

問題が発生した場合は、GitHub Issues でお知らせください。
