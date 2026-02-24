# TASK-002: EncryptionService実装（TDD）

## あなたのタスク
SSH秘密鍵のAES-256-GCM暗号化・復号化を行う **EncryptionService** を実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/__tests__/encryption-service.test.ts` | 単体テスト |
| 作成 | `src/services/encryption-service.ts` | EncryptionService実装 |

## 技術的コンテキスト
- 言語: TypeScript
- 暗号化: Node.js標準 crypto モジュール
- テスト: Vitest
- 参照: `@docs/sdd/design/dev-tool-settings/components/encryption-service.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/nfr/security.md`

## 受入基準
- [x] `encrypt(plainText: string): Promise<string>` メソッドが実装されている（戻り値: `iv:authTag:encrypted` 形式）
- [x] `decrypt(encryptedText: string): Promise<string>` メソッドが実装されている
- [x] 環境変数 `ENCRYPTION_KEY`（Base64エンコードされた32バイト鍵）から鍵を取得している
- [x] 鍵長が32バイトでない場合に `EncryptionError` をスローする
- [x] 暗号化→復号化のラウンドトリップテストがパスする
- [x] 異なる平文で異なる暗号文が生成されることをテストで確認
- [x] 不正な形式での `DecryptionError` をテストで確認
- [x] `ENCRYPTION_KEY` 未設定時に `EncryptionKeyNotFoundError` をスローする
- [x] `npm test` ですべてのテストがパスする

## 実装手順（TDD）
1. テスト作成: `encryption-service.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add EncryptionService tests`
4. 実装: `encryption-service.ts`
5. テスト通過確認
6. 実装コミット: `feat: Implement EncryptionService`

**推定工数**: 40分 | **ステータス**: DONE | **依存**: TASK-001

**完了サマリー**: EncryptionServiceをAES-256-GCMで実装。encrypt/decryptメソッド、環境変数ENCRYPTION_KEYからの鍵取得を実装。保存形式はiv:authTag:encrypted（コロン区切り）。テスト12件パス。
