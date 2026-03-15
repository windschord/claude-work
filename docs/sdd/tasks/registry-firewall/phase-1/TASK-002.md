# TASK-002: ConfigService拡張

## 説明

AppConfigに`registry_firewall_enabled`フィールドを追加し、Settings Config APIでの取得・更新に対応する。

**対象ファイル**:
- `src/services/config-service.ts` - 型定義・メソッド追加
- `src/services/__tests__/config-service.test.ts` - テスト追加
- `src/app/api/settings/config/route.ts` - バリデーション追加
- `src/app/api/settings/config/__tests__/route.test.ts` - テスト追加

**設計書**: `docs/sdd/design/registry-firewall/api/settings-config.md`

## 技術的文脈

- 既存の`git_clone_timeout_minutes`や`debug_mode_keep_volumes`と同じパターン
- デフォルト値: `true`(有効)

## 実装手順 (TDD)

1. テスト作成: `config-service.test.ts` に `registry_firewall_enabled` のテストケース追加
   - デフォルト値が`true`であること
   - 設定の保存・読み込みで値が保持されること
   - `getRegistryFirewallEnabled()` が正しい値を返すこと
2. テスト作成: `route.test.ts` に PUT/GET のテストケース追加
   - `registry_firewall_enabled` の更新が成功すること
   - boolean以外の値でバリデーションエラーになること
3. テスト実行: 失敗を確認
4. テストコミット
5. 実装: `config-service.ts` のAppConfig型にフィールド追加、メソッド追加
6. 実装: `route.ts` にバリデーション追加
7. テスト通過を確認
8. 実装コミット

## 受入基準

- [ ] `AppConfig` に `registry_firewall_enabled?: boolean` が追加されている
- [ ] `DEFAULT_CONFIG` に `registry_firewall_enabled: true` が設定されている
- [ ] `getRegistryFirewallEnabled()` メソッドが追加されている
- [ ] PUT /api/settings/config で `registry_firewall_enabled` の更新が可能
- [ ] `registry_firewall_enabled` が boolean 以外の場合は400エラー
- [ ] テストが全て通過

**依存関係**: なし
**推定工数**: 25分
**ステータス**: `DONE`
