# Issue #214: テンプレート適用直後にルール一覧がUIに反映されない

## 問題事象

| 項目 | 内容 |
|-----|------|
| 現象 | テンプレート適用後、ルール一覧が更新されない（リロードで反映） |
| 期待動作 | テンプレート適用後、追加された全ルールが即座に表示される |
| 再現手順 | 設定 > 実行環境 > Docker環境編集 > テンプレート適用 |
| エラー情報 | APIレスポンスは正常（201, created: 8, skipped: 1） |

## 根本原因

**分類**: 実装バグ（コンポーネント間の状態管理の不整合）

`NetworkTemplateDialog`が`useNetworkFilter`フックの`applyTemplates`を使わず、独自に`fetch`でAPIを呼び出している。そのため、テンプレート適用後に`useNetworkFilter`の`rules`状態が再フェッチされない。

### コードフロー

```
NetworkFilterSection
  └── useNetworkFilter(environmentId) → rules状態を管理
  └── NetworkTemplateDialog
        └── handleApply()
              ├── fetch('/api/.../templates/apply')  ← 独自API呼び出し
              ├── setApplyResult(data)                ← 結果表示用
              └── onApplied()                         ← ダイアログを閉じるだけ
                                                      ← rules再フェッチなし!
```

### 原因箇所

- `src/components/environments/NetworkFilterSection.tsx:217`: `onApplied`が`() => setIsTemplateDialogOpen(false)`のみ
- `src/components/environments/NetworkTemplateDialog.tsx:145-164`: 独自fetch + `onApplied()`呼び出し
- `src/hooks/useNetworkFilter.ts`: `refetch`関数が外部に公開されていない

## 修正方針

### アプローチ: `useNetworkFilter`に`refetch`関数を公開

1. `useNetworkFilter`フックに`refetch`関数を追加して返却
2. `NetworkFilterSection`の`onApplied`コールバック内から`refetch()`を呼び出す
3. `NetworkTemplateDialog`の独自API呼び出しは維持（created/skipped結果表示のため）

### 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/hooks/useNetworkFilter.ts` | `refetch`関数をreturnオブジェクトに追加 |
| `src/components/environments/NetworkFilterSection.tsx` | `onApplied`で`refetch()`を呼び出す |

### 影響範囲

- 既存のルールCRUD操作には影響なし（既に`fetchAll`で再フェッチ済み）
- `useNetworkFilter`の返り値の型が拡張されるが、後方互換性あり

### テスト方針

- `useNetworkFilter`の`refetch`関数が正しくルール一覧を再取得するテスト
- `NetworkFilterSection`のテンプレート適用後に`refetch`が呼ばれるテスト
