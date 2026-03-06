# Docker環境セッション作成バグ修正 - タスク管理

## 関連ドキュメント

- 要件定義: `docs/sdd/requirements/docker-session-fixes/`
- 技術設計: `docs/sdd/design/docker-session-fixes/`

## タスク一覧

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-001 | NetworkFilterService applyFilter処理順序修正 (Issue #207) | DONE | なし | 30min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | セッション作成API docker_volume_idバリデーション追加 (Issue #208) | DONE | なし | 25min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | DockerGitService getVolumeName docker_volume_id対応 (Issue #206) | DONE | なし | 40min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |
| TASK-004 | API呼び出し元のdockerVolumeId伝播修正 (Issue #206) | DONE | TASK-003 | 30min | [詳細](phase-1/TASK-004.md) @phase-1/TASK-004.md |

## 並列実行グループ

### グループA（並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | `src/services/network-filter-service.ts`, テスト | なし |
| TASK-002 | `src/app/api/projects/[project_id]/sessions/route.ts`, テスト | なし |
| TASK-003 | `src/services/docker-git-service.ts`, `src/services/git-operations.ts`, テスト | なし |

### グループB（グループA完了後）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-004 | `src/app/api/sessions/[id]/*/route.ts` (6ファイル) | TASK-003 |

## 進捗サマリ

- 総タスク数: 4
- 完了: 4
- 進行中: 0
- TODO: 0

## 逆順レビュー

### タスク → 設計

| タスク | 設計コンポーネント | 整合性 |
|--------|-------------------|--------|
| TASK-001 | network-filter-service.md | OK |
| TASK-002 | session-api.md | OK |
| TASK-003 | docker-git-service.md | OK |
| TASK-004 | docker-git-service.md | OK |

### 設計 → 要件

| 設計要素 | 要件 | 整合性 |
|---------|------|--------|
| network-filter-service | US-002/REQ-001,002 | OK |
| session-api | US-003/REQ-001,002 | OK |
| docker-git-service | US-001/REQ-001,002,003 | OK |
