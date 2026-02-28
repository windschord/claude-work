# タスク管理: Docker Volumeの読みやすい自動命名と既存Volume選択機能

## 概要

要件定義: `docs/sdd/requirements/volume-naming/`
技術設計: `docs/sdd/design/volume-naming/`

## タスク一覧

| ID | タイトル | Phase | ステータス | 依存 | 工数 | 詳細 |
|----|---------|-------|-----------|------|------|------|
| TASK-001 | volume-naming.tsユーティリティのテスト・実装 | 1 | TODO | なし | 30min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | DockerClient Volume一覧メソッド追加 | 1 | TODO | なし | 20min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | docker-config-validator Volume名バリデーション追加 | 1 | TODO | TASK-001 | 20min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |
| TASK-004 | GET /api/docker/volumes エンドポイント作成 | 2 | TODO | TASK-002 | 25min | [詳細](phase-2/TASK-004.md) @phase-2/TASK-004.md |
| TASK-005 | DockerGitService新命名規則の適用とclone API更新 | 2 | TODO | TASK-001 | 30min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | useDockerVolumesフック作成 | 2 | TODO | TASK-004 | 20min | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |
| TASK-007 | VolumeMountList既存Volume選択UI | 3 | TODO | TASK-003, TASK-006 | 40min | [詳細](phase-3/TASK-007.md) @phase-3/TASK-007.md |

## 並列実行グループ

### グループA（並列実行可能 - 依存なし）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | src/lib/volume-naming.ts, src/lib/__tests__/volume-naming.test.ts | なし |
| TASK-002 | src/services/docker-client.ts, src/services/__tests__/docker-client.test.ts | なし |

### グループB（グループA完了後に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-003 | src/lib/docker-config-validator.ts, src/lib/__tests__/docker-config-validator.test.ts | TASK-001 |
| TASK-004 | src/app/api/docker/volumes/route.ts, テスト | TASK-002 |
| TASK-005 | src/services/docker-git-service.ts, src/app/api/projects/clone/route.ts, テスト | TASK-001 |

### グループC（グループB完了後）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-006 | src/hooks/useDockerVolumes.ts, テスト | TASK-004 |

### グループD（グループC完了後）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-007 | src/components/environments/VolumeMountList.tsx, src/types/environment.ts, テスト | TASK-003, TASK-006 |

## 進捗サマリ

- 合計タスク: 7
- 完了: 0
- 進行中: 0
- TODO: 7
- 推定総工数: 185min
