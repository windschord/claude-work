# タスク4.2: UnsavedChangesDialogコンポーネントの実装

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] コンポーネント名: UnsavedChangesDialog
- [x] 表示条件: 未保存の変更がある状態で戻るボタンをクリック
- [x] メッセージ: 「変更が保存されていません。破棄しますか？」
- [x] アクションボタン: 「破棄して戻る」（赤色）、「キャンセル」（グレー）
- [x] キーボード操作: ESCキーでキャンセル、Enterキーで破棄

### 不明/要確認の情報

なし（設計書で全て明確化済み）

---

## 説明

未保存の変更がある場合に警告ダイアログを表示するコンポーネントを実装します。

**対象ファイル**:
- 作成: `src/components/settings/UnsavedChangesDialog.tsx`
- 作成: `src/components/settings/__tests__/UnsavedChangesDialog.test.tsx`

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- TypeScript: 型安全な実装
- React: useEffect for keyboard listeners
- Tailwind CSS: モーダルスタイリング

**参照すべき設計書**:
- `docs/sdd/design/settings-ui/index.md` - コンポーネント5: UnsavedChangesDialog

## 実装手順（TDD）

### 1. テスト作成

`src/components/settings/__tests__/UnsavedChangesDialog.test.tsx` を作成：

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  const mockOnDiscard = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnDiscard.mockClear();
    mockOnCancel.mockClear();
  });

  it('isOpenがfalseの場合、何も表示されない', () => {
    const { container } = render(
      <UnsavedChangesDialog
        isOpen={false}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpenがtrueの場合、ダイアログが表示される', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('未保存の変更があります')).toBeInTheDocument();
    expect(screen.getByText('変更が保存されていません。破棄しますか？')).toBeInTheDocument();
  });

  it('キャンセルボタンが表示される', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
  });

  it('破棄して戻るボタンが表示される', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('破棄して戻る')).toBeInTheDocument();
  });

  it('キャンセルボタンをクリックするとonCancelが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    const cancelButton = screen.getByText('キャンセル');
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnDiscard).not.toHaveBeenCalled();
  });

  it('破棄して戻るボタンをクリックするとonDiscardが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    const discardButton = screen.getByText('破棄して戻る');
    fireEvent.click(discardButton);
    expect(mockOnDiscard).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('ESCキーでonCancelが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('EnterキーでonDiscardが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockOnDiscard).toHaveBeenCalledTimes(1);
  });

  it('破棄ボタンが赤色（bg-red-600）である', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    const discardButton = screen.getByText('破棄して戻る');
    expect(discardButton).toHaveClass('bg-red-600');
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- src/components/settings/__tests__/UnsavedChangesDialog.test.tsx
```

### 3. テストコミット

```bash
git add src/components/settings/__tests__/UnsavedChangesDialog.test.tsx
git commit -m "test: UnsavedChangesDialogコンポーネントのテストを追加"
```

### 4. 実装

`src/components/settings/UnsavedChangesDialog.tsx` を実装：

```typescript
'use client';

import { useEffect } from 'react';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ isOpen, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onDiscard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDiscard, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        {/* タイトル */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          未保存の変更があります
        </h2>

        {/* メッセージ */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          変更が保存されていません。破棄しますか？
        </p>

        {/* アクションボタン */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            破棄して戻る
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5. テスト実行（成功確認）

```bash
npm test -- src/components/settings/__tests__/UnsavedChangesDialog.test.tsx
```

### 6. 実装コミット

```bash
git add src/components/settings/UnsavedChangesDialog.tsx
git commit -m "feat: UnsavedChangesDialogコンポーネントを実装

- モーダルオーバーレイとダイアログボックス
- キーボード操作対応（ESCでキャンセル、Enterで破棄）
- 破棄ボタンは赤色（警告色）
- キャンセルボタンはグレー（中立色）
- ダークモード対応

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/components/settings/UnsavedChangesDialog.tsx` が作成されている
- [ ] `src/components/settings/__tests__/UnsavedChangesDialog.test.tsx` が作成されている
- [ ] TypeScript型定義が含まれている（UnsavedChangesDialogProps）
- [ ] テストが9つ以上ある
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] isOpen=falseの場合、何も表示されない
- [ ] isOpen=trueの場合、ダイアログが表示される
- [ ] キャンセルボタンクリックで onCancel が呼ばれる
- [ ] 破棄ボタンクリックで onDiscard が呼ばれる
- [ ] ESCキーで onCancel が呼ばれる
- [ ] Enterキーで onDiscard が呼ばれる
- [ ] 破棄ボタンが赤色である
- [ ] ダークモード対応されている

## 依存関係

なし

## 推定工数

40分（AIエージェント作業時間）

## ステータス

`TODO`
