# TASK-004: Registry Firewall API (health, blocks)

## 説明

registry-firewallのヘルスステータスとブロックログを取得するAPIエンドポイントを作成する。

**対象ファイル**:
- `src/app/api/registry-firewall/health/route.ts` - 新規作成
- `src/app/api/registry-firewall/blocks/route.ts` - 新規作成
- `src/app/api/registry-firewall/health/__tests__/route.test.ts` - 新規作成
- `src/app/api/registry-firewall/blocks/__tests__/route.test.ts` - 新規作成

**設計書**: `docs/sdd/design/registry-firewall/api/registry-firewall.md`

## 技術的文脈

- Next.js App Router のAPIルート
- `RegistryFirewallClient` を使用してregistry-firewallと通信
- 既存のAPIルート(`src/app/api/environments/`)と同様のパターン

## 実装手順 (TDD)

1. テスト作成: health/route.test.ts
   - GET: 正常レスポンス、registry-firewall停止時
2. テスト作成: blocks/route.test.ts
   - GET: 正常レスポンス(limitパラメータ)、registry-firewall停止時(空配列200)
3. テスト実行: 失敗を確認
4. テストコミット
5. 実装: health/route.ts - `getRegistryFirewallClient().getHealth()` を呼び出し
6. 実装: blocks/route.ts - `getRegistryFirewallClient().getBlocks()` を呼び出し
7. テスト通過を確認
8. 実装コミット

## 受入基準

- [x] GET /api/registry-firewall/health が正常にレスポンスを返す
- [x] GET /api/registry-firewall/blocks がブロックログを返す
- [x] blocks APIに `limit` クエリパラメータが対応
- [x] registry-firewall停止時に適切なエラーレスポンスを返す
- [x] テストが全て通過

**依存関係**: TASK-003
**推定工数**: 25分
**ステータス**: `DONE`
