# TASK-004: StepAuthentication（認証情報設定ステップ）

## 説明

Step 2: 認証情報設定コンポーネントを作成する。

**対象ファイル**:
- `src/components/projects/AddProjectWizard/StepAuthentication.tsx` (新規作成)
- `src/components/projects/AddProjectWizard/__tests__/StepAuthentication.test.tsx` (新規作成)

**技術的文脈**:
- 既存フック: `useGitHubPATs`（`src/hooks/useGitHubPATs.ts`）
- 既存コンポーネント: `PATCreateDialog`（`src/components/github-pat/PATCreateDialog.tsx`）
- 参照: docs/sdd/design/project-wizard/components/step-authentication.md

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | PATドロップダウン、PAT作成ダイアログ、SSH認証オプション、スキップ可能、PAT作成後の自動選択 |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### テスト
1. テスト作成: `__tests__/StepAuthentication.test.tsx`
   - useGitHubPATsをモック
   - PATドロップダウンにアクティブPATが表示される
   - 「PATを使用しない」オプションが表示される
   - 「新しいPATを作成」ボタンが表示される
   - PAT選択時にonChangeが呼ばれる
   - スキップ可能である旨の案内テキストが表示される
   - PAT作成ダイアログの表示/非表示
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: StepAuthentication.tsx
5. テスト通過を確認
6. 実装コミット

### Props

```typescript
interface StepAuthenticationProps {
  githubPatId: string | null;
  onChange: (data: { githubPatId: string | null }) => void;
}
```

## 受入基準

- [ ] `StepAuthentication.tsx`が存在する
- [ ] テストファイルが存在し、7つ以上のテストケースがある
- [ ] `npx vitest run` で対象テストが通過
- [ ] useGitHubPATsフックを使用している
- [ ] PATCreateDialogを再利用している

## 依存関係

- TASK-001（types.ts）

## 推定工数

30分

## ステータス

`DONE`
