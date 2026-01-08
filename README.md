# ClaudeWork

> **注意**: このプロジェクトは開発中（Work In Progress）です。予告なく仕様が変更される可能性があります。

ClaudeWork は、Claude Code セッションをブラウザから管理するための Web ベースツールです。Docker コンテナを使用して各セッションを隔離された環境で実行し、安全で再現可能な開発環境を提供します。

## 動作保証環境

- **OS**: macOS, Linux
  - Windows は現在サポートされていません
- **Node.js**: 20.x 以上
- **Docker**: 20.10 以上（Docker Desktop または Docker Engine）
- **Claude Code CLI**: ホストマシンにインストール済みであること（認証情報をコンテナにマウント）

## 主な機能

- **Dockerコンテナセッション**: セッションごとに隔離されたDockerコンテナで実行
- **環境の再現性**: 同一のコンテナイメージで一貫した環境を提供
- **安全な権限委譲**: コンテナ内での操作によりホスト環境を保護
- **リアルタイム通信**: WebSocket によるターミナルI/O
- **ターミナル統合**: ブラウザ内でClaude Codeを直接操作（XTerm.js）
- **永続ボリューム**: セッションデータをDockerボリュームに永続化
- **ライト/ダークモード**: テーマ切り替え対応
- **モバイル対応**: レスポンシブデザイン

## セットアップ

詳細は [SETUP.md](docs/SETUP.md) を参照してください。

### 事前準備（Docker イメージのビルド）

セッション用のDockerイメージを事前にビルドしてください:

```bash
docker build -t claudework-session:latest -f docker/Dockerfile docker/
```

### クイックスタート

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
| 5. 起動 | サーバー起動 (`http://localhost:3000`) |

**注意**: Dockerデーモンが起動していることを確認してください。

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
| `DOCKER_SOCKET` | Dockerソケットパス | /var/run/docker.sock |
| `SESSION_IMAGE` | セッション用Dockerイメージ | claudework-session:latest |

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
- **コンテナ**: Docker, dockerode, node-pty
- **その他**: XTerm.js, Headless UI, next-themes

## 貢献

Issue や Pull Request は歓迎します。

## サポート

問題が発生した場合は、GitHub Issues でお知らせください。
