# タスク - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの実装タスクを格納しています。

## アクティブプロジェクト

| プロジェクト | 説明 | 進捗 | ステータス |
|-------------|------|-----|-----------|
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 28/31 タスク完了 | 進行中 |
| [Claudeオプション](claude-options/tasks.md) | Claude Code実行時のオプション設定 | 未着手 | 計画中 |
| [Volume命名規則](volume-naming/index.md) | Docker named volumeの命名規則統一 | 未着手 | 計画中 |
| [デフォルト環境削除](remove-default-env/index.md) | デフォルト実行環境の自動作成廃止 | 未着手 | 計画中 |
| [Registry Firewall統合](registry-firewall/index.md) | パッケージレジストリプロキシによるサプライチェーン攻撃保護 | 7/7 タスク完了 | 完了 |
| [Chrome Sidecar MCP環境](chrome-sidecar/index.md) | セッション専用Chromeサイドカーコンテナによるブラウザ操作 | 0/9 タスク | 計画中 |

## 完了済みプロジェクト

完了済みプロジェクトのタスクは [archive/](../archive/) に移動しました。
一覧は [archive/index.md](../archive/index.md) を参照してください。

## タスク管理

各プロジェクトのタスクは、以下の形式で管理されています：

- **フェーズ分割**: 論理的な実装フェーズごとにタスクをグループ化
- **依存関係**: タスク間の依存関係を明示
- **受入基準**: 各タスクの完了条件を明確に定義
- **ステータス**: TODO / IN_PROGRESS / BLOCKED / REVIEW / DONE
