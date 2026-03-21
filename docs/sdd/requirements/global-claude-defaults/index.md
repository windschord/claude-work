# 要件定義: アプリケーション共通Claude Code設定・環境オーバーライド・Worktree移行

## 概要

ClaudeWorkにおけるClaude Code起動オプション（`dangerouslySkipPermissions`、`worktree`）をアプリケーション共通のデフォルト設定として管理し、実行環境ごとに継承/オーバーライドを可能にする。さらに、アプリ側のGit worktree管理を完全に削除し、Claude Code本体の`--worktree`フラグに移行することでアーキテクチャを簡素化する。

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス |
|----|---------|--------|-----------|
| US-001 | アプリ共通Claude Codeデフォルト設定 | 高 | 定義済 |
| US-002 | 環境ごとの継承/オーバーライド | 高 | 定義済 |
| US-003 | Worktree管理のClaude Code移行 | 高 | 定義済 |

### US-001: アプリ共通Claude Codeデフォルト設定

**ストーリー**: 管理者として、`dangerouslySkipPermissions`と`worktree`の共通デフォルト値をアプリケーション設定で一箇所に管理し、全プロジェクト/環境に適用したい。

**受入条件**:
- 設定ページ（`/settings/app`）でClaude Codeデフォルトセクションが表示される
- `dangerouslySkipPermissions`（boolean、デフォルト: false）を設定できる
- `worktree`（boolean、デフォルト: true）を設定できる
- 設定は`/api/settings/config`のGET/PUTで取得・更新される
- 設定はConfigServiceのJSON設定ファイル（`data/settings.json`）に永続化される

### US-002: 環境ごとの継承/オーバーライド

**ストーリー**: 管理者として、特定の実行環境でのみ共通設定を上書きしたい（例: HOST環境ではdangerouslySkipPermissionsをfalseにしたいが、Docker環境ではtrueにしたい）。

**受入条件**:
- 環境設定UIで各設定項目ごとに「継承」または独自値を選択できる
- 「継承」の場合はアプリ共通設定の値がそのまま使われる
- 独自値の場合はその値がアプリ共通設定を上書きする
- セッション起動時の解決順序: アプリ共通設定 -> 環境オーバーライド -> プロジェクト設定 -> セッション設定

### US-003: Worktree管理のClaude Code移行

**ストーリー**: 開発者として、ClaudeWorkの独自worktree管理をClaude Code本体の`--worktree`フラグに完全に移行し、コードベースを簡素化したい。

**受入条件**:
- git-service.tsの`createWorktree()`、`deleteWorktree()`メソッドが削除される
- docker-git-service.tsのworktree関連メソッドが削除される
- セッション作成時にworktreeが自動的にClaude Codeの`--worktree`フラグで管理される
- セッション削除時にアプリ側でworktreeの手動削除を行わない
- Session.worktree_pathとSession.branch_nameの既存データは保持するが、新規セッションではClaude Code管理に移行
- 既存のdiff/commits/rebase/merge APIはworktreeパスを直接使用するため、Claude Code管理のworktreeパスでも動作する

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001 | AppConfigにclaude_defaults設定項目を追加 | US-001 | 定義済 |
| REQ-002 | ConfigServiceにclaude_defaults取得/保存メソッドを追加 | US-001 | 定義済 |
| REQ-003 | /api/settings/config APIでclaude_defaults設定の取得・更新をサポート | US-001 | 定義済 |
| REQ-004 | 設定UIにClaude Codeデフォルトセクションを追加 | US-001 | 定義済 |
| REQ-005 | ExecutionEnvironment.configにclaude_defaults_override構造を追加 | US-002 | 定義済 |
| REQ-006 | 環境設定UIにオーバーライドUIを追加 | US-002 | 定義済 |
| REQ-007 | セッション起動時の設定解決ロジックを実装 | US-002 | 定義済 |
| REQ-008 | git-service.tsのcreateWorktree/deleteWorktreeを削除 | US-003 | 定義済 |
| REQ-009 | docker-git-service.tsのworktree関連メソッドを削除 | US-003 | 定義済 |
| REQ-010 | セッション作成APIからworktree手動作成ロジックを削除 | US-003 | 定義済 |
| REQ-011 | セッション削除APIからworktree手動削除ロジックを削除 | US-003 | 定義済 |
| REQ-012 | デフォルトでworktree=trueとなり全新規セッションがClaude Code --worktreeモードで起動 | US-003 | 定義済 |
| REQ-013 | worktree設定がtrueの場合、worktree_pathにプロジェクトパスを設定し、branch_nameを空にする | US-003 | 定義済 |

## 非機能要件一覧

| カテゴリ | 要件ID | 概要 |
|----------|--------|------|
| 後方互換性 | NFR-001 | 既存セッション（worktree_path/branch_nameが設定済み）は引き続き動作する |
| 後方互換性 | NFR-002 | 既存のプロジェクト/セッションのclaude_code_optionsは優先順位に従って解決される |
| セキュリティ | NFR-003 | dangerouslySkipPermissionsはDocker環境でのみ有効（HOST環境では無視） |
| マイグレーション | NFR-004 | DBスキーマ変更はDrizzle migrationで管理し、サーバー起動時に自動適用 |
| パフォーマンス | NFR-005 | 設定解決処理はセッション起動時の1回のみ実行（ランタイムオーバーヘッドなし） |

## 設定解決順序の詳細 (EARS記法)

### R-001: デフォルト設定の適用
**When** セッション起動時に設定が解決される場合、
**the system shall** アプリケーション共通設定（claude_defaults）をベース値として使用する。

### R-002: 環境オーバーライドの適用
**When** 実行環境のclaude_defaults_overrideに値が設定されている場合、
**the system shall** その値でアプリケーション共通設定を上書きする。

### R-003: プロジェクト設定の適用
**When** Project.claude_code_optionsに対応する値が設定されている場合、
**the system shall** その値で環境解決後の値を上書きする。

### R-004: セッション設定の適用
**When** Session.claude_code_optionsに対応する値が設定されている場合、
**the system shall** その値でプロジェクト解決後の値を上書きする。

### R-005: HOST環境でのskipPermissions制限
**When** 実行環境タイプがHOSTの場合、
**the system shall** dangerouslySkipPermissionsを常にfalseとして扱う（設定値に関わらず）。

### R-006: worktreeモードのデフォルト
**When** 解決後のworktree設定がundefinedの場合、
**the system shall** デフォルト値としてtrueを使用する。

### R-007: Claude Code --worktreeモードのworktree_path
**When** 解決後のworktree設定がtrueの場合、
**the system shall** Session.worktree_pathにプロジェクトパス（Docker環境: `/repo`、Host環境: project.path）を設定し、Session.branch_nameを空文字列に設定する。

## 依存関係

- Claude Code CLI: `--worktree` フラグのサポート（既に実装済み）
- ConfigService: 既存の設定管理パターン（`data/settings.json`）
- ExecutionEnvironment.config: JSON構造の拡張

## スコープ外

- `model`、`allowedTools`、`permissionMode`、`additionalFlags`の共通デフォルト設定（本リリースではdangerouslySkipPermissionsとworktreeのみ対象）
- SSHアダプター対応（未実装のため除外）
- Session.worktree_pathカラムの物理削除（互換性のためDEPRECATEDとして残す）
- 既存セッションの自動マイグレーション（既存セッションは現在のworktree_path/branch_nameをそのまま使用）
