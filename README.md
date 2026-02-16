# ClaudeWork

> **注意**: このプロジェクトは開発中（Work In Progress）です。予告なく仕様が変更される可能性があります。

ClaudeWork は、Claude Code セッションをブラウザから管理するための Web ベースツールです。複数のセッションを並列で実行し、Git worktree を使用して各セッションを独立した環境で管理します。

## 動作保証環境

- **OS**: macOS, Linux
  - Windows は現在サポートされていません
- **Node.js**: 18.x 以上
- **Claude Code CLI**: インストール済みであること

## 主な機能

- **セッション管理**: 複数の Claude Code セッションを並列実行
- **Git worktree 統合**: セッションごとに独立した Git 環境
- **リアルタイム通信**: WebSocket によるリアルタイム出力表示
- **Diff 表示**: Git diff をビジュアルに表示
- **Git 操作**: rebase、squash merge などの Git 操作をブラウザから実行
- **GitHub PAT認証**: Docker環境でのHTTPSプライベートリポジトリクローンをサポート（[詳細](docs/GITHUB_PAT.md)）
- **実行スクリプト**: テスト実行、ビルドなどの定型作業を簡単に実行
- **ターミナル統合**: ブラウザ内でターミナル操作
- **ライト/ダークモード**: テーマ切り替え対応
- **モバイル対応**: レスポンシブデザイン

## セットアップ

詳細は [SETUP.md](docs/SETUP.md) を参照してください。

### クイックスタート

```bash
npx claude-work start   # バックグラウンドで起動
npx claude-work stop    # 停止
```

または、フォアグラウンドで起動:

```bash
npx claude-work         # Ctrl+C で停止
```

#### GitHub リポジトリから直接実行

npm registry に公開前のバージョンや、特定のブランチを試す場合:

```bash
# main ブランチから実行
npx github:windschord/claude-work start

# 特定のブランチから実行
npx github:windschord/claude-work#feature-branch start
```

初回実行時は以下が自動的にセットアップされます:

| ステップ | 処理内容 |
|---------|---------|
| 1. 環境設定 | `.env` がなければ `.env.example` からコピー |
| 2. Prisma | クライアントがなければ自動生成 |
| 3. データベース | DBがなければ自動作成 |
| 4. ビルド | `.next` がなければ自動ビルド |
| 5. 起動 | サーバー起動 (`http://localhost:3000`) |

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

### 環境変数のカスタマイズ

デフォルト設定で動作しますが、必要に応じて `.env` ファイルを編集できます:

```bash
# データベースURL（変更不要）
DATABASE_URL=file:../data/claudework.db

# サーバーポート（オプション）
PORT=3000
```

ブラウザで `http://localhost:3000` を開きます。

## 環境変数

詳細は [ENV_VARS.md](docs/ENV_VARS.md) を参照してください。

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DATABASE_URL` | SQLite データベースパス | なし（必須） |
| `PORT` | サーバーポート | 3000 |
| `NODE_ENV` | 実行環境 | development |
| `LOG_LEVEL` | ログレベル | info |
| `ALLOWED_ORIGINS` | CORS許可オリジン | なし |
| `ALLOWED_PROJECT_DIRS` | 許可するプロジェクトディレクトリ | なし（すべてのディレクトリを許可） |

## API 仕様

詳細は [API.md](docs/API.md) を参照してください。

## 開発

### 開発サーバーの起動

開発時には、pm2を使った起動を推奨します。pm2を使うことで、バックグラウンドプロセスの管理が容易になります。

```bash
# pm2で開発サーバーを起動（推奨）
npm run dev:pm2

# プロセスの状態を確認
npm run pm2:status

# ログを確認
npm run pm2:logs

# サーバーを停止
npm run pm2:stop

# pm2からプロセスを削除
npm run pm2:delete
```

従来の方法でも起動できます:

```bash
# 直接起動（Ctrl+Cで停止）
npm run dev
```

### pm2の利点

- プロセスの安全な停止（killコマンド不要）
- プロセス状態の確認が容易
- ログ管理の統一
- 自動再起動機能
- リソース使用状況のモニタリング

### pm2コマンド一覧

```bash
# 開発サーバーのみ起動
npm run dev:pm2

# テスト実行（pm2経由）
npm run test:pm2

# テスト監視モード（pm2経由）
npm run test:watch:pm2

# すべてのプロセスを起動
npm run pm2:start

# すべてのプロセスを再起動
npm run pm2:restart

# プロセス状態を確認
npm run pm2:status

# ログをリアルタイム表示
npm run pm2:logs

# リソース使用状況をモニタリング
npm run pm2:monit

# すべてのプロセスを停止
npm run pm2:stop

# すべてのプロセスを削除
npm run pm2:delete
```

## テスト

### ユニットテスト

```bash
# すべてのテストを実行
npm test

# テストをウォッチモードで実行
npm run test:watch

# pm2でテスト監視モードを実行（バックグラウンド）
npm run test:watch:pm2
```

### E2Eテスト

```bash
# E2Eテストを実行
npm run e2e

# UIモードでE2Eテストを実行
npm run e2e:ui

# ブラウザを表示してE2Eテストを実行
npm run e2e:headed
```

### 統合テスト

統合テストスクリプトは、実際のClaude Codeプロセスを起動して手動テストを支援します。

```bash
# 統合テストスクリプトを実行
npm run integration-test
```

このスクリプトは以下を行います:
- 開発サーバーを起動（環境変数を自動設定）
- テストチェックリストを表示
- インタラクティブメニューを提供

テスト結果は `docs/integration-test-report.md` に記録してください。

#### 環境変数

統合テストには以下の環境変数を使用できます:

```bash
# カスタム環境変数で実行
PORT=3001 npm run integration-test
```

環境変数を指定しない場合、以下のデフォルト値が使用されます:
- `PORT`: 3000

## ライセンス

Apache License 2.0 - 詳細は [LICENSE](LICENSE) を参照してください。

## 技術スタック

- **フロントエンド**: Next.js 15.1, React 19, TypeScript, Tailwind CSS, Zustand
- **バックエンド**: Next.js API Routes, Prisma, SQLite, WebSocket (ws)
- **その他**: XTerm.js, react-diff-viewer-continued, Headless UI, next-themes

## ドキュメント

### ユーザーガイド
- **[セットアップガイド](docs/SETUP.md)** - 詳細なインストール手順
- **[環境変数リファレンス](docs/ENV_VARS.md)** - 設定可能な環境変数一覧
- **[API仕様](docs/API.md)** - REST API / WebSocket API仕様
- **[GitHub PAT設定ガイド](docs/GITHUB_PAT.md)** - Docker環境でのHTTPS認証設定
- **[Systemdセットアップ](docs/SYSTEMD_SETUP.md)** - systemdによるサービス化

### 開発者向けドキュメント
- **[Software Design Documents](docs/sdd/)** - ソフトウェア設計ドキュメント
  - [設計書](docs/sdd/design/) - 技術設計ドキュメント
  - [要件定義](docs/sdd/requirements/) - 要件仕様書
  - [タスク管理](docs/sdd/tasks/) - 実装タスク追跡
  - [トラブルシューティング](docs/sdd/troubleshooting/) - 問題分析
  - [アーカイブ](docs/sdd/archive/) - 過去のドキュメント

## 貢献

Issue や Pull Request は歓迎します。

## サポート

問題が発生した場合は、GitHub Issues でお知らせください。
