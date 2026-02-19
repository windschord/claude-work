# TASK-012: E2Eテスト（Playwright）

## あなたのタスク
開発ツール設定管理機能の E2E テストを Playwright で実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `tests/e2e/developer-settings.spec.ts` | E2Eテスト |

## 技術的コンテキスト
- テストフレームワーク: Playwright
- 参照: 既存のE2Eテスト（`tests/e2e/`）
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-005.md`

## 受入基準
- [ ] グローバルGit設定の保存テストが実装されている
- [ ] プロジェクト別Git設定の保存テストが実装されている
- [ ] SSH鍵の登録テストが実装されている
- [ ] SSH鍵の削除テストが実装されている
- [ ] バリデーションエラーのテストが実装されている
- [ ] `npm run e2e` ですべてのテストがパスする

## 実装手順
1. E2Eテスト作成
2. テスト実行
3. コミット: `test: Add E2E tests for developer settings`

**推定工数**: 30分 | **ステータス**: TODO | **依存**: TASK-010, TASK-011
