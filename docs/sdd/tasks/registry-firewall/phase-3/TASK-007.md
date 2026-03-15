# TASK-007: ドキュメント更新

## 説明

ENV_VARS.mdとCLAUDE.mdにregistry-firewall関連の情報を追加する。

**対象ファイル**:
- `docs/ENV_VARS.md` - 環境変数追加
- `CLAUDE.md` - Feature Specificationセクション更新

## 実装手順

1. `docs/ENV_VARS.md` に以下の環境変数を追加:
   - `REGISTRY_FIREWALL_URL`
   - `REGISTRY_FIREWALL_API_TOKEN`
   - `REGISTRY_FIREWALL_LOG_LEVEL`
2. `CLAUDE.md` の Feature Specification Summary セクションを更新:
   - API Endpoints に `/api/registry-firewall/*` を追加
   - Environment Variables に registry-firewall関連を追加
   - Services に `registry-firewall-client.ts` を追加

## 受入基準

- [ ] `docs/ENV_VARS.md` にregistry-firewall関連の環境変数が記載されている
- [ ] `CLAUDE.md` のAPI Endpoints、Services、Environment Variablesが更新されている

**依存関係**: TASK-001~006
**推定工数**: 15分
**ステータス**: `TODO`
