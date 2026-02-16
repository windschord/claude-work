# タスク4.1: BackButtonコンポーネントの実装

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] コンポーネント名: BackButton
- [x] 配置場所: 全設定詳細ページのページ上部
- [x] 遷移先: `/settings`
- [x] ラベル: ArrowLeftアイコン + 「設定に戻る」テキスト
- [x] コールバック: `onBeforeNavigate?: () => boolean`（戻る前のチェック関数）

### 不明/要確認の情報

なし（設計書で全て明確化済み）

---

## 説明

全設定詳細ページで使用される共通の戻るボタンコンポーネントを実装します。

**対象ファイル**:
- 作成: `src/components/settings/BackButton.tsx`
- 作成: `src/components/settings/__tests__/BackButton.test.tsx`

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- TypeScript: 型安全な実装
- lucide-react: ArrowLeftアイコン
- next/navigation: useRouter for navigation
- Tailwind CSS: スタイリング

**参照すべき設計書**:
- `docs/sdd/design/settings-ui/index.md` - コンポーネント4: BackButton

## 実装手順（TDD）

### 1. テスト作成

`src/components/settings/__tests__/BackButton.test.tsx` を作成し、以下のテストケースを実装：

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackButton } from '../BackButton';

// Next.js routerのモック
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('戻るボタンが正しくレンダリングされる', () => {
    render(<BackButton />);
    expect(screen.getByText('設定に戻る')).toBeInTheDocument();
  });

  it('ArrowLeftアイコンが表示される', () => {
    const { container } = render(<BackButton />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('クリック時に/settingsに遷移する', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('onBeforeNavigateがtrueを返す場合、遷移する', () => {
    const onBeforeNavigate = vi.fn(() => true);
    render(<BackButton onBeforeNavigate={onBeforeNavigate} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onBeforeNavigate).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('onBeforeNavigateがfalseを返す場合、遷移しない', () => {
    const onBeforeNavigate = vi.fn(() => false);
    render(<BackButton onBeforeNavigate={onBeforeNavigate} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onBeforeNavigate).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('適切なスタイルが適用されている', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('inline-flex');
    expect(button).toHaveClass('items-center');
    expect(button).toHaveClass('gap-2');
    expect(button).toHaveClass('transition-colors');
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- src/components/settings/__tests__/BackButton.test.tsx
```

すべてのテストが失敗することを確認。

### 3. テストコミット

```bash
git add src/components/settings/__tests__/BackButton.test.tsx
git commit -m "test: BackButtonコンポーネントのテストを追加"
```

### 4. 実装

`src/components/settings/BackButton.tsx` を実装：

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onBeforeNavigate?: () => boolean;
}

export function BackButton({ onBeforeNavigate }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    // 戻る前のチェック（未保存変更の確認など）
    if (onBeforeNavigate && !onBeforeNavigate()) {
      return; // ナビゲーション中断
    }
    router.push('/settings');
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      設定に戻る
    </button>
  );
}
```

### 5. テスト実行（成功確認）

```bash
npm test -- src/components/settings/__tests__/BackButton.test.tsx
```

すべてのテストが通過することを確認。

### 6. 実装コミット

```bash
git add src/components/settings/BackButton.tsx
git commit -m "feat: BackButtonコンポーネントを実装

- useRouterを使用した/settingsへのナビゲーション
- onBeforeNavigateコールバックによる戻る前のチェック機能
- ArrowLeftアイコン + 「設定に戻る」テキスト
- ホバーエフェクトとダークモード対応

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/components/settings/BackButton.tsx` が作成されている
- [ ] `src/components/settings/__tests__/BackButton.test.tsx` が作成されている
- [ ] TypeScript型定義が含まれている（BackButtonProps）
- [ ] テストが6つ以上ある
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] ArrowLeftアイコンが表示される
- [ ] クリック時に `/settings` に遷移する
- [ ] `onBeforeNavigate` が `false` を返す場合、遷移しない
- [ ] ダークモード対応されている
- [ ] ホバーエフェクトが動作する

## 依存関係

なし

## 推定工数

30分（AIエージェント作業時間）

## ステータス

`TODO`
