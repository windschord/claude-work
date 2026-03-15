# 要件定義: Docker環境での --dangerously-skip-permissions オプション対応

## 概要

Docker実行環境でClaude Codeを起動する際に、`--dangerously-skip-permissions` フラグを付与できるようにする。Docker環境はサンドボックスとして動作するため、パーミッション確認のスキップが安全に行える。

**変更の目的**:
- Docker環境での操作効率向上（パーミッション確認ダイアログの省略）
- Docker環境のサンドボックス特性を活かしたセキュリティモデルの提供
- 環境レベルのデフォルト設定とセッション単位の上書きによる柔軟な運用

**スコープ**:
- ExecutionEnvironment（Docker環境のみ）に `skipPermissions` 設定を追加
- セッション作成時にセッション単位で上書き可能
- 環境設定UIにトグル追加
- セッション作成フォームに設定追加
- Claude Code起動時に `--dangerously-skip-permissions` フラグを付与

**スコープ外**:
- HOST環境でのskipPermissions対応（セキュリティリスクが高いため）
- SSH環境でのskipPermissions対応（未実装環境のため）
- `--permission-mode` との連携（別機能として独立）

## 機能要件

### REQ-001: 環境レベルの設定

Docker環境の作成・編集画面において、管理者が `skipPermissions` を有効/無効に設定できなければならない。

**受入基準**:
- Docker環境の新規作成モーダルにトグルスイッチが表示される
- Docker環境の編集画面にトグルスイッチが表示される
- HOST環境の作成・編集画面にはトグルが表示されない
- デフォルト値は無効（false）
- 設定変更後、その環境を使用する新規セッション全てに適用される

### REQ-002: セッション単位の上書き

セッション作成時に、環境デフォルトの `skipPermissions` 設定をセッション単位で上書きできなければならない。

**受入基準**:
- セッション作成フォームに「環境デフォルトを使用」「有効」「無効」の3択が表示される
- Docker環境を選択した場合のみ設定項目が表示される
- HOST環境選択時は設定項目が非表示になる
- 「環境デフォルトを使用」がデフォルト選択状態である
- 環境デフォルトが有効な場合、その旨が表示される

### REQ-003: CLIフラグの付与

Docker環境でセッションを起動する際、skipPermissionsが有効であれば、Claude Codeに `--dangerously-skip-permissions` フラグが付与されなければならない。

**受入基準**:
- 環境デフォルト有効 + セッション上書きなし → フラグ付与
- 環境デフォルト有効 + セッション上書き無効 → フラグ付与しない
- 環境デフォルト無効 + セッション上書き有効 → フラグ付与
- 環境デフォルト無効 + セッション上書きなし → フラグ付与しない
- HOST環境では一切フラグが付与されない

### REQ-004: データ永続化

skipPermissions設定がデータベースに永続化されなければならない。

**受入基準**:
- 環境レベル: `ExecutionEnvironment.config` JSONフィールドに `skipPermissions` を保存
- セッションレベル: `Session.claude_code_options` JSONフィールドに `dangerouslySkipPermissions` を保存
- サーバー再起動後も設定が維持される

### REQ-005: セキュリティ制約

もしHOST環境のリクエストに `skipPermissions` が含まれていた場合、システムはその設定を無視しなければならない。

**受入基準**:
- API経由でHOST環境にskipPermissionsを設定しようとしてもバリデーションエラーまたは無視される
- Docker環境であっても、`--dangerously-skip-permissions` 以外のセキュリティ設定（`--cap-drop ALL`等）は維持される

## 非機能要件

### NFR-001: 後方互換性

既存のDocker環境・セッションに影響を与えてはならない。`skipPermissions` フィールドが存在しない環境は無効（false）として扱う。

### NFR-002: UI/UX

設定項目には「Docker環境はサンドボックスとして動作するため、パーミッション確認をスキップしても安全です」等の説明文を表示する。

## 依存関係

### 既存機能
- ExecutionEnvironment（環境管理）
- DockerAdapter（Docker環境でのClaude Code起動）
- ClaudeOptionsService（CLIオプション構築）
- 環境設定UI（EnvironmentForm）
- セッション作成UI（CreateSessionForm / CreateSessionModal）

### 外部依存
- Claude Code CLI（`--dangerously-skip-permissions` フラグのサポート）

## 制約事項

1. HOST環境では一切skipPermissionsを有効にできない
2. 既存の `permissionMode` フィールドとは独立した設定である
3. `--dangerously-skip-permissions` はスタンドアロンフラグ（値なし）

## 関連ドキュメント

- 設計書: [設計](../design/skip-permissions/index.md)
- タスク: [タスク](../tasks/skip-permissions/index.md)

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2026-02-20 | 初版作成 | Claude Code |
