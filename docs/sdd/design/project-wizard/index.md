# 設計: プロジェクト追加ウィザード

## 概要

既存の`AddProjectModal`をステップバイステップのウィザード形式に置き換える。

**関連Issue**: #173
**要件定義**: docs/sdd/requirements/project-wizard/

## コンポーネント構成

```
src/components/projects/AddProjectWizard/
├── index.ts                    # バレルエクスポート
├── types.ts                    # WizardData型、initialWizardData、extractProjectName
├── WizardContainer.tsx         # ステップ管理、状態管理、モーダル
├── WizardProgressBar.tsx       # プログレスバー
├── StepEnvironment.tsx         # Step 1: 環境選択
├── StepAuthentication.tsx      # Step 2: 認証情報設定
├── StepRepository.tsx          # Step 3: リポジトリ設定
└── StepSession.tsx             # Step 4: セッション開始
```

## 状態管理

WizardContainer内のローカルstateで管理（Zustandストア不使用）。

### WizardData型

```typescript
interface WizardData {
  environmentId: string | null;
  githubPatId: string | null;
  repoType: 'local' | 'remote';
  localPath: string;
  remoteUrl: string;
  cloneLocation: 'docker' | 'host';
  projectName: string;
  targetDir: string;
  createdProjectId: string | null;
  sessionName: string;
}
```

### ステップ間データフロー

- Step 1 → environmentId → Step 4（セッション作成時）
- Step 2 → githubPatId → Step 3（リモートclone時）
- Step 3 → createdProjectId → Step 4（セッション作成時）

## 変更対象

| ファイル | 変更内容 |
|---------|---------|
| ProjectList.tsx | AddProjectModal → AddProjectWizard |
| Sidebar.tsx | AddProjectModal → AddProjectWizard |

## 削除対象

- AddProjectModal.tsx（projects/）
- RemoteRepoForm.tsx
- AddProjectModal.tsx（layout/）
- 関連テストファイル

## 既存フック再利用

- useEnvironments: StepEnvironment
- useGitHubPATs: StepAuthentication
- PATCreateDialog: StepAuthentication
- useAppStore.fetchProjects: WizardContainer
