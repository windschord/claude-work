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

**推定工数**: 30分 | **ステータス**: DONE | **依存**: TASK-008

## 完了サマリー
Docker環境での開発ツール設定自動適用機能の統合テストを作成しました。7つのテストケースがすべてパスし、以下の機能が検証されました:

- Git設定の自動適用（設定あり/なし両方のケース）
- SSH鍵の一時ファイル作成とパーミッション設定
- SSH鍵一時ファイルのクリーンアップ（空ディレクトリ、存在しないディレクトリでのエラーハンドリング）

実際のDockerコンテナ(`claude-code-sandboxed:latest`)を使用した統合テストにより、本番環境に近い条件で検証を行いました。
