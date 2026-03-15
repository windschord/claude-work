# 設計 - ClaudeWork

このディレクトリには、ClaudeWorkプロジェクトの技術設計を格納しています。

## アクティブプロジェクト

| プロジェクト | 説明 | ステータス |
|-------------|------|-----------|
| [Drizzle ORM移行](drizzle-migration/index.md) | Prisma → Drizzle ORM への完全移行 | 進行中 (28/31) |
| [Claudeオプション](claude-options/design.md) | Claude Code実行時のオプション設定（allowedTools, maxTurns等） | 未着手 |
| [Volume命名規則](volume-naming/index.md) | Docker named volumeの命名規則統一 | 未着手 |
| [デフォルト環境削除](remove-default-env/index.md) | デフォルト実行環境の自動作成廃止 | 未着手 |
| [Sandbox拡張イメージ](sandbox-extensions/index.md) | 言語別/ツール別Docker拡張イメージ | 進行中 (designのみ) |
| [Registry Firewall統合](registry-firewall/index.md) | パッケージレジストリプロキシによるサプライチェーン攻撃保護 | 計画中 |

## 完了済みプロジェクト

完了済みプロジェクトの設計書は [archive/](../archive/) に移動しました。
一覧は [archive/index.md](../archive/index.md) を参照してください。

## ドキュメント構造

各プロジェクトの設計書は、AIエージェントが実装を行うことを前提として記述されています。

- **アーキテクチャ概要**: システム全体の構成
- **コンポーネント設計**: 各コンポーネントの責務と実装詳細
- **データフロー**: データの流れとシーケンス
- **技術的決定事項**: アーキテクチャ上の重要な決定
