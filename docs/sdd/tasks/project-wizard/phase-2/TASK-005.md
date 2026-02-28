# TASK-005: StepRepository（リポジトリ設定ステップ）

## 説明

Step 3: リポジトリ設定コンポーネントを作成する。既存のRemoteRepoFormのロジックを統合する。

**対象ファイル**:
- `src/components/projects/AddProjectWizard/StepRepository.tsx` (新規作成)
- `src/components/projects/AddProjectWizard/__tests__/StepRepository.test.tsx` (新規作成)

**技術的文脈**:
- 既存コンポーネント参照: `RemoteRepoForm`（`src/components/projects/RemoteRepoForm.tsx`）
- UIライブラリ: Tailwind CSS, Lucide icons
- 参照: docs/sdd/design/project-wizard/components/step-repository.md

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | ローカル/リモート切替、パス/URL入力、保存場所選択、プロジェクト名自動検出、HOST無効時Docker限定 |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### テスト
1. テスト作成: `__tests__/StepRepository.test.tsx`
   - ローカル/リモート切替タブが表示される
   - ローカル選択時にパス入力が表示される
   - リモート選択時にURL入力と保存場所選択が表示される
   - パス入力時にonChangeが呼ばれる
   - URL入力時にonChangeが呼ばれる
   - プロジェクト名がURLから自動検出される
   - プロジェクト名がパスから自動検出される
   - 保存場所のデフォルトが「Docker」である
   - 詳細設定の折りたたみが動作する
   - 空入力時にバリデーションエラー（isValid=false）
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: StepRepository.tsx
5. テスト通過を確認
6. 実装コミット

### Props

```typescript
interface StepRepositoryProps {
  wizardData: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  hostEnvironmentDisabled: boolean;
}
```

### プロジェクト名自動検出ユーティリティ

```typescript
export function extractProjectName(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  // SSH URL: git@github.com:user/repo.git
  if (/^[^/]+@[^:]+:.+/.test(trimmed)) {
    const afterColon = trimmed.split(':').pop() || '';
    return afterColon.split('/').pop()?.replace(/\.git$/, '') || '';
  }

  // HTTPS URL or local path
  const name = trimmed.split('/').pop()?.replace(/\.git$/, '') || '';
  return name;
}
```

## 受入基準

- [x] `StepRepository.tsx`が存在する
- [x] テストファイルが存在し、10個以上のテストケースがある
- [x] `npx vitest run` で対象テストが通過
- [x] ローカル/リモートの切替が動作する
- [x] プロジェクト名の自動検出が動作する

## 依存関係

- TASK-001（types.ts）

## 推定工数

40分

## ステータス

`DONE`
