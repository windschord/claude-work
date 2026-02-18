# TASK-008: AddProjectModalにリモートタブを追加

## 説明

- 対象ファイル: `src/components/projects/AddProjectModal.tsx`（既存を拡張）
- リモートリポジトリからのクローン機能をモーダルに統合
- タブUI（ローカル/リモート）を追加
- RemoteRepoFormコンポーネントを統合

## 技術的文脈

- フレームワーク: React（関数コンポーネント、hooks使用）
- UI: Tailwind CSS、Headless UI（Tabコンポーネント）
- 参照すべき既存コード: `src/components/projects/AddProjectModal.tsx`
- 依存コンポーネント: `src/components/projects/RemoteRepoForm.tsx`

## 実装手順（TDD）

1. テスト拡張: `src/components/projects/__tests__/AddProjectModal.test.tsx`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: タブUIとRemoteRepoForm統合
5. テスト実行: 通過を確認
6. 実装コミット

## 実装仕様

### 1. タブUIの追加

**Headless UIのTabコンポーネントを使用:**

```tsx
import { Tab } from '@headlessui/react';

<Tab.Group>
  <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 p-1">
    <Tab className={/* スタイル */}>
      ローカルディレクトリ
    </Tab>
    <Tab className={/* スタイル */}>
      リモートリポジトリ
    </Tab>
  </Tab.List>

  <Tab.Panels className="mt-4">
    <Tab.Panel>
      {/* 既存のローカルディレクトリフォーム */}
    </Tab.Panel>

    <Tab.Panel>
      <RemoteRepoForm
        onSuccess={handleRemoteCloneSuccess}
        onCancel={onClose}
      />
    </Tab.Panel>
  </Tab.Panels>
</Tab.Group>
```

### 2. RemoteRepoFormの統合

**成功時の処理:**

```typescript
const handleRemoteCloneSuccess = (project: Project) => {
  // プロジェクト一覧を更新（既存のrefresh機能を使用）
  mutate(); // SWRのmutate、またはrefetch等

  // モーダルを閉じる
  onClose();

  // 成功通知
  toast.success(`プロジェクト「${project.name}」を登録しました`);
};
```

### 3. タブのデフォルト選択

**初期状態:**
- デフォルトは「ローカルディレクトリ」タブ（既存動作を維持）
- 環境変数等でデフォルトタブを変更可能にする（オプション）

### 4. スタイリング

**タブのアクティブ/非アクティブ状態:**

```tsx
<Tab
  className={({ selected }) =>
    cn(
      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
      'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
      selected
        ? 'bg-white text-blue-700 shadow'
        : 'text-gray-700 hover:bg-white/[0.12] hover:text-gray-900'
    )
  }
>
  {tabLabel}
</Tab>
```

## テスト仕様

### 追加テストケース

1. **タブ表示**
   - 「ローカルディレクトリ」タブが表示される
   - 「リモートリポジトリ」タブが表示される
   - デフォルトで「ローカルディレクトリ」タブが選択される

2. **タブ切り替え**
   - 「リモートリポジトリ」タブをクリックするとRemoteRepoFormが表示される
   - 「ローカルディレクトリ」タブに戻ると既存フォームが表示される

3. **RemoteRepoForm統合**
   - RemoteRepoFormのonSuccessが呼ばれるとモーダルが閉じる
   - RemoteRepoFormのonCancelが呼ばれるとモーダルが閉じる
   - clone成功時にプロジェクト一覧が更新される

## 受入基準

- [ ] `src/components/projects/AddProjectModal.tsx`が拡張されている
- [ ] タブUIが実装されている（ローカル/リモート）
- [ ] RemoteRepoFormが統合されている
- [ ] タブ切り替えが正常に動作する
- [ ] clone成功時にモーダルが閉じる
- [ ] プロジェクト一覧が更新される
- [ ] テストが追加されている（既存+5件以上）
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ

## 依存関係

- TASK-007（RemoteRepoForm）

## 推定工数

30分

## ステータス

`DONE`

## 完了報告

### 実装済み内容

**テスト追加** (`src/components/projects/__tests__/AddProjectModal.test.tsx`):
1. タブUI表示テスト（4ケース）
   - 「ローカル」「リモート」タブの表示確認
   - デフォルト選択の確認
   - タブ切り替え動作の確認

2. RemoteRepoForm統合テスト（4ケース）
   - clone成功時のモーダルクローズ
   - プロジェクト一覧更新の確認
   - clone失敗時のエラー表示
   - キャンセルボタン動作の確認

### テスト結果
- 全20テスト通過（既存12 + 新規8）
- ESLintエラーなし
- TypeScript型エラーなし

### コミット
- テストコミット: `587adef` "test: AddProjectModalにタブUI統合のテストを追加"

### 備考
- 既存実装は完全にTASK仕様を満たしている
- 今回はテストカバレッジの向上のみ実施

## 備考

- 既存のAddProjectModalコンポーネントを拡張
- Headless UIのTabコンポーネントを使用
- 既存のローカルディレクトリ機能は維持
