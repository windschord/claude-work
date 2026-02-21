# 設計 - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの技術設計を格納しています。

## プロジェクト一覧

### 進行中・計画中

| プロジェクト | 説明 | ステータス |
|-------------|------|-----------|
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 進行中 |
| [ハイブリッド設計](hybrid-clone/index.md) | ホスト環境/Docker環境でのプロジェクトclone | 計画中 |
| [Dockerポート・ボリューム設定](docker-port-volume/design.md) | Docker環境のポートマッピング・ボリュームマウント設定機能 | 計画中 |

### 完了済み機能

| プロジェクト | 説明 |
|-------------|------|
| [Claude対話機能](claude-interaction/design.md) | Claudeとの対話機能の実装 |
| [Claudeオプション](claude-options/design.md) | Claude Code実行時のオプション設定 |
| [コア機能](core/design.md) | ClaudeWorkのコア機能 |
| [DB移行](db-migration/design.md) | データベース移行機能 |
| [Docker入力修正](docker-input-fix/design.md) | Docker環境での入力処理の修正 |
| [Dockerリサイズ回帰](docker-resize-regression/design.md) | Docker環境でのターミナルリサイズの問題修正 |
| [Dockerターミナル](docker-terminal/design.md) | Docker環境でのターミナル機能 |
| [Docker Worktree修正](docker-worktree-fix/index.md) | Docker環境でのWorktreeパス問題の修正 |
| [Git操作](git-operations/design.md) | Gitワークツリー操作機能 |
| [Issue #101 PTYリファクタリング](issue-101-pty-refactor/index.md) | PTYマネージャーのアーキテクチャ改善 |
| [通知機能](notifications/design.md) | システム通知機能 |
| [npx GitHub統合](npx-github/design.md) | GitHub Actionsでのnpx実行対応 |
| [npx Prisma修正](npx-prisma-fix/design.md) | Prisma実行時のnpx問題修正 |
| [永続データ](persistent-data/design.md) | データ永続化設計 |
| [Prisma 7アップグレード](prisma-7-upgrade/design.md) | Prisma v7へのアップグレード |
| [レスポンシブUI](responsive/design.md) | レスポンシブデザイン対応 |
| [設定UI改善](settings-ui/index.md) | 設定ページのナビゲーション改善 |
| [サイドバーUI](sidebar-ui/design.md) | サイドバーUIの実装 |
| [systemdセットアップ](systemd-setup/design.md) | systemdによるサービス化 |
| [ターミナル機能](terminal/design.md) | ターミナル機能の実装 |

## ドキュメント構造

各プロジェクトの設計書は、AIエージェントが実装を行うことを前提として記述されています。

- **アーキテクチャ概要**: システム全体の構成
- **コンポーネント設計**: 各コンポーネントの責務と実装詳細
- **データフロー**: データの流れとシーケンス
- **技術的決定事項**: アーキテクチャ上の重要な決定
