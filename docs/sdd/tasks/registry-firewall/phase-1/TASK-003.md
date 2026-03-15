# TASK-003: Registry Firewall Client

## 説明

registry-firewallのAPIと通信するクライアントモジュールを作成する。

**対象ファイル**:
- `src/services/registry-firewall-client.ts` - 新規作成
- `src/services/__tests__/registry-firewall-client.test.ts` - 新規作成

**設計書**: `docs/sdd/design/registry-firewall/components/registry-firewall-client.md`

## 技術的文脈

- 既存の`src/services/proxy-client.ts`と同様のパターン(シングルトン、fetch API)
- タイムアウト2秒(NFR-AVA-002)
- 環境変数: `REGISTRY_FIREWALL_URL`, `REGISTRY_FIREWALL_API_TOKEN`

## 実装手順 (TDD)

1. テスト作成: `registry-firewall-client.test.ts`
   - `getHealth()`: 正常レスポンス、タイムアウト時に`stopped`返却、接続エラー時に`stopped`返却
   - `getBlocks()`: 正常レスポンス、エラー時の処理
   - 認証ヘッダーの付与テスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: `registry-firewall-client.ts`
   - `RegistryFirewallClient` クラス
   - `getHealth()`, `getBlocks()`, `proxyRequest()` メソッド
   - シングルトン `getRegistryFirewallClient()`
5. テスト通過を確認
6. 実装コミット

## 受入基準

- [ ] `RegistryFirewallClient` クラスが存在
- [ ] `getHealth()` が正常時に `{ status: 'healthy', registries: [...] }` を返す
- [ ] `getHealth()` がタイムアウト/接続エラー時に `{ status: 'stopped' }` を返す
- [ ] `getBlocks(limit)` がブロックログを返す
- [ ] APIトークンが設定されている場合、Authorizationヘッダーが付与される
- [ ] シングルトンパターンで提供される
- [ ] テストが全て通過

**依存関係**: なし
**推定工数**: 30分
**ステータス**: `TODO`
