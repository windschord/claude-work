# TASK-005: DockerAdapter拡張

## 説明

DockerAdapterの`buildContainerOptions`にregistry-firewallのレジストリプロキシ設定注入を追加する。

**対象ファイル**:
- `src/services/adapters/docker-adapter.ts` - buildContainerOptions拡張
- `src/services/adapters/__tests__/docker-adapter.test.ts` - テスト追加

**設計書**: `docs/sdd/design/registry-firewall/components/docker-adapter.md`

## 技術的文脈

- 既存の`filterEnabled`によるHTTP_PROXY設定注入と同様のパターン
- `CreateSessionOptions`に`registryFirewallEnabled`フラグを追加
- npm/cargoは環境変数だけでは設定不可 → Entrypointをshell経由に変更

## 実装手順 (TDD)

1. テスト作成: `docker-adapter.test.ts` に以下を追加
   - `registryFirewallEnabled=true`時にpip/go環境変数が注入されること
   - `registryFirewallEnabled=true`時にnpm/cargo設定コマンドがEntrypointに含まれること
   - `registryFirewallEnabled=false`時にレジストリ設定が注入されないこと
   - `filterEnabled`と`registryFirewallEnabled`の両方が有効な場合の動作
   - shellMode時にレジストリ設定が注入されないこと
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: `buildContainerOptions`に条件分岐追加
   - 環境変数注入: PIP_INDEX_URL, PIP_TRUSTED_HOST, GOPROXY
   - Entrypointラッパー: npm config set, cargo config.toml作成
5. テスト通過を確認
6. 実装コミット

## 受入基準

- [x] `registryFirewallEnabled=true`時にPIP_INDEX_URL, GOPROXY等が注入される
- [x] npm config setコマンドがEntrypointに含まれる
- [x] cargo config.tomlの作成コマンドがEntrypointに含まれる
- [x] `registryFirewallEnabled=false`時に設定が注入されない
- [x] `filterEnabled`と共存(HTTP_PROXY + レジストリ設定の両方が設定される)
- [x] shellMode時はレジストリ設定を注入しない
- [x] テストが全て通過

**依存関係**: TASK-002(CreateSessionOptions型)
**推定工数**: 35分
**ステータス**: `DONE`
