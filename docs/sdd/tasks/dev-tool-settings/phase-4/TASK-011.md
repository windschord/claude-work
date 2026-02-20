# TASK-011: Zustand Store実装

## あなたのタスク
開発ツール設定用の Zustand ストアを実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/store/developer-settings-store.ts` | Zustand ストア |
| 作成 | `src/store/__tests__/developer-settings-store.test.ts` | ストアのテスト |

## 技術的コンテキスト
- 状態管理: Zustand
- API: /api/developer-settings/*, /api/ssh-keys
- テスト: Vitest
- 参照: `@docs/sdd/design/dev-tool-settings/components/developer-settings-page.md`

## 受入基準
- [ ] `useDeveloperSettingsStore` が実装されている
- [ ] グローバル設定の取得・更新アクションがある
- [ ] プロジェクト設定の取得・更新・削除アクションがある
- [ ] SSH鍵の取得・登録・削除アクションがある
- [ ] ローディング状態とエラー状態を管理している
- [ ] ストアのテストがすべてパスする

## 実装手順
1. Zustand ストア定義
2. APIクライアント統合
3. テスト作成
4. コミット: `feat: Implement DeveloperSettingsStore`

**推定工数**: 30分 | **ステータス**: TODO | **依存**: Phase 3
