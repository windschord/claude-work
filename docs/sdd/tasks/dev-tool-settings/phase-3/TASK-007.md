# TASK-007: DockerAdapter拡張（injectDeveloperSettings）実装（TDD）

## あなたのタスク
Docker環境への開発ツール設定自動適用機能を DockerAdapter に追加してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/adapters/__tests__/docker-adapter-extension.test.ts` | 単体テスト |
| 変更 | `src/services/adapters/docker-adapter.ts` | injectDeveloperSettings メソッド追加 |

## 技術的コンテキスト
- 言語: TypeScript
- Docker: dockerode
- Services: DeveloperSettingsService, SshKeyService, EncryptionService
- テスト: Vitest（Docker APIはモック）
- 参照: `@docs/sdd/design/dev-tool-settings/components/docker-adapter-extension.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-004.md`

## 受入基準
- [ ] `injectDeveloperSettings(projectId, containerId)` メソッドが実装されている
- [ ] Git 設定（user.name, user.email）が docker exec で設定される
- [ ] SSH 鍵が一時ファイルに保存される（data/environments/<env-id>/ssh/）
- [ ] SSH 鍵ファイルのパーミッションが 0600（秘密鍵）、0644（公開鍵）に設定される
- [ ] `/root/.ssh/config` が生成される
- [ ] SSH 鍵が read-only でマウントされる
- [ ] 単体テストがすべてパスする

## 実装手順（TDD）
1. テスト作成: Docker API をモックした単体テスト
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add DockerAdapter extension tests`
4. 実装: injectDeveloperSettings メソッド
5. テスト通過確認
6. 実装コミット: `feat: Add DockerAdapter.injectDeveloperSettings`

**推定工数**: 50分 | **ステータス**: TODO | **依存**: Phase 2
