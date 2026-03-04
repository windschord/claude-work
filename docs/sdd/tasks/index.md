# タスク - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの実装タスクを格納しています。

## プロジェクト一覧

### 進行中・計画中

| プロジェクト | 説明 | 進捗 | ステータス |
|-------------|------|-----|-----------|
| [Claude Code `--worktree`オプション対応](add-worktree-option.md) | Claude Code CLIの`--worktree`フラグ統合 | 6/6 タスク完了 | 完了 |
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 28/31 タスク完了 | 進行中 |
| [ハイブリッド設計](hybrid-clone/index.md) | ホスト環境/Docker環境でのプロジェクトclone | 0/19 タスク未着手 | 計画中 |
| [Docker環境でのHOST機能無効化](disable-host-in-docker/tasks.md) | Docker内動作時のHOST環境自動無効化 | 11/11 タスク完了 | 完了 |
| [Dockerポート・ボリューム設定](docker-port-volume/tasks.md) | Docker環境のポートマッピング・ボリュームマウント設定機能 | 15/15 タスク完了 | 完了 |
| [Docker環境ネットワークフィルタリング](network-filtering/index.md) | Dockerコンテナの外部通信をホワイトリスト方式でフィルタリング | 12/12 完了 | 完了 |

### 完了済み機能

| プロジェクト | 説明 |
|-------------|------|
| [Claudeオプション](claude-options/tasks.md) | Claude Code実行時のオプション設定 |
| [DB移行](db-migration/tasks.md) | データベース移行機能 |
| [Docker入力修正](docker-input-fix/tasks.md) | Docker環境での入力処理の修正 |
| [Dockerリサイズ回帰](docker-resize-regression/tasks.md) | Docker環境でのターミナルリサイズの問題修正 |
| [Dockerターミナル](docker-terminal/tasks.md) | Docker環境でのターミナル機能 |
| [Docker Worktree修正](docker-worktree-fix/index.md) | Docker環境でのWorktreeパス問題の修正 |
| [Issue #101 PTYリファクタリング](issue-101-pty-refactor/index.md) | PTYマネージャーのアーキテクチャ改善 |
| [npx GitHub統合](../archive/tasks-npx-github/tasks.md) | GitHub Actionsでのnpx実行対応（廃止: Docker Compose移行済み） |
| [npx Prisma修正](../archive/tasks-npx-prisma-fix/tasks.md) | Prisma実行時のnpx問題修正（廃止: Docker Compose移行済み） |
| [永続データ](persistent-data/tasks.md) | データ永続化設計 |
| [Prisma 7アップグレード](prisma-7-upgrade/tasks.md) | Prisma v7へのアップグレード |
| [設定UI改善](settings-ui/index.md) | 設定ページのナビゲーション改善 |
| [systemdセットアップ](../archive/tasks-systemd-setup/tasks.md) | systemdによるサービス化（廃止: Docker Compose移行済み） |

## タスク管理

各プロジェクトのタスクは、以下の形式で管理されています：

- **フェーズ分割**: 論理的な実装フェーズごとにタスクをグループ化
- **依存関係**: タスク間の依存関係を明示
- **受入基準**: 各タスクの完了条件を明確に定義
- **ステータス**: TODO / IN_PROGRESS / BLOCKED / REVIEW / DONE
