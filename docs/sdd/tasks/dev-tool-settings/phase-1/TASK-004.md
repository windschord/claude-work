# TASK-004: SshKeyService実装（TDD）

## あなたのタスク
SSH鍵の登録・削除・バリデーションを行う **SshKeyService** を実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/__tests__/ssh-key-service.test.ts` | 単体テスト |
| 作成 | `src/services/ssh-key-service.ts` | SshKeyService実装 |

## 技術的コンテキスト
- 言語: TypeScript
- ORM: Drizzle ORM
- 暗号化: EncryptionService
- テスト: Vitest
- 参照: `@docs/sdd/design/dev-tool-settings/components/ssh-key-service.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-003.md`

## 受入基準
- [ ] `registerKey(input)` メソッドが実装されている（暗号化含む）
- [ ] `getAllKeys()` メソッドが実装されている（公開鍵のみ返却）
- [ ] `getKeyById(id)` メソッドが実装されている
- [ ] `deleteKey(id)` メソッドが実装されている
- [ ] `validateKeyFormat(privateKey)` メソッドが実装されている
- [ ] 名前重複時のエラー処理がテストで確認されている
- [ ] `npm test` ですべてのテストがパスする

## 実装手順（TDD）
1. テスト作成: `ssh-key-service.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add SshKeyService tests`
4. 実装: `ssh-key-service.ts`
5. テスト通過確認
6. 実装コミット: `feat: Implement SshKeyService`

**推定工数**: 40分 | **ステータス**: TODO | **依存**: TASK-001
