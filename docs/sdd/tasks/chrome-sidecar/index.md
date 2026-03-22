# タスク: Chrome Sidecar MCP環境

## 概要

Docker環境のセッション起動時に、セッション専用のChromeサイドカーコンテナを自動起動し、Chrome DevTools MCP経由でClaude Codeからブラウザ操作を可能にする。

- 要件定義: [docs/sdd/requirements/chrome-sidecar/](../../requirements/chrome-sidecar/index.md)
- 設計書: [docs/sdd/design/chrome-sidecar/](../../design/chrome-sidecar/index.md)

## タスク一覧

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-001 | DBスキーマ拡張 (Sessionテーブル) | TODO | - | 20min | [詳細](phase-1/TASK-001.md) |
| TASK-002 | 型定義拡張 (DockerEnvironmentConfig, CreateSessionOptions) | TODO | - | 15min | [詳細](phase-1/TASK-002.md) |
| TASK-003 | ChromeSidecarService | TODO | TASK-001 | 60min | [詳細](phase-2/TASK-003.md) |
| TASK-004 | Environment APIバリデーション | TODO | TASK-002 | 25min | [詳細](phase-2/TASK-004.md) |
| TASK-005 | DockerAdapter拡張 (createSession / destroySession) | TODO | TASK-001, TASK-002, TASK-003 | 50min | [詳細](phase-3/TASK-005.md) |
| TASK-006 | Session API拡張 | TODO | TASK-001 | 20min | [詳細](phase-3/TASK-006.md) |
| TASK-007 | 環境設定UI拡張 (Chrome Sidecarセクション) | TODO | TASK-002, TASK-004 | 35min | [詳細](phase-4/TASK-007.md) |
| TASK-008 | セッションUI拡張 (デバッグポート表示・Chromeバッジ) | TODO | TASK-006 | 30min | [詳細](phase-4/TASK-008.md) |
| TASK-009 | サーバー起動時クリーンアップ統合 | TODO | TASK-003, TASK-005 | 20min | [詳細](phase-4/TASK-009.md) |

## 依存関係図

```
Phase 1 (基盤 - 並列実行可能)
  TASK-001: DBスキーマ拡張
  TASK-002: 型定義拡張

Phase 2 (サービス・API - Phase 1完了後、並列実行可能)
  TASK-003: ChromeSidecarService     [depends: TASK-001]
  TASK-004: Environment APIバリデーション [depends: TASK-002]

Phase 3 (統合 - Phase 2完了後、並列実行可能)
  TASK-005: DockerAdapter拡張        [depends: TASK-001, TASK-002, TASK-003]
  TASK-006: Session API拡張          [depends: TASK-001]

Phase 4 (UI・統合 - Phase 3完了後、並列実行可能)
  TASK-007: 環境設定UI拡張           [depends: TASK-002, TASK-004]
  TASK-008: セッションUI拡張         [depends: TASK-006]
  TASK-009: サーバー起動時クリーンアップ [depends: TASK-003, TASK-005]
```

## 並列実行グループ

### グループA (Phase 1: 基盤 - 並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | src/db/schema.ts, drizzle/ | なし |
| TASK-002 | src/types/environment.ts, src/services/environment-adapter.ts | なし |

### グループB (Phase 2: サービス・API - グループA完了後に並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-003 | src/services/chrome-sidecar-service.ts + テスト | TASK-001 |
| TASK-004 | src/app/api/environments/ + テスト | TASK-002 |

### グループC (Phase 3: 統合 - グループB完了後に並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-005 | src/services/adapters/docker-adapter.ts, src/services/pty-session-manager.ts + テスト | TASK-001, TASK-002, TASK-003 |
| TASK-006 | src/app/api/sessions/ + テスト | TASK-001 |

### グループD (Phase 4: UI・統合仕上げ - グループC完了後に並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-007 | src/components/environments/, src/app/settings/environments/ | TASK-002, TASK-004 |
| TASK-008 | src/components/ (セッション関連) | TASK-006 |
| TASK-009 | server.ts | TASK-003, TASK-005 |

## 進捗サマリ

- 全タスク: 9
- 完了: 0
- 進行中: 0
- TODO: 9
