# Docker環境ネットワークフィルタリング - タスク一覧

## 概要

Docker環境のネットワークフィルタリング機能を実装するためのタスク管理。

- **要件定義**: [docs/sdd/requirements/network-filtering/](../../requirements/network-filtering/index.md)
- **技術設計**: [docs/sdd/design/network-filtering/](../../design/network-filtering/index.md)

## 進捗サマリ

| フェーズ | タスク数 | 完了 | 進行中 | TODO |
|---------|---------|------|--------|------|
| Phase 1: 基盤構築 | 3 | 3 | 0 | 0 |
| Phase 2: コアサービス | 3 | 3 | 0 | 0 |
| Phase 3: API・Docker Compose対応 | 3 | 3 | 0 | 0 |
| Phase 4: UI・統合テスト | 3 | 3 | 0 | 0 |
| Phase 5: デフォルトルール自動適用 | 1 | 1 | 0 | 0 |
| **合計** | **13** | **13** | **0** | **0** |

## タスク一覧

### Phase 1: 基盤構築

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-001 | DBスキーマ追加（NetworkFilterConfig, NetworkFilterRule） | DONE | なし | 30min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | IptablesManagerの実装 | DONE | なし | 40min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | NetworkFilterServiceのルールCRUD実装 | DONE | TASK-001 | 40min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |

### Phase 2: コアサービス

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-004 | DNS解決とルール変換ロジックの実装 | DONE | TASK-003 | 40min | [詳細](phase-2/TASK-004.md) @phase-2/TASK-004.md |
| TASK-005 | フィルタリング適用・クリーンアップの実装 | DONE | TASK-002, TASK-004 | 40min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | DockerAdapter拡張（フィルタリング統合） | DONE | TASK-005 | 40min | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |

### Phase 3: API・Docker Compose対応

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-007 | REST APIエンドポイント（ルールCRUD） | DONE | TASK-003 | 40min | [詳細](phase-3/TASK-007.md) @phase-3/TASK-007.md |
| TASK-008 | REST APIエンドポイント（設定・テンプレート・テスト） | DONE | TASK-004 | 40min | [詳細](phase-3/TASK-008.md) @phase-3/TASK-008.md |
| TASK-009 | Docker Compose環境対応・docker-compose.yml更新 | DONE | TASK-006 | 30min | [詳細](phase-3/TASK-009.md) @phase-3/TASK-009.md |

### Phase 4: UI・統合テスト

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-010 | UIコンポーネント（NetworkFilterSection, RuleList, RuleForm） | DONE | TASK-007, TASK-008 | 60min | [詳細](phase-4/TASK-010.md) @phase-4/TASK-010.md |
| TASK-011 | UIコンポーネント（TemplateDialog, TestDialog） | DONE | TASK-008 | 40min | [詳細](phase-4/TASK-011.md) @phase-4/TASK-011.md |
| TASK-012 | 統合テスト・孤立ルールクリーンアップ | DONE | TASK-006, TASK-009 | 40min | [詳細](phase-4/TASK-012.md) @phase-4/TASK-012.md |

### Phase 5: デフォルトルール自動適用

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-013 | Docker環境作成時のデフォルトルール自動適用 | DONE | TASK-003, TASK-008 | 20min | [詳細](phase-5/TASK-013.md) @phase-5/TASK-013.md |

## 並列実行グループ

### グループA（最初に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | src/db/schema.ts | なし |
| TASK-002 | src/services/iptables-manager.ts | なし |

### グループB（TASK-001完了後に実行可能、TASK-002と並列可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-003 | src/services/network-filter-service.ts (CRUD部分) | TASK-001 |

### グループC（TASK-003完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-004 | src/services/network-filter-service.ts (DNS部分) | TASK-003 |
| TASK-007 | src/app/api/environments/[id]/network-rules/** | TASK-003 |

### グループD（TASK-002, TASK-004完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-005 | src/services/network-filter-service.ts (適用部分) | TASK-002, TASK-004 |
| TASK-008 | src/app/api/environments/[id]/network-filter/** | TASK-004 |

### グループE（TASK-005完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-006 | src/services/adapters/docker-adapter.ts | TASK-005 |
| TASK-010 | src/components/environments/NetworkFilter*.tsx | TASK-007, TASK-008 |
| TASK-011 | src/components/environments/Network{Template,Test}Dialog.tsx | TASK-008 |

### グループF（TASK-006完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-009 | docker-compose.yml, 設計ドキュメント | TASK-006 |
| TASK-012 | テストファイル群 | TASK-006, TASK-009 |

## 逆順レビュー結果

### タスク → 設計 の整合性
- [x] NetworkFilterService: 設計書の全メソッドがタスクでカバーされている
- [x] IptablesManager: 設計書の全メソッドがタスクでカバーされている
- [x] API: 設計書の全エンドポイントがタスクでカバーされている
- [x] UI: 設計書の全コンポーネントがタスクでカバーされている
- [x] DB: 設計書のスキーマ定義がTASK-001でカバーされている

### 設計 → 要件 の整合性
- [x] REQ-001（ルール管理）: TASK-001, TASK-003, TASK-007, TASK-010
- [x] REQ-002（自動適用）: TASK-005, TASK-006
- [x] REQ-003（テンプレート）: TASK-008, TASK-011
- [x] REQ-004（モニタリング）: TASK-008, TASK-010
- [x] REQ-005（Docker Compose）: TASK-009
- [x] REQ-009（デフォルトルール自動適用）: TASK-013
- [x] NFR-SEC（セキュリティ）: TASK-002, TASK-005, TASK-012
- [x] NFR-USA（ユーザビリティ）: TASK-010, TASK-011
- [x] NFR-MNT（保守性）: 全タスクにTDD手順を含む
