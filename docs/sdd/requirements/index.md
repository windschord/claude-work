# 要件定義 - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの要件定義を格納しています。

## アクティブプロジェクト

| プロジェクト | 説明 | ステータス |
|-------------|------|-----------|
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 進行中 (28/31) |
| [Claudeオプション](claude-options/requirements.md) | Claude Code実行時のオプション設定（allowedTools, maxTurns等） | 未着手 |
| [Volume命名規則](volume-naming/index.md) | Docker named volumeの命名規則統一 | 未着手 |
| [デフォルト環境削除](remove-default-env/index.md) | デフォルト実行環境の自動作成廃止 | 未着手 |
| [サイドカーChrome DevTools MCP](chrome-sidecar/index.md) | セッション単位の独立Chromeサイドカーコンテナによるブラウザ検証 | 計画中 (requirementsのみ) |

## 完了済みプロジェクト

完了済みプロジェクトの要件定義は [archive/](../archive/) に移動しました。
一覧は [archive/index.md](../archive/index.md) を参照してください。

## ドキュメント構造

各プロジェクトの要件定義は、EARS記法に基づいて記述されています。

- **ユーザーストーリー**: ユーザー視点での機能要求
- **受入基準**: EARS記法による明確な要件定義
- **非機能要件**: 性能、保守性、開発体験などの要件
