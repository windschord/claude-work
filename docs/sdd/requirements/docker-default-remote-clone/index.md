# 要件定義: Docker主体＋リモートリポジトリ対応への移行

## 概要

ClaudeWorkを、現在のHOST主体の実装からDocker主体のアーキテクチャに移行し、リモートリポジトリからのクローン機能を追加する。既存のHOSTモードは継続サポートし、後方互換性を維持しながら、新規ユーザーにはDocker環境での実行を推奨する。

**変更の目的**:
- セキュリティ強化（環境の分離）
- リモートリポジトリからの直接クローン機能の追加
- ドキュメントとコードの整合性向上
- Docker環境をデフォルトとすることで、環境構築の簡素化

**スコープ**:
- Docker環境のデフォルト化
- Docker内でのリモートリポジトリクローン機能
- UI/UXの改善（環境選択、プロジェクト作成）
- ドキュメント全体の更新

**スコープ外**:
- 既存HOSTセッションのDocker環境への自動移行
- PAT認証（SSH認証のみサポート）
- Shallow cloneやsubmodule自動初期化

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | リンク |
|----|----------|--------|-----------|--------|
| US-001 | デフォルト環境のDocker化 | 高 | TODO | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | リモートリポジトリのクローン機能 | 高 | TODO | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | Docker内でのGit操作 | 高 | TODO | [詳細](stories/US-003.md) @stories/US-003.md |
| US-004 | 環境管理UI強化 | 中 | TODO | [詳細](stories/US-004.md) @stories/US-004.md |
| US-005 | ドキュメント更新 | 中 | TODO | [詳細](stories/US-005.md) @stories/US-005.md |

## 非機能要件

| カテゴリ | 概要 | リンク |
|---------|------|--------|
| 互換性 | 既存HOSTセッションの継続利用、段階的移行 | [詳細](nfr/compatibility.md) @nfr/compatibility.md |
| セキュリティ | Docker環境分離、SSH認証、パストラバーサル対策 | [詳細](nfr/security.md) @nfr/security.md |
| 性能 | クローン処理の非同期化、リソース管理 | [詳細](nfr/performance.md) @nfr/performance.md |
| ユーザビリティ | 直感的なUI、適切なエラーメッセージ | [詳細](nfr/usability.md) @nfr/usability.md |

## 依存関係

### 既存機能
- ExecutionEnvironment（環境管理）
- DockerAdapter（Docker環境での実行）
- GitService（Git操作）
- EnvironmentService（環境CRUD）

### 外部依存
- Docker Engine（Docker環境実行に必要）
- Git CLI（クローン、ブランチ操作に必要）
- SSH設定（プライベートリポジトリアクセスに必要）

## 制約事項

1. **Docker依存**: Docker環境を使用するには、Docker Engineが必要
2. **SSH認証のみ**: PAT認証は今回のスコープ外
3. **後方互換性**: 既存HOSTセッションは継続利用可能（移行機能は提供しない）
4. **段階的移行**: 既存ユーザーへの影響を最小化するため、HOSTモードは削除しない

## 関連ドキュメント

- 設計書: @../design/docker-default-remote-clone/index.md
- タスク: @../tasks/docker-default-remote-clone/index.md
- 既存のリモートリポジトリ設計: `docs/remote-repo/design.md`
- 既存のDocker環境設計: `docs/sdd/design/core/architecture.md`

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2026-02-17 | 初版作成 | Claude Code |
