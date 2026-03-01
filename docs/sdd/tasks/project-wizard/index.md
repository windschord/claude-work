# タスク管理: プロジェクト追加ウィザード

## 概要

Issue #173: プロジェクト追加ウィザードの実装タスク。
AddProjectModalをウィザード形式に置き換え。TDDで実装。

**要件定義**: docs/sdd/requirements/project-wizard/
**設計書**: docs/sdd/design/project-wizard/

## 進捗サマリ

| フェーズ | タスク数 | 完了 | 進行中 | TODO |
|---------|---------|------|--------|------|
| Phase 1: 基盤 | 2 | 2 | 0 | 0 |
| Phase 2: ステップ | 4 | 4 | 0 | 0 |
| Phase 3: 統合 | 1 | 1 | 0 | 0 |
| **合計** | **7** | **7** | **0** | **0** |

## タスク一覧

| ID | タイトル | フェーズ | ステータス | 依存 | 工数 | 詳細リンク |
|----|---------|---------|-----------|------|------|------------|
| TASK-001 | 型定義とWizardProgressBar | Phase 1 | DONE | - | 30min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | WizardContainer骨格 | Phase 1 | DONE | TASK-001 | 40min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | StepEnvironment | Phase 2 | DONE | TASK-001 | 30min | [詳細](phase-2/TASK-003.md) @phase-2/TASK-003.md |
| TASK-004 | StepAuthentication | Phase 2 | DONE | TASK-001 | 30min | [詳細](phase-2/TASK-004.md) @phase-2/TASK-004.md |
| TASK-005 | StepRepository | Phase 2 | DONE | TASK-001 | 40min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | StepSession | Phase 2 | DONE | TASK-001 | 30min | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |
| TASK-007 | 統合・置き換え・削除 | Phase 3 | DONE | TASK-002〜006 | 60min | [詳細](phase-3/TASK-007.md) @phase-3/TASK-007.md |

## 並列実行グループ

### グループA（最初に実行）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | AddProjectWizard/types.ts, WizardProgressBar.tsx | なし |

### グループB（TASK-001完了後に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-002 | AddProjectWizard/WizardContainer.tsx, index.ts | TASK-001 |
| TASK-003 | AddProjectWizard/StepEnvironment.tsx | TASK-001 |
| TASK-004 | AddProjectWizard/StepAuthentication.tsx | TASK-001 |
| TASK-005 | AddProjectWizard/StepRepository.tsx | TASK-001 |
| TASK-006 | AddProjectWizard/StepSession.tsx | TASK-001 |

### グループC（グループB完了後）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-007 | WizardContainer.tsx, ProjectList.tsx, Sidebar.tsx, 旧ファイル削除 | TASK-002〜006 |

## 依存関係図

```text
TASK-001 (型定義 + ProgressBar)
├── TASK-002 (WizardContainer骨格)
├── TASK-003 (StepEnvironment)     ─┐
├── TASK-004 (StepAuthentication)  ─┤
├── TASK-005 (StepRepository)      ─┤─→ TASK-007 (統合)
└── TASK-006 (StepSession)         ─┘
```

## 推定合計工数

260分（約4.3時間）
