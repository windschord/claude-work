# タスク: アプリケーション共通Claude Code設定・環境オーバーライド・Worktree移行

## 概要

アプリケーション共通のClaude Codeデフォルト設定、環境ごとの継承/オーバーライド、アプリ側Worktree管理の完全削除を実装する。

- 要件定義: [docs/sdd/requirements/global-claude-defaults/](../../requirements/global-claude-defaults/index.md)
- 設計書: [docs/sdd/design/global-claude-defaults/](../../design/global-claude-defaults/index.md)

## タスク一覧

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-001 | ConfigService拡張（claude_defaults） | TODO | - | 25min | [詳細](phase-1/TASK-001.md) |
| TASK-002 | /api/settings/config API拡張 | TODO | TASK-001 | 20min | [詳細](phase-1/TASK-002.md) |
| TASK-003 | ClaudeDefaultsResolverサービス新規作成 | TODO | TASK-001 | 35min | [詳細](phase-1/TASK-003.md) |
| TASK-004 | PTYSessionManager: 設定解決ロジック置き換え | TODO | TASK-003 | 25min | [詳細](phase-2/TASK-004.md) |
| TASK-005 | セッション作成API: worktree手動作成を削除 | TODO | TASK-003 | 30min | [詳細](phase-2/TASK-005.md) |
| TASK-006 | セッション削除API: worktree手動削除を削除 | TODO | TASK-005 | 15min | [詳細](phase-2/TASK-006.md) |
| TASK-007 | git-service.ts: worktreeメソッド削除 | TODO | TASK-005, TASK-006 | 20min | [詳細](phase-3/TASK-007.md) |
| TASK-008 | docker-git-service.ts: worktreeメソッド削除 | TODO | TASK-005, TASK-006 | 15min | [詳細](phase-3/TASK-008.md) |
| TASK-009 | 設定UI: Claude Codeデフォルトセクション追加 | TODO | TASK-002 | 30min | [詳細](phase-3/TASK-009.md) |
| TASK-010 | 環境設定UI: オーバーライドUI追加 | TODO | TASK-003 | 35min | [詳細](phase-3/TASK-010.md) |
| TASK-011 | ドキュメント更新 (CLAUDE.md, ENV_VARS.md) | TODO | TASK-001~010 | 15min | [詳細](phase-4/TASK-011.md) |

## 並列実行グループ

### グループA (Phase 1: 基盤 - 順次実行)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | src/services/config-service.ts + テスト | なし |
| TASK-003 | src/services/claude-defaults-resolver.ts + テスト | TASK-001 (TASK-001完了後に実行) |

### グループB (Phase 1 -> Phase 2: API)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-002 | src/app/api/settings/config/route.ts + テスト | TASK-001 |
| TASK-004 | src/services/pty-session-manager.ts + テスト | TASK-003 |
| TASK-005 | src/app/api/projects/[project_id]/sessions/route.ts + テスト | TASK-003 |
| TASK-006 | src/app/api/sessions/[id]/route.ts + テスト | TASK-005 |

### グループC (Phase 3: 不要コード削除・UI - グループB完了後に並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-007 | src/services/git-service.ts + テスト | TASK-005, TASK-006 |
| TASK-008 | src/services/docker-git-service.ts + テスト | TASK-005, TASK-006 |
| TASK-009 | src/app/settings/app/page.tsx | TASK-002 |
| TASK-010 | src/components/environments/ | TASK-003 |

### グループD (Phase 4: 最終)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-011 | CLAUDE.md, docs/ENV_VARS.md | TASK-001~010 |

## 進捗サマリ

- 全タスク: 11
- 完了: 0
- 進行中: 0
- TODO: 11
