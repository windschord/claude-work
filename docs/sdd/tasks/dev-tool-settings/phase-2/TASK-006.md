# TASK-006: /api/ssh-keys エンドポイント実装（TDD）

## あなたのタスク
SSH鍵管理のためのAPIエンドポイントを実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/app/api/ssh-keys/__tests__/route.test.ts` | 統合テスト |
| 作成 | `src/app/api/ssh-keys/route.ts` | GET, POST エンドポイント |
| 作成 | `src/app/api/ssh-keys/[id]/__tests__/route.test.ts` | 統合テスト |
| 作成 | `src/app/api/ssh-keys/[id]/route.ts` | DELETE エンドポイント |

## 技術的コンテキスト
- フレームワーク: Next.js 15 App Router
- Service: SshKeyService
- テスト: Vitest
- 参照: `@docs/sdd/design/dev-tool-settings/api/ssh-keys.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-003.md`

## 受入基準
- [x] `GET /api/ssh-keys` が実装されている（公開鍵のみ返却）
- [x] `POST /api/ssh-keys` が実装されている（暗号化含む）
- [x] `DELETE /api/ssh-keys/:id` が実装されている
- [x] バリデーションエラー処理が実装されている
- [x] 名前重複時のエラーレスポンスが実装されている
- [x] 統合テストがすべてパスする

## 実装手順（TDD）
1. テスト作成: API統合テスト
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add ssh-keys API tests`
4. 実装: APIエンドポイント
5. テスト通過確認
6. 実装コミット: `feat: Implement ssh-keys API`

**推定工数**: 35分 | **ステータス**: DONE | **依存**: Phase 1

**完了サマリー**: /api/ssh-keys (GET, POST) と /api/ssh-keys/[id] (DELETE) を実装。バリデーション、名前重複チェック(409)、不正鍵形式チェック(400)、暗号化エラーハンドリングを含む。テスト15件パス。
