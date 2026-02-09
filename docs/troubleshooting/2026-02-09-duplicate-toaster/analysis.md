# トラブルシューティング: Toaster重複表示・上部中央通知が消えない

## 問題事象

- セッション詳細ページで通知が2箇所に表示される（上部中央と右上）
- 上部中央の通知が自動消去されない
- 両方の通知内容は全く同じ

## 根本原因

`react-hot-toast` はシングルトンストアを使用している。`toast()` を呼び出すと、マウントされている全ての `<Toaster />` コンポーネントに同じトーストが表示される。

セッション詳細ページでは2つのToasterが同時にマウントされている:

1. `src/app/layout.tsx:24` - グローバルToaster（上部中央、デフォルト位置）
2. `src/app/sessions/[id]/page.tsx:506` - ページ固有Toaster（`position="top-right"`）

2つのToasterが同じトーストインスタンスを競合管理するため、上部中央のToasterで自動消去タイマーが正常動作しない。

## 影響範囲

- セッション詳細ページ（`/sessions/[id]`）のみ影響
- 他のページ（プロジェクト一覧、設定等）はグローバルToasterのみなので正常動作

## 修正方針

1. `layout.tsx` のグローバルToasterの位置を `position="top-right"` に変更
2. `sessions/[id]/page.tsx` の重複Toasterを削除
3. 不要になった `Toaster` のimportも削除

## 関連要件

- REQ-088: タブがアクティブな場合はアプリ内toast通知を表示
- 既存のSDD: `docs/sdd-notifications/`

## ステータス

- [x] 問題特定
- [x] 根本原因分析
- [x] 修正方針策定
- [x] 修正実装（コミット: a5385ba）
- [x] 検証（TypeScriptコンパイル成功）
