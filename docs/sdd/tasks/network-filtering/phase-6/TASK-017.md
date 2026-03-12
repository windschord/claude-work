# TASK-017: ルール変更時のproxy同期（API層）

## 説明

ルールのCRUD操作（作成・更新・削除）およびテンプレート適用時に、アクティブなClaudeコンテナがある場合はproxyにルールを再同期する。また、フィルタリング設定の有効/無効切り替え時にも同期を行う。

- **対象ファイルパス**:
  - 実装: `src/app/api/environments/[id]/network-rules/route.ts`（修正）
  - 実装: `src/app/api/environments/[id]/network-rules/[ruleId]/route.ts`（修正）
  - 実装: `src/app/api/environments/[id]/network-rules/templates/apply/route.ts`（修正）
  - 実装: `src/app/api/environments/[id]/network-filter/route.ts`（修正）
  - テスト: `src/app/api/environments/[id]/network-rules/__tests__/route.test.ts`（修正）
  - テスト: `src/app/api/environments/[id]/network-filter/__tests__/route.test.ts`（修正）
- **参照設計**: `docs/sdd/design/network-filtering/index.md`（ルール変更時の同期フロー）

## 技術的文脈

- Next.js API Routes (App Router)
- ProxyClient: `src/services/proxy-client.ts`（TASK-013で作成）
- NetworkFilterService: `src/services/network-filter-service.ts`
- DockerAdapter: アクティブセッション情報からコンテナIPを取得

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 同期タイミング、同期方式（PUT /api/v1/rules/{sourceIP}で丸ごと置換）は確定 |
| 不明/要確認の情報 | なし |

## 実装内容

### 同期のトリガーポイント

1. **POST /network-rules**（ルール作成後）
2. **PUT /network-rules/[ruleId]**（ルール更新後）
3. **DELETE /network-rules/[ruleId]**（ルール削除後）
4. **POST /network-rules/templates/apply**（テンプレート適用後）
5. **PUT /network-filter**（フィルタリング有効/無効切り替え後）

### 同期ロジック（共通ヘルパー）

```typescript
// src/lib/proxy-sync.ts（新規作成）
export async function syncProxyRulesIfNeeded(environmentId: string): Promise<void> {
  const filterEnabled = await networkFilterService.isFilterEnabled(environmentId);
  if (!filterEnabled) return;

  // アクティブなDockerセッションからコンテナIPを取得
  // AdapterFactory経由でDockerAdapterのアクティブセッション情報を取得
  const adapter = adapterFactory.getAdapter(environmentId);
  if (!(adapter instanceof DockerAdapter)) return;

  const activeSessions = adapter.getActiveSessionsForEnvironment(environmentId);
  const proxyClient = new ProxyClient();

  for (const session of activeSessions) {
    if (session.containerIP) {
      try {
        await proxyClient.syncRules(session.containerIP, environmentId);
      } catch (error) {
        logger.warn('ルールの同期に失敗', { environmentId, containerIP: session.containerIP, error });
      }
    }
  }
}
```

### 各APIルートへの追加

各ルートの成功レスポンス返却直前に `syncProxyRulesIfNeeded(environmentId)` を呼び出す。同期の失敗はログ出力のみ（APIレスポンスには影響させない）。

## 実装手順（TDD）

1. テスト作成:
   - `syncProxyRulesIfNeeded`の単体テスト（新規ファイル `src/lib/__tests__/proxy-sync.test.ts`）
   - 正常系: フィルタリング有効+アクティブセッションありの場合、syncRulesが呼ばれる
   - 正常系: フィルタリング無効の場合、syncRulesが呼ばれない
   - 正常系: アクティブセッションなしの場合、syncRulesが呼ばれない
   - 異常系: 同期失敗時はログ出力のみでエラーを伝播しない
2. 既存APIテストに同期呼び出しの検証を追加
3. テスト実行: 失敗を確認
4. テストコミット
5. `src/lib/proxy-sync.ts` を実装
6. 各APIルートにsyncProxyRulesIfNeeded呼び出しを追加
7. テスト通過を確認
8. 実装コミット

## 受入基準

- [ ] `src/lib/proxy-sync.ts` が作成されている
- [ ] ルール作成・更新・削除・テンプレート適用・フィルタ切り替え後にproxy同期が行われる
- [ ] フィルタリング無効時は同期しない
- [ ] アクティブセッションがない場合は同期しない
- [ ] 同期失敗時はログ出力のみでAPIレスポンスに影響しない
- [ ] テストが4つ以上追加されている
- [ ] 既存テストが壊れていない
- [ ] ESLintエラーがゼロ

## 依存関係

- TASK-013（ProxyClient）
- TASK-016（DockerAdapter、getActiveSessionsForEnvironment）

## 推定工数

40分

## ステータス

`DONE`

## 完了サマリー

syncProxyRulesIfNeeded共通ヘルパーを実装。DockerAdapterにgetActiveContainerIPs()、AdapterFactoryにgetDockerAdapterForEnvironment()を追加し、5つのAPIルート（POST/PUT/DELETE network-rules、templates/apply、PUT network-filter）で同期呼び出しを追加。TDD: テスト6つ追加、network関連117テスト全通過。
