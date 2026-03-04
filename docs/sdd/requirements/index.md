# 要件定義 - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの要件定義を格納しています。

## プロジェクト一覧

### 進行中・計画中

| プロジェクト | 説明 | ステータス |
|-------------|------|-----------|
| [Claude Code `--worktree`オプション対応](add-worktree-option.md) | Claude Code CLIの`--worktree`フラグ統合 | 計画中 |
| [アプリDockerイメージ公開・GitHub Release](app-docker-release/index.md) | アプリ本体のDockerイメージGHCR公開とGitHub Release自動化 | 進行中 |
| [Docker主体＋リモートリポジトリ対応](docker-default-remote-clone/index.md) | Docker環境のデフォルト化とリモートリポジトリクローン機能 | 計画中 |
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 進行中 |
| [ハイブリッド設計](hybrid-clone/index.md) | ホスト環境/Docker環境でのプロジェクトclone | 計画中 |
| [Docker環境でのHOST機能無効化](disable-host-in-docker/index.md) | Docker内動作時のHOST環境自動無効化と環境変数による有効化 | 進行中 |
| [Dockerポート・ボリューム設定](docker-port-volume/index.md) | Docker環境のポートマッピング・ボリュームマウント設定機能 | 完了 |
| [Docker環境ネットワークフィルタリング](network-filtering/index.md) | Dockerコンテナの外部通信をホワイトリスト方式でフィルタリング | 進行中 |
| [サイドカーChrome DevTools MCP](chrome-sidecar/index.md) | セッション単位の独立Chromeサイドカーコンテナによるブラウザ検証 | 計画中 |

### 完了済み機能

| プロジェクト | 説明 |
|-------------|------|
| [Claude対話機能](claude-interaction/requirements.md) | Claudeとの対話機能の実装 |
| [Claudeオプション](claude-options/requirements.md) | Claude Code実行時のオプション設定 |
| [コア機能](core/requirements.md) | ClaudeWorkのコア機能 |
| [DB移行](db-migration/requirements.md) | データベース移行機能 |
| [Docker入力修正](docker-input-fix/requirements.md) | Docker環境での入力処理の修正 |
| [Dockerリサイズ回帰](docker-resize-regression/requirements.md) | Docker環境でのターミナルリサイズの問題修正 |
| [Dockerターミナル](docker-terminal/requirements.md) | Docker環境でのターミナル機能 |
| [Docker Worktree修正](docker-worktree-fix/index.md) | Docker環境でのWorktreeパス問題の修正 |
| [Git操作](git-operations/requirements.md) | Gitワークツリー操作機能 |
| [Issue #101 PTYリファクタリング](issue-101-pty-refactor/index.md) | PTYマネージャーのアーキテクチャ改善 |
| [通知機能](notifications/requirements.md) | システム通知機能 |
| [npx GitHub統合](../archive/requirements-npx-github/requirements.md) | GitHub Actionsでのnpx実行対応（廃止: Docker Compose移行済み） |
| [npx Prisma修正](../archive/requirements-npx-prisma-fix/requirements.md) | Prisma実行時のnpx問題修正（廃止: Docker Compose移行済み） |
| [Prisma 7アップグレード](prisma-7-upgrade/requirements.md) | Prisma v7へのアップグレード |
| [レスポンシブUI](responsive/requirements.md) | レスポンシブデザイン対応 |
| [設定UI改善](settings-ui/index.md) | 設定ページのナビゲーション改善 |
| [サイドバーUI](sidebar-ui/requirements.md) | サイドバーUIの実装 |
| [systemdセットアップ](../archive/requirements-systemd-setup/requirements.md) | systemdによるサービス化（廃止: Docker Compose移行済み） |
| [ターミナル機能](terminal/requirements.md) | ターミナル機能の実装 |

## ドキュメント構造

各プロジェクトの要件定義は、EARS記法に基づいて記述されています。

- **ユーザーストーリー**: ユーザー視点での機能要求
- **受入基準**: EARS記法による明確な要件定義
- **非機能要件**: 性能、保守性、開発体験などの要件
