# TASK-006: Next.js rewrites + UI

## 説明

Next.jsのrewrites設定でregistry-firewall管理UIへのプロキシを追加し、環境設定ページにパッケージセキュリティセクションを追加する。

**対象ファイル**:
- `next.config.ts` - rewrites追加
- `src/components/environments/RegistryFirewallStatus.tsx` - 新規作成
- `src/app/settings/environments/page.tsx` - セクション追加
- `src/hooks/useRegistryFirewall.ts` - 新規作成

**設計書**:
- `docs/sdd/design/registry-firewall/api/registry-firewall.md` (rewrites部分)
- `docs/sdd/requirements/registry-firewall/stories/US-003.md` (UI要件)

## 技術的文脈

- Next.js App RouterのrewritesでUIプロキシ
- 既存の環境設定ページ(`/settings/environments`)にセクション追加
- Zustand不要 - カスタムhookでfetch管理

## 実装手順

1. `next.config.ts` にrewrite設定を追加
   - `/api/registry-firewall/ui/:path*` -> registry-firewallの `/ui/:path*`
2. `src/hooks/useRegistryFirewall.ts` を作成
   - `useRegistryFirewall()`: health/blocks/config の取得・更新
3. `src/components/environments/RegistryFirewallStatus.tsx` を作成
   - ステータス表示(正常/異常/停止中)
   - 有効/無効トグル
   - 対応レジストリ一覧
   - 管理画面リンク
   - 最近のブロックログ(最新5件)
4. `src/app/settings/environments/page.tsx` にコンポーネントを配置

## 受入基準

- [ ] `/api/registry-firewall/ui/` がregistry-firewallの管理UIにプロキシされる
- [ ] 環境設定ページに「パッケージセキュリティ」セクションが表示される
- [ ] ステータスが3色(green/red/gray)で表示される
- [ ] トグルスイッチで有効/無効を切り替えられる
- [ ] 「管理画面を開く」リンクが機能する
- [ ] ブロックログが表示される

**依存関係**: TASK-002, TASK-004
**推定工数**: 35分
**ステータス**: `DONE`

## 完了サマリー

Next.js rewrites設定追加と環境設定ページへのパッケージセキュリティUIを実装。

- `next.config.js`: `/api/registry-firewall/ui/:path*` -> registry-firewallの `/ui/:path*` へのrewrites追加
- `src/hooks/useRegistryFirewall.ts`: health/blocks/enabled状態管理フック新規作成
- `src/components/environments/RegistryFirewallStatus.tsx`: ステータス表示・トグル・ブロックログUIコンポーネント新規作成
- `src/app/settings/environments/page.tsx`: RegistryFirewallStatusコンポーネントをEnvironmentListの前に配置
