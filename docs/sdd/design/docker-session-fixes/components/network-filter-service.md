# NetworkFilterService applyFilter処理順序の修正

## 対応要件

- US-002/REQ-001: ルール0件時のiptablesチェックスキップ
- US-002/REQ-002: ルール1件以上時は従来通り
- NFR-002: ルールなしでセッション起動を妨げない

## 現状のコード

```typescript
// src/services/network-filter-service.ts:648-695
async applyFilter(environmentId: string, containerSubnet: string): Promise<void> {
  const config = await this.getFilterConfig(environmentId);
  if (!config || !config.enabled) {
    return;  // 無効ならスキップ
  }

  // iptables利用可否チェック（ルール0件でも実行される）
  const available = await this.iptablesManager.checkAvailability();
  if (!available) {
    throw new FilterApplicationError(...);
  }

  // ルール取得（iptablesチェック後）
  const allRules = await this.getRules(environmentId);
  const enabledRules = allRules.filter((r) => r.enabled);
  // ...
}
```

## 修正設計

処理順序を変更し、ルール取得をiptablesチェックの前に移動する。

```typescript
async applyFilter(environmentId: string, containerSubnet: string): Promise<void> {
  // 1. フィルタリング設定を確認（変更なし）
  const config = await this.getFilterConfig(environmentId);
  if (!config || !config.enabled) {
    logger.debug('フィルタリングが無効のためスキップ', { environmentId });
    return;
  }

  // 2. ルール取得（iptablesチェックの前に移動）
  const allRules = await this.getRules(environmentId);
  const enabledRules = allRules.filter((r) => r.enabled);

  // 3. 有効ルール0件なら早期リターン
  if (enabledRules.length === 0) {
    logger.info('有効なフィルタルールが0件のためスキップ', { environmentId });
    return;
  }

  logger.info('フィルタリングの適用を開始します', {
    environmentId,
    containerSubnet,
    ruleCount: enabledRules.length,
  });

  // 4. iptables利用可否チェック（ルール1件以上の場合のみ）
  const available = await this.iptablesManager.checkAvailability();
  if (!available) {
    const errorMessage = `iptablesが利用不可のためフィルタリングを適用できません: environmentId=${environmentId}`;
    logger.error('フィルタリング適用に失敗しました（iptables利用不可）', { environmentId });
    throw new FilterApplicationError(errorMessage);
  }

  try {
    // 5. DNS解決
    const resolvedRules = await this.resolveDomains(enabledRules);

    // 6. iptables適用
    await this.iptablesManager.setupFilterChain(environmentId, resolvedRules, containerSubnet);

    logger.info('フィルタリングの適用が完了しました', {
      environmentId,
      ruleCount: enabledRules.length,
      resolvedCount: resolvedRules.length,
    });
  } catch (err) {
    if (err instanceof FilterApplicationError) {
      throw err;
    }
    const errorMessage = `フィルタリング適用中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`;
    logger.error('フィルタリング適用に失敗しました', {
      environmentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new FilterApplicationError(errorMessage);
  }
}
```

## 変更点サマリ

| 変更 | 内容 |
|------|------|
| ルール取得の移動 | iptablesチェック前に移動（671行 → 658行相当） |
| 早期リターン追加 | 有効ルール0件なら `return` |
| ログ追加 | 「有効なフィルタルールが0件のためスキップ」 |
| iptablesチェック位置 | ルール1件以上の場合のみ実行 |

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/services/network-filter-service.ts` | `applyFilter()` メソッドの処理順序変更 |

## テスト方針

- `enabled: true` / ルール0件 → 正常終了、iptablesチェック未実行を検証
- `enabled: true` / ルール1件以上 → iptablesチェック実行を検証
- `enabled: false` → 従来通りスキップを検証
