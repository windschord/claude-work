# TASK-018: 通信テスト機能のproxy稼働状態確認統合

## 説明

現在のdry-run（文字列マッチング）ベースの通信テストに、proxy稼働状態確認（healthCheck）を組み合わせる。proxyが稼働中の場合はdry-run結果にproxyStatus: 'running'を付与し、稼働していない場合はproxyStatus: 'not_running'としてフォールバックする。実際のproxy経由通信テストは行わず、ルールマッチング結果 + proxy稼働状態を返す。

- **対象ファイルパス**:
  - 実装: `src/services/network-filter-service.ts`（testConnectionメソッド修正）
  - 実装: `src/app/api/environments/[id]/network-filter/test/route.ts`（修正）
  - テスト: `src/services/__tests__/network-filter-service.test.ts`（修正）
  - テスト: `src/app/api/environments/[id]/network-filter/__tests__/route.test.ts`（修正）
- **参照設計**: `docs/sdd/design/network-filtering/index.md`

## 技術的文脈

- NetworkFilterService.testConnection: 現在は文字列ベースのマッチング
- ProxyClient: proxy経由のテスト通信が可能
- proxyが稼働していない場合（開発環境等）はフォールバック必要

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | proxy稼働状態確認付きdry-runテストに変更する方針は確定 |
| 不明/要確認の情報 | なし |

## 実装内容

### testConnectionの変更

```typescript
async testConnection(environmentId: string, target: string, port?: number): Promise<TestResult> {
  // フィルタリング設定を確認
  const config = await this.getFilterConfig(environmentId);
  if (!config || !config.enabled) {
    return { allowed: true, note: 'フィルタリングが無効のため全て許可されます' };
  }

  // proxy経由のテストを試行
  try {
    const proxyClient = new ProxyClient();
    await proxyClient.healthCheck();

    // proxy稼働確認成功: dry-run（ルールマッチング）結果を返しつつ、
    //   proxyの稼働状態をnoteとproxyStatusに含める
    // ※実際のproxy経由通信テストは行わない（dry-run + healthCheckの組み合わせ）
    const dryRunResult = this.dryRunTest(environmentId, target, port);
    return {
      ...dryRunResult,
      note: 'proxy稼働中。ルールマッチング結果です。実際のproxy通信制御はコンテナ起動時に適用されます。',
    };
  } catch {
    // proxyに接続できない場合はdry-runにフォールバック
    const dryRunResult = await this.dryRunTest(environmentId, target, port);
    return {
      ...dryRunResult,
      note: 'proxy未稼働のためdry-run結果です。実際の通信制御はproxy起動後にコンテナで適用されます。',
    };
  }
}

// 既存のtestConnectionロジックをprivateメソッドに切り出し
private async dryRunTest(environmentId: string, target: string, port?: number): Promise<Omit<TestResult, 'note'>> {
  // 既存のマッチングロジック
}
```

### TestResult型の更新

```typescript
interface TestResult {
  allowed: boolean;
  matchedRule?: { ... };
  note: string;
  proxyStatus?: 'running' | 'not_running';  // 追加
}
```

## 実装手順（TDD）

1. テスト作成:
   - 正常系: proxy稼働時にproxyStatusが'running'を含む
   - 正常系: proxy未稼働時にフォールバックしてdry-run結果を返す
   - 正常系: フィルタリング無効時は全て許可（変更なし）
   - 正常系: dry-runのマッチングロジック（既存テスト流用）
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. テスト通過を確認
6. 実装コミット

## 受入基準

- [x] proxy稼働時はproxyStatus: 'running'が返される
- [x] proxy未稼働時はproxyStatus: 'not_running'でdry-run結果にフォールバック
- [x] 既存のdry-runマッチングロジックが保持されている
- [x] TestResult型にproxyStatusが追加されている
- [x] テストが4つ以上
- [x] 既存テストが壊れていない
- [x] ESLintエラーがゼロ

## 依存関係

- TASK-013（ProxyClient）
- TASK-014（DNS解決削除）

## 推定工数

30分

## 完了サマリー

TestResult型にproxyStatusを追加し、testConnectionメソッドにProxyClientのhealthCheckを組み込んだ。proxy稼働中/未稼働に応じてproxyStatusを設定し、既存のdry-runマッチングロジックはprivateメソッドに切り出した。34テスト全通過。

## ステータス

`DONE`
