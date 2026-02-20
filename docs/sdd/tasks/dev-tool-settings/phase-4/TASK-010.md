# TASK-010: DeveloperSettingsPage UI実装

## あなたのタスク
開発ツール設定画面（/settings/developer）を実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/app/settings/developer/page.tsx` | メインページ |
| 作成 | `src/components/developer-settings/DeveloperSettingsForm.tsx` | Git設定フォーム |
| 作成 | `src/components/developer-settings/SshKeyManager.tsx` | SSH鍵管理UI |

## 技術的コンテキスト
- フレームワーク: Next.js 15 App Router, React
- UI: Tailwind CSS, Headless UI
- 状態管理: Zustand
- 参照: `@docs/sdd/design/dev-tool-settings/components/developer-settings-page.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-005.md`

## 受入基準
- [ ] `/settings/developer` ページが表示される
- [ ] グローバル設定タブとプロジェクト別設定タブがある
- [ ] Git設定フォームが動作する（保存・更新）
- [ ] SSH鍵アップロードフォームが動作する
- [ ] SSH鍵一覧が表示される
- [ ] SSH鍵削除が動作する
- [ ] バリデーションエラーが表示される
- [ ] レスポンシブデザインが適用されている

## 実装手順
1. ページとコンポーネント作成
2. APIとの連携実装
3. バリデーション実装
4. スタイリング適用
5. コミット: `feat: Implement DeveloperSettingsPage UI`

**推定工数**: 50分 | **ステータス**: TODO | **依存**: Phase 3
