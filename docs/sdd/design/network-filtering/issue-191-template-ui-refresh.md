# Issue #191: テンプレート適用後のUI更新 - 設計

## 問題の根本原因

`NetworkFilterSection.tsx` が `NetworkTemplateDialog` に渡している `onApplied` コールバックは、ダイアログを閉じるだけで、ルール一覧の再取得を行っていない。

```tsx
// 現在のコード（問題あり）
<NetworkTemplateDialog
  isOpen={isTemplateDialogOpen}
  onClose={() => setIsTemplateDialogOpen(false)}
  environmentId={environmentId}
  onApplied={() => setIsTemplateDialogOpen(false)}  // ← ルール再取得なし
/>
```

また `NetworkTemplateDialog` はAPIを直接呼んでおり、`useNetworkFilter.applyTemplates` を経由していないため、フックの内部 `fetchAll` がトリガーされない。

## 修正方針

`useNetworkFilter` フックに `refresh` 関数を公開し、`NetworkFilterSectionInner` の `onApplied` コールバックで `refresh` を呼ぶ。

### 変更ファイル

1. `src/hooks/useNetworkFilter.ts`
   - `UseNetworkFilterReturn` 型に `refresh: () => Promise<void>` を追加
   - `fetchAll(environmentId)` をラップした `refresh` を返却

2. `src/components/environments/NetworkFilterSection.tsx`
   - `useNetworkFilter` から `refresh` を取得
   - `onApplied` コールバックで `refresh()` を呼ぶ

### アーキテクチャ上の注意

- `NetworkTemplateDialog` はAPIを直接呼ぶ設計のまま維持する（責務の分離を保つ）
- `refresh` は `fetchAll` の薄いラッパーとして実装し、stale response guard も継承する

## シーケンス図（修正後）

```
ユーザー
  |-- [適用ボタン押下] --> NetworkTemplateDialog.handleApply()
  |                         |-- POST /api/environments/:id/network-rules/templates/apply
  |                         |-- onApplied() コールバック呼び出し
  |                       NetworkFilterSectionInner.onApplied()
  |                         |-- refresh()  ← 追加
  |                         |   |-- fetchAll(environmentId)
  |                         |       |-- GET /api/environments/:id/network-rules
  |                         |       |-- GET /api/environments/:id/network-filter
  |                         |-- setIsTemplateDialogOpen(false)
  |<-- [ルール一覧更新] --
```
