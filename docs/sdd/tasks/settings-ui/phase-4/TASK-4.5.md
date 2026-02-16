# タスク4.5: /settings/github-patページへのBackButton追加

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] 対象ページ: `/settings/github-pat`
- [x] 追加機能: BackButtonをページ上部に配置
- [x] 未保存変更警告: 不要（このページはフォーム入力がないため）

### 不明/要確認の情報

なし

---

## 説明

`/settings/github-pat` ページに BackButton を追加します。このページはフォーム入力がないため、未保存変更警告は不要です。

**対象ファイル**:
- 修正: `src/app/settings/github-pat/page.tsx`

**技術的文脈**:
- 既存ページ: GitHub PAT管理ページ
- 既存コンポーネント: BackButton

## 実装手順

### 1. ファイルの確認

既存の `/settings/github-pat/page.tsx` の構造を確認：

```bash
cat src/app/settings/github-pat/page.tsx | head -50
```

### 2. 実装

`src/app/settings/github-pat/page.tsx` にBackButtonを追加：

```typescript
// ファイル冒頭のimport文に追加
import { BackButton } from '@/components/settings/BackButton';

// ページコンポーネント内の最初（return文の直後）に追加
export default function GitHubPATPage() {
  // ... 既存のロジック

  return (
    <div className="p-6">
      {/* 新規追加: 戻るボタン */}
      <div className="mb-4">
        <BackButton />
      </div>

      {/* 既存のコンテンツ */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">GitHub PAT</h1>
      {/* ... 残りの既存コンテンツ */}
    </div>
  );
}
```

### 3. 動作確認

```bash
# 開発サーバーを起動
npm run dev

# ブラウザで /settings/github-pat にアクセス
# 戻るボタンが表示されること
# クリックすると /settings に遷移すること
```

### 4. コミット

```bash
git add src/app/settings/github-pat/page.tsx
git commit -m "feat: /settings/github-patページにBackButtonを追加

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/app/settings/github-pat/page.tsx` が修正されている
- [ ] BackButtonがページ上部に表示される
- [ ] クリック時に `/settings` に遷移する
- [ ] TypeScriptコンパイルエラーがない
- [ ] ESLintエラーがゼロ
- [ ] 既存機能が正常に動作する

## 依存関係

- タスク4.1（BackButtonコンポーネント）

## 推定工数

15分（AIエージェント作業時間）

## ステータス

`TODO`
