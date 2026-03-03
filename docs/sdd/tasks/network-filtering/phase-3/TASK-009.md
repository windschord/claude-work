# TASK-009: Docker Compose環境対応・docker-compose.yml更新

## 説明

ClaudeWorkがDocker Compose環境で動作する場合のネットワークフィルタリング対応を実装する。docker-compose.ymlへの`NET_ADMIN` capability追加と、Docker Compose環境検出ロジックを追加する。

- **対象ファイル**:
  - `docker-compose.yml` （既存に変更）
  - `src/services/network-filter-service.ts` （環境検出ロジック追加）
  - `src/services/__tests__/network-filter-service-compose.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/decisions/DEC-001.md`
- **要件参照**: `docs/sdd/requirements/network-filtering/stories/US-005.md`

## 技術的文脈

- ClaudeWorkコンテナからiptablesを実行するには`NET_ADMIN` capabilityが必要
- Docker Compose環境の検出: 環境変数 `COMPOSE_PROJECT` またはDockerソケット経由
- サンドボックスコンテナのみフィルタリング対象（メインアプリは対象外）
- フィルタリング用ネットワーク名: `claudework-filter-<id>` プレフィックスで既存ネットワークとの衝突回避

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | NET_ADMIN必要性、ネットワーク命名規則、メインアプリ除外（設計書・要件に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/services/__tests__/network-filter-service-compose.test.ts`

```typescript
// テストケース:
// 1. Docker Compose環境検出: COMPOSE_PROJECT環境変数が設定されている場合true
// 2. Docker Compose環境検出: 環境変数がない場合false
// 3. Docker Compose環境でのフィルタリング: サンドボックスコンテナにのみ適用される
// 4. フィルタリング用ネットワーク名がclaudework-filter-プレフィックスを持つ
// 5. Compose環境検出失敗時: スタンドアロンDockerと同じ方式にフォールバック
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

**`docker-compose.yml` 変更**:
```yaml
services:
  app:
    # 既存設定...
    cap_add:
      - NET_ADMIN  # ネットワークフィルタリングのiptables操作に必要
```

**`src/services/network-filter-service.ts` 追加**:
```typescript
// Docker Compose環境検出
isDockerComposeEnvironment(): boolean {
  return !!process.env.COMPOSE_PROJECT;
}

// フィルタリング用ネットワーク名生成
getFilterNetworkName(environmentId: string): string {
  return `claudework-filter-${environmentId.slice(0, 8)}`;
}
```

**ENV_VARS.md更新**: `NET_ADMIN` capabilityの説明を追加

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] `docker-compose.yml` に `cap_add: [NET_ADMIN]` が追加されている
- [ ] Docker Compose環境検出ロジックが実装されている
- [ ] フィルタリング用ネットワーク名が `claudework-filter-` プレフィックスを持つ
- [ ] Compose環境検出失敗時のフォールバックが実装されている
- [ ] `docs/ENV_VARS.md` にNET_ADMIN capabilityの説明が追記されている
- [ ] テストが5件以上あり、全て通過する

## 依存関係
TASK-006（DockerAdapter統合）

## 推定工数
30分

## 完了サマリー

Docker Compose環境検出（isDockerComposeEnvironment）とフィルタリング用ネットワーク名生成（getFilterNetworkName）をNetworkFilterServiceに追加。docker-compose.ymlにNET_ADMIN capabilityを追加し、ENV_VARS.mdにドキュメントを追記した。TDDで実装し、9件のテスト全て通過。

## ステータス
`DONE`
