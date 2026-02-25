# 要件定義書: Claude Code `--worktree` オプション対応

## 1. 概要

Claude Code CLI に新たに追加された `--worktree` (`-w`) フラグをClaudeWorkのセッション管理に統合する。このフラグを使うと、Claude Code自体がGit worktreeを作成・管理するため、ClaudeWorkが手動でworktreeを作成する必要がなくなる。

### 背景

現在のClaudeWorkアーキテクチャでは:
1. セッション作成時にClaudeWorkがGitService経由でworktreeを作成（`.worktrees/<session-name>/`）
2. Claude Codeプロセスの`cwd`をworktreeパスに設定して起動
3. セッション削除時にClaudeWorkがworktreeを削除

Claude Code `--worktree` フラグでは:
1. Claude Codeが自動的にworktreeを作成（`.claude/worktrees/<name>/`）
2. Claude Codeが終了時にworktreeのクリーンアップを制御
3. ClaudeWork側でのworktree管理が不要になる

### 参考情報

- [Claude Code Worktree公式ドキュメント](https://code.claude.com/docs/en/common-workflows)
- [Boris Cherny - Worktreeサポート告知](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj)

## 2. ユーザーストーリー

### US-001: `--worktree`オプション付きセッション作成
ユーザーとして、セッション作成時にClaude Codeの`--worktree`オプションを有効にしてセッションを開始したい。
それにより、Claude Codeが自動的にworktreeを作成・管理し、ClaudeWorkのworktree管理との二重管理を避けられる。

### US-002: Worktree戦略の選択
プロジェクト管理者として、プロジェクトごとにworktree管理戦略を「ClaudeWork管理」か「Claude Code管理（`--worktree`）」から選択したい。
それにより、プロジェクトの特性に応じた最適なworktree管理方式を採用できる。

### US-003: `--worktree`セッションの表示
ユーザーとして、`--worktree`モードで作成されたセッションを他のセッションと同様にリストで確認したい。
それにより、使用中のworktree管理方式に関わらず統一的なセッション管理ができる。

## 3. 機能要件

### REQ-001: ClaudeCodeOptionsへの`worktree`フィールド追加

ClaudeCodeOptionsインターフェースに`worktree`フィールドを追加しなければならない。

**受入基準:**
- AC-001-1: `ClaudeCodeOptions`に`worktree?: boolean | string`フィールドが追加されている
- AC-001-2: `worktree: true`の場合、Claude Codeが自動生成名でworktreeを作成する
- AC-001-3: `worktree: "feature-name"`の場合、指定名でworktreeを作成する

### REQ-002: セッション作成時のworktree戦略切り替え

セッション作成APIにおいて、`--worktree`オプションが有効な場合、ClaudeWorkによるworktree作成をスキップしなければならない。

**受入基準:**
- AC-002-1: `worktree`オプションが有効時、GitService.createWorktree()が呼ばれない
- AC-002-2: `worktree`オプションが有効時、セッションの`worktree_path`はプロジェクトルートパスが設定される
- AC-002-3: `worktree`オプションが無効時、従来通りClaudeWorkがworktreeを作成する（後方互換性）

### REQ-003: CLIオプションビルド対応

ClaudeOptionsServiceのbuildCliArgs()が`worktree`フィールドを正しくCLI引数に変換しなければならない。

**受入基準:**
- AC-003-1: `worktree: true`の場合、`--worktree`引数が生成される
- AC-003-2: `worktree: "name"`の場合、`--worktree name`引数が生成される
- AC-003-3: `worktree: false`または未指定の場合、引数は生成されない

### REQ-004: バリデーション対応

ClaudeOptionsServiceのバリデーションが`worktree`フィールドを正しく検証しなければならない。

**受入基準:**
- AC-004-1: `worktree`フィールドがboolean型またはstring型として受け付けられる
- AC-004-2: 数値型やオブジェクト型の場合、バリデーションが失敗する
- AC-004-3: `allowedKeys`に`worktree`が追加されている

### REQ-005: UIフォーム対応

ClaudeOptionsFormコンポーネントに`--worktree`オプションのUI要素を追加しなければならない。

**受入基準:**
- AC-005-1: 「Worktreeモード」チェックボックスまたはセレクトボックスが表示される
- AC-005-2: 有効時にWorktree名を入力できるオプショナルなテキストフィールドが表示される
- AC-005-3: 無効時はテキストフィールドが非表示になる

### REQ-006: セッション削除時のworktreeクリーンアップ制御

`--worktree`モードで作成されたセッションの削除時、ClaudeWorkはGitService経由のworktree削除をスキップしなければならない。

**受入基準:**
- AC-006-1: `--worktree`モードのセッション削除時、GitService.deleteWorktree()が呼ばれない
- AC-006-2: 従来モードのセッション削除は既存動作を維持する

### REQ-007: Docker環境での`--worktree`サポート

Docker環境でも`--worktree`オプションが利用可能でなければならない。

**受入基準:**
- AC-007-1: DockerPTYAdapterでClaude Code起動時に`--worktree`引数が渡される
- AC-007-2: Docker環境で`--worktree`有効時、DockerGitService.createWorktree()がスキップされる

## 4. 非機能要件

### NFR-001: 後方互換性
`worktree`オプションが未指定の場合、既存のworktree管理動作が維持されること。デフォルトは従来のClaudeWork管理方式。

### NFR-002: テスタビリティ
追加・変更されるすべてのサービスメソッドに対して単体テストが存在すること。

### NFR-003: セキュリティ
`worktree`名として指定される文字列は、パストラバーサル攻撃を防ぐためにサニタイズされること。

## 5. 影響範囲

### 変更対象ファイル
- `src/services/claude-options-service.ts` - `ClaudeCodeOptions`インターフェース拡張、buildCliArgs/バリデーション対応
- `src/components/claude-options/ClaudeOptionsForm.tsx` - UIフォーム要素追加
- `src/app/api/projects/[project_id]/sessions/route.ts` - worktree作成スキップロジック
- `src/services/adapters/host-adapter.ts` - CLIオプション連携
- `src/services/adapters/docker-adapter.ts` - Docker環境でのCLIオプション連携（該当する場合）

### 変更しないファイル
- `src/db/schema.ts` - DBスキーマ変更不要（`claude_code_options`のJSON内で管理）
- `src/services/git-service.ts` - GitService自体は変更しない（呼び出し側で制御）
- `src/services/environment-adapter.ts` - インターフェース変更不要
