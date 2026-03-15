# TASK-001: Docker Compose構成 + 設定ファイル

## 説明

docker-compose.ymlにregistry-firewallサービスを追加し、設定ファイルを作成する。

**対象ファイル**:
- `docker-compose.yml` - サービス追加
- `configs/registry-firewall.yaml` - 新規作成

**設計書**: `docs/sdd/design/registry-firewall/components/docker-compose.md`

## 技術的文脈

- 既存のnetwork-filter-proxyサービスと同様のパターン
- registry-firewallイメージ: `ghcr.io/windschord/registry-firewall:latest`
- claudework-filterネットワークに接続

## 実装手順

1. `configs/` ディレクトリが存在することを確認
2. `configs/registry-firewall.yaml` を作成（設計書のconfig.yaml参照）
3. `docker-compose.yml` に以下を追加:
   - `registry-firewall` サービス定義
   - `registry-firewall-data` ボリューム
   - `app` サービスの `depends_on` に `registry-firewall` 追加
   - `app` サービスの `environment` に `REGISTRY_FIREWALL_URL` と `REGISTRY_FIREWALL_API_TOKEN` 追加

## 受入基準

- [ ] `configs/registry-firewall.yaml` が存在し、5レジストリ(npm, pypi, go, cargo, docker)が設定されている
- [ ] `docker-compose.yml` に `registry-firewall` サービスが定義されている
- [ ] registry-firewallが `claudework-filter` と `default` の両ネットワークに接続
- [ ] ヘルスチェックが設定されている
- [ ] `app` サービスに `REGISTRY_FIREWALL_URL` 環境変数が追加されている
- [ ] `registry-firewall-data` ボリュームが追加されている

**依存関係**: なし
**推定工数**: 20分
**ステータス**: `TODO`
