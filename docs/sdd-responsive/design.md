# 設計書: モバイル対応・テーマ設定

## 概要

モバイル対応（レスポンシブデザイン）およびテーマ設定（ライト/ダークモード）の設計を定義します。

---

## コンポーネント

### フロントエンド

#### コンポーネント: Zustand Store（テーマ関連）

**目的**: テーマ状態の管理

**ストア構成**:
```typescript
interface AppState {
  // UI
  theme: 'light' | 'dark' | 'system';
  isMobile: boolean;
}
```

#### コンポーネント: ThemeProvider

**目的**: テーマの適用と永続化

**責務**:
- OSのテーマ設定の検出
- テーマの切り替え
- ローカルストレージへの保存と復元

**実装**: next-themesライブラリを使用

---

## 実装詳細

### テーマ設定

**使用ライブラリ**: next-themes

**実装場所**: `src/app/layout.tsx`

```typescript
import { ThemeProvider } from 'next-themes';

export default function RootLayout({ children }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### レスポンシブデザイン

**ブレークポイント**:
- モバイル: < 768px
- タブレット: 768px - 1024px
- デスクトップ: > 1024px

**Tailwind CSS設定**:
```css
/* デフォルト: モバイル */
.container { ... }

/* タブレット以上 */
@media (min-width: 768px) {
  .container { ... }
}

/* デスクトップ以上 */
@media (min-width: 1024px) {
  .container { ... }
}
```

### モバイル向けレイアウト

**セッション一覧（カード形式）**:
```typescript
// モバイル表示時のセッションカード
<div className="grid grid-cols-1 gap-4 md:hidden">
  {sessions.map((session) => (
    <SessionCard
      key={session.id}
      session={session}
      onClick={() => router.push(`/sessions/${session.id}`)}
    />
  ))}
</div>

// デスクトップ表示時のテーブル
<div className="hidden md:block">
  <SessionTable sessions={sessions} />
</div>
```

---

## 要件との整合性チェック

| 要件ID | 要件内容 | 設計対応 |
|--------|----------|----------|
| REQ-063 | 768px未満でモバイルレイアウト | Tailwind CSSブレークポイント |
| REQ-064 | セッション一覧のカード形式 | SessionCard コンポーネント |
| REQ-065 | タッチ操作対応 | Tailwind CSSタッチ対応クラス |
| REQ-066 | OSテーマ設定の検出 | next-themes enableSystem |
| REQ-067 | テーマ切り替え | ThemeToggle コンポーネント |
| REQ-068 | ローカルストレージ保存 | next-themes 自動保存 |
| REQ-069 | 保存テーマの復元 | next-themes 自動復元 |
