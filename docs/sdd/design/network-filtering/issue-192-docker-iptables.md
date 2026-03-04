# 設計書: Issue #192 - Dockerイメージへのiptablesパッケージ追加

## 問題の特定

DockerfileのStage 5（runner）はnode:20-slimをベースとしており、iptablesがデフォルトで含まれていない。
docker-compose.ymlには `cap_add: [NET_ADMIN]` が設定済みだが、iptablesバイナリが存在しないため
ネットワークフィルタリング機能が動作しない。

## 修正方針

Dockerfileのrunnerステージ（Stage 5）のapt-getインストールコマンドに `iptables` を追加する。

### 変更箇所

**ファイル**: `Dockerfile`（runnerステージの `apt-get install` セクション）

```dockerfile
# 変更前
&& apt-get install -y --no-install-recommends docker-ce-cli \

# 変更後
&& apt-get install -y --no-install-recommends docker-ce-cli iptables \
```

## 影響範囲

- Dockerイメージサイズの微増（iptablesパッケージ分）
- 既存機能への影響なし
- docker-compose.yml への変更不要
