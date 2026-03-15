# タスク: Registry Firewall統合

## 概要

registry-firewallをClaudeWorkに統合し、Docker実行環境でパッケージレベルのサプライチェーン攻撃保護を実現する。

- 要件定義: [docs/sdd/requirements/registry-firewall/](../../requirements/registry-firewall/index.md)
- 設計書: [docs/sdd/design/registry-firewall/](../../design/registry-firewall/index.md)

## タスク一覧

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-001 | Docker Compose構成 + 設定ファイル | TODO | - | 20min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | ConfigService拡張 | TODO | - | 25min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | Registry Firewall Client | TODO | - | 30min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |
| TASK-004 | Registry Firewall API (health, blocks) | TODO | TASK-003 | 25min | [詳細](phase-2/TASK-004.md) @phase-2/TASK-004.md |
| TASK-005 | DockerAdapter拡張 | TODO | TASK-002 | 35min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | Next.js rewrites + UI | TODO | TASK-002, TASK-004 | 35min | [詳細](phase-3/TASK-006.md) @phase-3/TASK-006.md |
| TASK-007 | ドキュメント更新 | TODO | TASK-001~006 | 15min | [詳細](phase-3/TASK-007.md) @phase-3/TASK-007.md |

## 並列実行グループ

### グループA (Phase 1: 基盤 - 並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | docker-compose.yml, configs/registry-firewall.yaml | なし |
| TASK-002 | src/services/config-service.ts, src/app/api/settings/config/route.ts + テスト | なし |
| TASK-003 | src/services/registry-firewall-client.ts + テスト | なし |

### グループB (Phase 2: 統合 - グループA完了後に並列実行可能)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-004 | src/app/api/registry-firewall/** | TASK-003 |
| TASK-005 | src/services/adapters/docker-adapter.ts + テスト | TASK-002 |

### グループC (Phase 3: UI・ドキュメント - グループB完了後)

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-006 | next.config.ts, src/app/settings/environments/page.tsx, src/components/environments/** | TASK-002, TASK-004 |
| TASK-007 | docs/ENV_VARS.md, CLAUDE.md | TASK-001~006 |

## 進捗サマリ

- 全タスク: 7
- 完了: 0
- 進行中: 0
- TODO: 7
