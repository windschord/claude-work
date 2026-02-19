# TASK-011: CreateSessionModalにブランチ選択を追加

## 説明

- 対象ファイル: `src/components/sessions/CreateSessionModal.tsx`（既存を拡張）
- プロジェクト選択時にブランチ一覧を取得
- セッション作成時にブランチを選択可能にする
- Branches API (`GET /api/projects/[id]/branches`) を呼び出し

## 技術的文脈

- フレームワーク: React（関数コンポーネント、hooks使用）
- UI: Tailwind CSS、Headless UI（Listboxコンポーネント）
- 参照すべき既存コード: `src/components/sessions/CreateSessionModal.tsx`

## 実装手順（TDD）

1. テスト拡張: `src/components/sessions/__tests__/CreateSessionModal.test.tsx`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: ブランチ選択UIとAPI呼び出し
5. テスト実行: 通過を確認
6. 実装コミット

## 実装仕様

### 1. ブランチ一覧の取得

**プロジェクト選択時にブランチを取得:**

```typescript
const [branches, setBranches] = useState<Branch[]>([]);
const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
const [isFetchingBranches, setIsFetchingBranches] = useState(false);

useEffect(() => {
  if (!selectedProjectId) {
    setBranches([]);
    setSelectedBranch(null);
    return;
  }

  const fetchBranches = async () => {
    setIsFetchingBranches(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/branches`);
      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();
      setBranches(data.branches);

      // デフォルトブランチを自動選択
      const defaultBranch = data.branches.find((b: Branch) => b.isDefault);
      setSelectedBranch(defaultBranch?.name || data.branches[0]?.name || null);
    } catch (error) {
      logger.error('Failed to fetch branches', { error });
      setBranches([]);
    } finally {
      setIsFetchingBranches(false);
    }
  };

  fetchBranches();
}, [selectedProjectId]);
```

### 2. ブランチ選択UIの追加

**Headless UIのListboxコンポーネントを使用:**

```tsx
import { Listbox } from '@headlessui/react';
import { ChevronDown, GitBranch, Check } from 'lucide-react';

<div className="mt-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    ブランチ
  </label>

  <Listbox value={selectedBranch} onChange={setSelectedBranch}>
    <div className="relative">
      <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <span className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gray-500" />
          <span className="block truncate">
            {selectedBranch || 'ブランチを選択'}
          </span>
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown className="h-5 w-5 text-gray-400" />
        </span>
      </Listbox.Button>

      <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
        {branches.map((branch) => (
          <Listbox.Option
            key={branch.name}
            value={branch.name}
            className={({ active }) =>
              cn(
                'relative cursor-default select-none py-2 pl-10 pr-4',
                active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
              )
            }
          >
            {({ selected }) => (
              <>
                <span className={cn('block truncate', selected && 'font-medium')}>
                  {branch.name}
                  {branch.isDefault && (
                    <span className="ml-2 text-xs text-gray-500">(デフォルト)</span>
                  )}
                  {branch.isRemote && (
                    <span className="ml-2 text-xs text-gray-500">(リモート)</span>
                  )}
                </span>
                {selected && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                    <Check className="h-5 w-5" />
                  </span>
                )}
              </>
            )}
          </Listbox.Option>
        ))}
      </Listbox.Options>
    </div>
  </Listbox>
</div>
```

### 3. ローディング状態の表示

**ブランチ取得中の表示:**

```tsx
{isFetchingBranches ? (
  <div className="flex items-center gap-2 text-sm text-gray-500">
    <Loader2 className="w-4 h-4 animate-spin" />
    ブランチを取得中...
  </div>
) : branches.length === 0 ? (
  <div className="text-sm text-gray-500">
    ブランチがありません
  </div>
) : (
  <Listbox ... />
)}
```

### 4. セッション作成時のブランチ指定

**セッション作成APIにブランチを渡す:**

```typescript
const handleCreateSession = async () => {
  // ...既存のバリデーション

  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: selectedProjectId,
      branch_name: selectedBranch, // ブランチ名を追加
      // ...その他のパラメータ
    }),
  });

  // ...既存の処理
};
```

## テスト仕様

### 追加テストケース

1. **ブランチ一覧取得**
   - プロジェクト選択時にGET /api/projects/[id]/branchesを呼び出す
   - 取得したブランチ一覧が表示される
   - デフォルトブランチが自動選択される

2. **ブランチ選択UI**
   - ブランチListboxが表示される
   - ブランチをクリックすると選択される
   - デフォルトブランチに「(デフォルト)」ラベルが表示される
   - リモートブランチに「(リモート)」ラベルが表示される

3. **ローディング状態**
   - ブランチ取得中にスピナーが表示される
   - 取得完了後にListboxが表示される

4. **セッション作成**
   - セッション作成時に選択したブランチ名が送信される

## 受入基準

- [ ] `src/components/sessions/CreateSessionModal.tsx`が拡張されている
- [ ] Branches API呼び出しが実装されている
- [ ] ブランチ選択UIが実装されている
- [ ] デフォルトブランチが自動選択される
- [ ] ローディング状態が実装されている
- [ ] セッション作成時にブランチ名が送信される
- [ ] テストが追加されている（既存+4件以上）
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ

## 依存関係

- TASK-006（Branches API）

## 推定工数

30分

## ステータス

`TODO`

## 備考

- 既存のCreateSessionModalコンポーネントを拡張
- Headless UIのListboxコンポーネントを使用
- デフォルトブランチを優先的に選択
