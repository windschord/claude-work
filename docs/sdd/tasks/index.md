# タスク - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの実装タスクを格納しています。

## プロジェクト一覧

### 進行中・計画中

| プロジェクト | 説明 | 進捗 | ステータス |
|-------------|------|-----|-----------|
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 28/31 タスク完了 | 進行中 |
| [ハイブリッド設計](hybrid-clone/index.md) | ホスト環境/Docker環境でのプロジェクトclone | 0/19 タスク未着手 | 計画中 |
| [Dockerポート・ボリューム設定](docker-port-volume/tasks.md) | Docker環境のポートマッピング・ボリュームマウント設定機能 | 0/15 タスク未着手 | 計画中 |

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
| [npx GitHub統合](npx-github/tasks.md) | GitHub Actionsでのnpx実行対応 |
| [npx Prisma修正](npx-prisma-fix/tasks.md) | Prisma実行時のnpx問題修正 |
| [永続データ](persistent-data/tasks.md) | データ永続化設計 |
| [Prisma 7アップグレード](prisma-7-upgrade/tasks.md) | Prisma v7へのアップグレード |
| [設定UI改善](settings-ui/index.md) | 設定ページのナビゲーション改善 |
| [systemdセットアップ](systemd-setup/tasks.md) | systemdによるサービス化 |

## タスク管理

各プロジェクトのタスクは、以下の形式で管理されています：

- **フェーズ分割**: 論理的な実装フェーズごとにタスクをグループ化
- **依存関係**: タスク間の依存関係を明示
- **受入基準**: 各タスクの完了条件を明確に定義
- **ステータス**: TODO / IN_PROGRESS / BLOCKED / REVIEW / DONE
