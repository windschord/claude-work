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
- [x] `cleanupSshKeys(envId)` メソッドが実装されている
- [x] data/environments/<env-id>/ssh/ ディレクトリ内のファイルが削除される
- [x] コンテナ停止時にクリーンアップが呼び出される
- [x] エラー発生時もクリーンアップが試行される

## 実装手順
1. cleanupSshKeys メソッド実装
2. セッション削除処理に呼び出し追加
3. テストで動作確認
4. コミット: `feat: Add SSH key cleanup on container stop`

**推定工数**: 30分 | **ステータス**: DONE | **依存**: TASK-007

## 完了サマリー

SSH鍵一時ファイルのクリーンアップロジックをDockerAdapterに追加しました。

### 実装内容
- `DockerAdapter.destroySession()`にクリーンアップ呼び出しを追加
- PTY `onExit`ハンドラにクリーンアップ呼び出しを追加（2箇所）
- エラー時も処理を続行するようtry-catchで保護
- テストケースの追加と検証

### 変更ファイル
- `src/services/adapters/docker-adapter.ts`: クリーンアップ呼び出し追加
- `src/services/adapters/__tests__/docker-adapter-extension.test.ts`: クリーンアップテスト実装
- `src/services/adapters/__tests__/docker-adapter.test.ts`: destroySessionテスト追加

### テスト結果
- docker-adapter-extension.test.ts: 17 passed
- docker-adapter.test.ts: 64 passed

コミット: 9713bba
