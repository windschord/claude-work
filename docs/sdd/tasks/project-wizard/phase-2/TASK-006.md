# TASK-006: StepSession（セッション開始ステップ）

## 説明

Step 4: セッション開始コンポーネントを作成する。

**対象ファイル**:
- `src/components/projects/AddProjectWizard/StepSession.tsx` (新規作成)
- `src/components/projects/AddProjectWizard/__tests__/StepSession.test.tsx` (新規作成)

**技術的文脈**:
- セッション作成API: `POST /api/projects/{id}/sessions`
- 参照: docs/sdd/design/project-wizard/components/step-session.md
- 参照: 既存の`CreateSessionModal`（`src/components/sessions/CreateSessionModal.tsx`）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 成功メッセージ、セッション名入力、「作成して開始」「スキップ」ボタン、エラー時リトライ、環境IDの使用 |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### テスト
1. テスト作成: `__tests__/StepSession.test.tsx`
   - プロジェクト追加成功メッセージが表示される
   - セッション名入力フィールドが表示される
   - デフォルトのセッション名が設定されている
   - 「セッションを作成して開始」ボタンが表示される
   - 「スキップしてプロジェクト一覧に戻る」ボタンが表示される
   - スキップボタンクリックでonCompleteが呼ばれる
   - セッション作成中はローディング表示
   - エラー時にエラーメッセージが表示される
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: StepSession.tsx
5. テスト通過を確認
6. 実装コミット

### Props

```typescript
interface StepSessionProps {
  createdProjectId: string | null;
  environmentId: string | null;
  sessionName: string;
  onChange: (data: { sessionName: string }) => void;
  onComplete: () => void;
  error: string | null;
  onRetry: () => void;
}
```

## 受入基準

- [ ] `StepSession.tsx`が存在する
- [ ] テストファイルが存在し、8つ以上のテストケースがある
- [ ] `npx vitest run` で対象テストが通過
- [ ] セッション作成APIを呼び出している
- [ ] スキップ機能が動作する

## 依存関係

- TASK-001（types.ts）

## 推定工数

30分

## ステータス

`DONE`
