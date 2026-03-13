# TASK-001: NetworkFilterService applyFilter処理順序修正

## 対応

- Issue #207
- US-002/REQ-001, REQ-002
- 設計: `docs/sdd/design/docker-session-fixes/components/network-filter-service.md`

## 説明

`NetworkFilterService.applyFilter()` の処理順序を変更し、ルール取得をiptablesチェック前に移動する。有効ルール0件なら早期リターンする。

## 対象ファイル

- 実装: `src/services/network-filter-service.ts`
- テスト: `src/services/__tests__/network-filter-service-apply.test.ts`

## 技術的文脈

- フレームワーク: Node.js + TypeScript
- テスト: Vitest
- 参照: 設計書の修正後コード例

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 処理順序変更（ルール取得→iptablesチェック）、ルール0件で早期リターン |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

`src/services/__tests__/network-filter-service-apply.test.ts` に以下のテストケースを追加:

```typescript
describe('applyFilter - ルール0件のケース', () => {
  it('enabled=true かつルール0件の場合、iptablesチェックなしで正常終了する', async () => {
    // getFilterConfig -> { enabled: true }
    // getRules -> []
    // checkAvailability が呼ばれないことを検証
  });

  it('enabled=true かつルール1件以上の場合、iptablesチェックが実行される', async () => {
    // getFilterConfig -> { enabled: true }
    // getRules -> [有効なルール]
    // checkAvailability が呼ばれることを検証
  });
});
```

### 2. テスト実行 → 失敗確認

```bash
npx vitest run src/services/__tests__/network-filter-service-apply.test.ts
```

### 3. テストコミット

### 4. 実装

`src/services/network-filter-service.ts` の `applyFilter()` メソッドを修正:

1. `config` チェック後、iptablesチェック前にルール取得を移動（既存の670-671行相当）
2. `enabledRules.length === 0` なら `logger.info()` + `return`
3. その後にiptablesチェックを実行

### 5. テスト通過確認 → 実装コミット

## 受入基準

- [x] `enabled: true` かつルール0件 → エラーなしで正常終了
- [x] `enabled: true` かつルール1件以上 → iptablesチェック実行
- [x] `enabled: false` → 従来通りスキップ
- [x] ルール0件で「有効なフィルタルールが0件のためスキップ」ログ出力
- [x] 既存テストがすべて通過
- [x] 新規テストが通過

## 依存関係

なし

## 推定工数

30分

## ステータス

`DONE`
