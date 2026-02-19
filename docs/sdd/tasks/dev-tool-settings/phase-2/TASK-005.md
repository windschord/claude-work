# TASK-005: /api/developer-settings/* エンドポイント実装（TDD）

## あなたのタスク
Git設定管理のためのAPIエンドポイントを実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/app/api/developer-settings/global/__tests__/route.test.ts` | 統合テスト |
| 作成 | `src/app/api/developer-settings/global/route.ts` | GET, PUT エンドポイント |
| 作成 | `src/app/api/developer-settings/project/[projectId]/__tests__/route.test.ts` | 統合テスト |
| 作成 | `src/app/api/developer-settings/project/[projectId]/route.ts` | GET, PUT, DELETE エンドポイント |

## 技術的コンテキスト
- フレームワーク: Next.js 15 App Router
- Service: DeveloperSettingsService
- テスト: Vitest
- 参照: `@docs/sdd/design/dev-tool-settings/api/developer-settings.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-001.md`, `US-002.md`

## 受入基準
- [ ] `GET /api/developer-settings/global` が実装されている
- [ ] `PUT /api/developer-settings/global` が実装されている
- [ ] `GET /api/developer-settings/project/:projectId` が実装されている
- [ ] `PUT /api/developer-settings/project/:projectId` が実装されている
- [ ] `DELETE /api/developer-settings/project/:projectId` が実装されている
- [ ] バリデーションエラー処理が実装されている
- [ ] 統合テストがすべてパスする

## 実装手順（TDD）
1. テスト作成: API統合テスト
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add developer-settings API tests`
4. 実装: APIエンドポイント
5. テスト通過確認
6. 実装コミット: `feat: Implement developer-settings API`

**推定工数**: 35分 | **ステータス**: TODO | **依存**: Phase 1
