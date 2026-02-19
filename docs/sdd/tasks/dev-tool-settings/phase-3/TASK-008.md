# TASK-008: SSH鍵一時ファイル管理とクリーンアップ実装

## あなたのタスク
SSH鍵一時ファイルのクリーンアップロジックを DockerAdapter に追加してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 変更 | `src/services/adapters/docker-adapter.ts` | cleanupSshKeys メソッド追加 |
| 変更 | セッション削除処理 | クリーンアップ呼び出し追加 |

## 技術的コンテキスト
- 言語: TypeScript
- ファイル操作: fs/promises
- 参照: `@docs/sdd/design/dev-tool-settings/components/docker-adapter-extension.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/nfr/security.md`

## 受入基準
- [ ] `cleanupSshKeys(envId)` メソッドが実装されている
- [ ] data/environments/<env-id>/ssh/ ディレクトリ内のファイルが削除される
- [ ] コンテナ停止時にクリーンアップが呼び出される
- [ ] エラー発生時もクリーンアップが試行される

## 実装手順
1. cleanupSshKeys メソッド実装
2. セッション削除処理に呼び出し追加
3. テストで動作確認
4. コミット: `feat: Add SSH key cleanup on container stop`

**推定工数**: 30分 | **ステータス**: IN_PROGRESS | **依存**: TASK-007
