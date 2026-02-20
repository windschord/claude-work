# TASK-002: EncryptionService実装（TDD）

## あなたのタスク
SSH秘密鍵のAES-256-CBC暗号化・復号化を行う **EncryptionService** を実装してください。

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
- [ ] `encrypt(plaintext)` メソッドが実装されている
- [ ] `decrypt(encrypted, iv)` メソッドが実装されている
- [ ] 環境変数 `ENCRYPTION_MASTER_KEY` から鍵を取得している
- [ ] 暗号化→復号化のラウンドトリップテストがパスする
- [ ] 異なる平文で異なる暗号文が生成されることをテストで確認
- [ ] 不正なIVでの復号化エラーをテストで確認
- [ ] `npm test` ですべてのテストがパスする

## 実装手順（TDD）
1. テスト作成: `encryption-service.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add EncryptionService tests`
4. 実装: `encryption-service.ts`
5. テスト通過確認
6. 実装コミット: `feat: Implement EncryptionService`

**推定工数**: 40分 | **ステータス**: TODO | **依存**: TASK-001
