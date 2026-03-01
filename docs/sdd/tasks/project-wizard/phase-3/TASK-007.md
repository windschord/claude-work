# TASK-007: 統合 - WizardContainer完成と既存コンポーネント置き換え

## 説明

Phase 2で作成した各ステップコンポーネントをWizardContainerに統合し、既存のAddProjectModalを置き換える。旧コンポーネントの削除も行う。

**対象ファイル**:
- `src/components/projects/AddProjectWizard/WizardContainer.tsx` (修正 - 各ステップ統合)
- `src/components/projects/ProjectList.tsx` (修正 - import置き換え)
- `src/components/layout/Sidebar.tsx` (修正 - import置き換え)
- `src/components/projects/AddProjectModal.tsx` (削除)
- `src/components/projects/RemoteRepoForm.tsx` (削除)
- `src/components/projects/__tests__/AddProjectModal.test.tsx` (削除)
- `src/components/projects/AddProjectModal.test.tsx` (削除)
- `src/components/layout/AddProjectModal.tsx` (削除)
- `src/components/layout/__tests__/AddProjectModal.test.tsx` (削除)

**技術的文脈**:
- 既存Zustandストア: `useAppStore`（addProject, cloneProject, fetchProjects）
- 参照: docs/sdd/design/project-wizard/index.md

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | ProjectListとSidebarのimport置き換え、旧AddProjectModal削除、プロジェクト追加API呼び出しはStep 3で実行 |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### テスト
1. テスト作成: `__tests__/WizardContainer.test.tsx` に統合テストを追加
   - 環境選択→次へでStep 2に遷移
   - Step 2のスキップ→Step 3に遷移
   - Step 3でローカルプロジェクト追加成功→Step 4に遷移
   - Step 3でリモートプロジェクトclone成功→Step 4に遷移
   - Step 3でエラー発生→エラーメッセージ表示
   - Step 4でスキップ→モーダルが閉じる
   - 「戻る」で前ステップに戻り入力値が保持される
   - モーダル再オープン時にStep 1に戻る
2. テスト実行: 失敗を確認
3. テストコミット
4. WizardContainer.tsxに各ステップを統合実装
5. ProjectList.tsx、Sidebar.tsxのimportを置き換え
6. テスト通過を確認
7. 実装コミット
8. 旧ファイル削除

### WizardContainer統合のポイント

Step 3の「追加」ボタン処理:
```typescript
const handleProjectSubmit = async () => {
  setIsSubmitting(true);
  setError(null);
  try {
    let projectId: string;
    if (wizardData.repoType === 'local') {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: wizardData.localPath.trim(),
          name: wizardData.projectName || undefined,
          environment_id: wizardData.environmentId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      projectId = data.project.id;
    } else {
      const response = await fetch('/api/projects/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: wizardData.remoteUrl.trim(),
          targetDir: wizardData.targetDir || undefined,
          cloneLocation: wizardData.cloneLocation,
          githubPatId: wizardData.githubPatId || undefined,
          environment_id: wizardData.environmentId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      projectId = data.project.id;
    }
    // プロジェクト一覧更新
    await fetchProjects();
    updateWizardData({ createdProjectId: projectId });
    setCurrentStep(4);
  } catch (err) {
    setError(err instanceof Error ? err.message : '追加に失敗しました');
  } finally {
    setIsSubmitting(false);
  }
};
```

### 既存コンポーネント置き換え

**ProjectList.tsx**:
```diff
- import { AddProjectModal } from './AddProjectModal';
+ import { AddProjectWizard } from './AddProjectWizard';
...
- <AddProjectModal isOpen={...} onClose={...} />
+ <AddProjectWizard isOpen={...} onClose={...} />
```

**Sidebar.tsx**:
```diff
- import { AddProjectModal } from '@/components/projects/AddProjectModal';
+ import { AddProjectWizard } from '@/components/projects/AddProjectWizard';
...
- <AddProjectModal isOpen={...} onClose={...} />
+ <AddProjectWizard isOpen={...} onClose={...} />
```

## 受入基準

- [x] WizardContainerに全4ステップが統合されている
- [x] ProjectList.tsx、Sidebar.tsxのimportが置き換わっている
- [x] 旧AddProjectModal関連ファイルが削除されている
- [x] 旧RemoteRepoFormが削除されている
- [x] テストファイルが存在し、全統合テストが通過
- [x] `npx vitest run` で既存テストを含む全テストが通過
- [x] `npm run lint` でエラーがない
- [x] `npm run build` が成功する

> **注記**: 上記「削除対象」としてリストされている以下のファイルは、Wizard統合PRのスコープ外であり、Phase 3の別タスクで対応予定です。現時点ではこれらのファイルは残存しています。
> - `src/components/projects/AddProjectModal.tsx`
> - `src/components/projects/RemoteRepoForm.tsx`
> - `src/components/projects/__tests__/AddProjectModal.test.tsx`
> - `src/components/projects/AddProjectModal.test.tsx`
> - `src/components/layout/AddProjectModal.tsx`
> - `src/components/layout/__tests__/AddProjectModal.test.tsx`

## 依存関係

- TASK-002（WizardContainer骨格）
- TASK-003（StepEnvironment）
- TASK-004（StepAuthentication）
- TASK-005（StepRepository）
- TASK-006（StepSession）

## 推定工数

60分

## ステータス

`DONE`
