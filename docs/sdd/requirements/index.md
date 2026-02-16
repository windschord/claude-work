# 要件定義 - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの要件定義を格納しています。

## プロジェクト一覧

### 進行中・計画中

| プロジェクト | 説明 | ステータス |
|-------------|------|-----------|
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 進行中 |
| [ハイブリッド設計](hybrid-clone/index.md) | ホスト環境/Docker環境でのプロジェクトclone | 計画中 |

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
| [npx GitHub統合](npx-github/requirements.md) | GitHub Actionsでのnpx実行対応 |
| [npx Prisma修正](npx-prisma-fix/requirements.md) | Prisma実行時のnpx問題修正 |
| [Prisma 7アップグレード](prisma-7-upgrade/requirements.md) | Prisma v7へのアップグレード |
| [レスポンシブUI](responsive/requirements.md) | レスポンシブデザイン対応 |
| [設定UI改善](settings-ui/index.md) | 設定ページのナビゲーション改善 |
| [サイドバーUI](sidebar-ui/requirements.md) | サイドバーUIの実装 |
| [systemdセットアップ](systemd-setup/requirements.md) | systemdによるサービス化 |
| [ターミナル機能](terminal/requirements.md) | ターミナル機能の実装 |

## ドキュメント構造

各プロジェクトの要件定義は、EARS記法に基づいて記述されています。

- **ユーザーストーリー**: ユーザー視点での機能要求
- **受入基準**: EARS記法による明確な要件定義
- **非機能要件**: 性能、保守性、開発体験などの要件
