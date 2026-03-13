# TASK-019: Docker環境作成時のデフォルトネットワークフィルタリング自動適用

## 概要

Docker環境(type=DOCKER)作成のPOSTハンドラに、Config Volume作成成功後にデフォルトネットワークフィルタリングルールを自動適用するロジックを追加する。

## 要件リンク

- US-006: Docker環境作成時のデフォルトルール自動適用
- REQ-009: Docker環境作成時のデフォルトルール自動適用

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| src/app/api/environments/route.ts | POSTハンドラにデフォルトルール自動適用ロジック追加 |
| src/app/api/environments/__tests__/route.test.ts | テスト5件追加 |

## 実装手順

### 1. テスト作成（TDD: Red）

route.test.ts に以下のテストを追加:

1. DOCKER環境作成時にフィルタリングが有効化されテンプレートが適用される
   - applyTemplates -> updateFilterConfig の呼び出し順序も検証
2. HOST環境作成時はフィルタリング初期化をスキップする
3. SSH環境作成時はフィルタリング初期化をスキップする
4. フィルタリング初期化失敗時もベストエフォートで201を返す（applyTemplates失敗）
5. テンプレート適用失敗時はupdateFilterConfigを呼ばない
6. テンプレート適用が0件の場合はフィルタリング有効化をスキップする

モック追加:
- networkFilterService.getDefaultTemplates
- networkFilterService.applyTemplates
- networkFilterService.updateFilterConfig

### 2. 実装（TDD: Green）

route.ts のPOSTハンドラ、Config Volume作成成功後（L351付近）に以下を追加:

```typescript
// デフォルトネットワークフィルタリングルールを自動適用（ベストエフォート）
try {
  const templates = networkFilterService.getDefaultTemplates();
  const allRules = templates.flatMap(t => t.rules);
  const applyResult = await networkFilterService.applyTemplates(environment.id, allRules);
  if (applyResult.created > 0) {
    await networkFilterService.updateFilterConfig(environment.id, true);
    logger.info('Default network filtering rules applied', { id: environment.id, createdCount: applyResult.created });
  } else {
    logger.warn('Skip enabling network filtering because no rules were applied', {
      environmentId: environment.id,
    });
  }
} catch (filterError) {
  logger.warn('Failed to initialize default network filtering', {
    environmentId: environment.id,
    error: filterError,
  });
}
```

### 3. テスト実行・確認

```bash
npx vitest run src/app/api/environments/__tests__/route.test.ts
```

## 受入基準

- [x] 全6テストがパスする
- [x] 既存テストが壊れない
- [x] Docker環境作成時にデフォルトルールが自動適用される
- [x] HOST/SSH環境では適用されない
- [x] フィルタ初期化失敗時も201を返す
- [x] テンプレート適用失敗時はフィルタリング有効化をスキップする

## 推定工数

20min

## 依存

なし（既存のnetworkFilterServiceメソッドを使用）

## ステータス

DONE
