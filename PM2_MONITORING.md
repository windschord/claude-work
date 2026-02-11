# pm2 セキュリティ脆弱性 監視体制

## 概要

pm2 パッケージに正規表現 DoS 脆弱性（CVE-2025-xxxx）が発見されましたが、現時点で修正版はリリースされていません。

**CVSS Score**: 2.1 (Low)
**影響**: 限定的（開発環境のみで使用）

## 監視対象

以下のリソースを定期的にチェックし、修正版がリリースされたら速やかに対応します。

### 1. GitHub Advisory
- **URL**: https://github.com/advisories/GHSA-x5gf-qvw8-r2rm
- **確認内容**: 修正版のバージョン番号、リリース日

### 2. pm2 公式リポジトリ
- **URL**: https://github.com/Unitech/pm2/releases
- **確認内容**: 新しいリリースの有無、セキュリティ修正の記載

### 3. npm パッケージページ
- **URL**: https://www.npmjs.com/package/pm2
- **確認内容**: 最新バージョン、変更履歴

## アップデート手順

修正版（例: pm2@6.0.15 以降）がリリースされた際の対応手順:

```bash
# 1. 現在のバージョンを確認
npm ls pm2

# 2. pm2 を最新版にアップデート
npm update pm2

# 3. ユニットテストを実行
npm test

# 4. pm2 機能の動作確認
npm run dev:pm2
npm run pm2:status
npm run dev:stop

npm run prod:start
npm run pm2:status
npm run prod:stop

# 5. CLI コマンドの動作確認
npx claude-work help
npx claude-work status
npx claude-work start
npx claude-work stop

# 6. セキュリティ監査で修正を確認
npm audit

# 7. 変更をコミット
git add package.json package-lock.json
git commit -m "fix: pm2 のセキュリティ脆弱性を修正

- pm2 を 6.0.15 にアップデート（正規表現 DoS 修正）
- Dependabot アラート #XX をクローズ

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## リスク評価

- **低リスク**: CVSS Score 2.1 (Low)
- **限定的影響**: pm2 は開発・本番環境のプロセス管理にのみ使用
- **現状の対応**: 監視継続、修正版リリース後に速やかにアップデート

## 確認履歴

- 2026-02-11: 初回作成、監視体制を整備
