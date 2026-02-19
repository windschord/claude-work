# TASK-009: Docker統合テスト

## あなたのタスク
Docker環境での設定自動適用を統合テストで検証してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/adapters/__tests__/docker-integration.test.ts` | 統合テスト |

## 技術的コンテキスト
- テスト: Vitest
- Docker: 実際のDockerコンテナを使用
- 参照: `@docs/sdd/design/dev-tool-settings/components/docker-adapter-extension.md`

## 受入基準
- [ ] 実際のDockerコンテナで Git 設定が適用されることを確認
- [ ] SSH 鍵でプライベートリポジトリにアクセスできることを確認（モックリポジトリ）
- [ ] クリーンアップ後に一時ファイルが削除されることを確認
- [ ] 統合テストがすべてパスする

## 実装手順
1. 統合テスト作成
2. テスト実行
3. コミット: `test: Add Docker integration tests for dev-tool-settings`

**推定工数**: 30分 | **ステータス**: TODO | **依存**: TASK-008
