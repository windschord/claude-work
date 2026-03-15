# 要件定義: パーミッションスキップ有効時のオプション矛盾解消

## 概要

`--dangerously-skip-permissions` が有効な場合、`--permission-mode` と `--allowedTools` は意味をなさない。これらの矛盾した設定を防止し、ユーザーに明確なフィードバックを提供する。

**変更の目的**:
- 矛盾した設定の組み合わせを防止し、ユーザーの混乱を排除
- バックエンド側でも安全弁として矛盾するオプションを除去

**スコープ**:
- セッション作成モーダルでskipPermissions有効時にpermissionMode/allowedToolsをdisabled化
- additionalFlagsフィールドに警告メッセージ表示
- バックエンドでskipPermissions有効時にpermissionMode/allowedToolsを除去

**スコープ外**:
- 環境設定画面（EnvironmentForm）の変更（環境レベルではClaude Codeオプションを設定しないため）
- modelフィールドの制限（パーミッションと無関係）
- additionalFlagsフィールドの無効化（他の有効なフラグも入力できなくなるため）

## 機能要件

### REQ-001: セッション作成UIでの権限関連フィールドのdisabled化

セッション作成モーダルにおいて、skipPermissionsが実効的に有効な場合、`permissionMode`（権限モード）と`allowedTools`（許可ツール）フィールドがdisabledになり、理由が表示されなければならない。

**受入基準**:
- skipPermissionsオーバーライドが「有効」の場合 → 2フィールドがdisabled
- skipPermissionsオーバーライドが「環境デフォルト」かつ環境デフォルトが有効の場合 → 2フィールドがdisabled
- skipPermissionsオーバーライドが「無効」の場合 → 2フィールドはenabled
- skipPermissionsオーバーライドが「環境デフォルト」かつ環境デフォルトが無効の場合 → 2フィールドはenabled
- HOST環境選択時（skipPermissions設定自体が非表示）→ 2フィールドはenabled
- disabled時に「パーミッション確認スキップが有効なため、この設定は無視されます」等の説明が表示される
- disabled中もフィールドの値は内部的に保持され、skipPermissions無効化時に復元される

### REQ-002: additionalFlagsフィールドの警告表示

セッション作成モーダルにおいて、skipPermissionsが実効的に有効な場合、`additionalFlags`（その他フラグ）フィールドに警告メッセージが表示されなければならない。

**受入基準**:
- skipPermissions有効時に「権限関連フラグ（--permission-mode, --allowedTools）は無視されます」等の警告が表示される
- additionalFlagsフィールド自体は編集可能（disabledにしない）
- skipPermissions無効時は警告が非表示になる

### REQ-003: バックエンドでの矛盾オプション除去

skipPermissionsが有効な場合、バックエンドはCLI引数構築時に`permissionMode`と`allowedTools`を除去しなければならない。

**受入基準**:
- skipPermissions=trueの場合、`--permission-mode` と `--allowedTools` がCLI引数に含まれない
- `--model` や `--additionalFlags`（権限関連以外）は除去されない
- additionalFlags内に `--permission-mode` や `--allowedTools` が含まれていた場合は除去しない（ユーザー責任）
- ログに除去した旨を記録する

## 非機能要件

### NFR-001: 後方互換性

既存のセッションデータに影響を与えてはならない。保存済みのpermissionMode/allowedToolsの値はDB上でそのまま保持される。

### NFR-002: UI/UX

disabledフィールドはグレーアウト表示とし、ユーザーが視覚的に操作不可であることを認識できるようにする。

## 依存関係

### 既存機能
- skip-permissions機能（PR #125で実装済み）
- ClaudeOptionsForm コンポーネント
- ClaudeOptionsService
- PTYSessionManager

## 制約事項

1. `additionalFlags`の内容はフリーテキストであり、権限関連フラグの自動検出・除去は行わない
2. disabledフィールドの値はDB上で保持される（バックエンドで除去するのみ）

## 関連ドキュメント

- 設計書: [設計](../../design/skip-permissions-conflict/index.md)
- タスク: [タスク](../../tasks/skip-permissions-conflict/index.md)
- 前提機能: [skip-permissions要件](../skip-permissions/index.md)

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2026-02-21 | 初版作成 | Claude Code |
