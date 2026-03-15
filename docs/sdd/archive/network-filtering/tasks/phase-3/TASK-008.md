# TASK-008: REST APIエンドポイント（設定・テンプレート・テスト）

## 説明

フィルタリング設定の取得・更新、デフォルトテンプレートの取得・適用、通信テスト（dry-run）のAPIエンドポイントを実装する。

- **対象ファイル**:
  - `src/app/api/environments/[id]/network-filter/route.ts` （新規作成）
  - `src/app/api/environments/[id]/network-filter/test/route.ts` （新規作成）
  - `src/app/api/environments/[id]/network-rules/templates/route.ts` （新規作成）
  - `src/app/api/environments/[id]/network-rules/templates/apply/route.ts` （新規作成）
  - `src/app/api/environments/[id]/network-filter/__tests__/route.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/api/network-rules.md`

## 技術的文脈

- Next.js App Router API Routes
- NetworkFilterService（TASK-003, TASK-004で作成）を使用
- テンプレートデータはNetworkFilterService内のハードコード定数

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | エンドポイント、リクエスト/レスポンス形式（API設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/app/api/environments/[id]/network-filter/__tests__/route.test.ts`

```typescript
// NetworkFilterServiceをモックしてテスト
// テストケース:
// GET /api/environments/[id]/network-filter
// 1. 正常: フィルタリング設定を返す（200）
// 2. 正常: 未設定時はデフォルト（disabled）を返す
//
// PUT /api/environments/[id]/network-filter
// 3. 正常: フィルタリングを有効にして200を返す
// 4. 正常: フィルタリングを無効にして200を返す
// 5. 異常: enabledフィールドがない場合400を返す
//
// POST /api/environments/[id]/network-filter/test
// 6. 正常: 許可される宛先でallowed: trueを返す
// 7. 正常: ブロックされる宛先でallowed: falseを返す
// 8. 異常: targetが未指定の場合400を返す
//
// GET /api/environments/[id]/network-rules/templates
// 9. 正常: デフォルトテンプレート一覧を返す（200）
//
// POST /api/environments/[id]/network-rules/templates/apply
// 10. 正常: テンプレートルールを一括追加して201を返す
// 11. 正常: 重複ルールをスキップしてskipped数を返す
// 12. 異常: rulesが空配列の場合400を返す
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

**`network-filter/route.ts`**:
- `GET`: `networkFilterService.getFilterConfig(id)` → 200
- `PUT`: `networkFilterService.updateFilterConfig(id, body.enabled)` → 200

**`network-filter/test/route.ts`**:
- `POST`: `networkFilterService.testConnection(id, body.target, body.port)` → 200

**`network-rules/templates/route.ts`**:
- `GET`: `networkFilterService.getDefaultTemplates()` → 200

**`network-rules/templates/apply/route.ts`**:
- `POST`: `networkFilterService.applyTemplates(id, body.rules)` → 201

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [x] フィルタリング設定のGET/PUTが実装されている
- [x] 通信テスト（dry-run）のPOSTが実装されている
- [x] テンプレート取得のGETが実装されている
- [x] テンプレート適用のPOSTが実装されている
- [x] 適切なHTTPステータスコードが返される
- [x] テストが12件以上あり、全て通過する

## 依存関係
TASK-004（DNS解決・テスト機能）

## 推定工数
40分

## ステータス
`DONE`

## 完了サマリー
TDD手順に従い、12件のテストを先に作成してから実装。
- `network-filter/route.ts`: GET（設定取得、未設定時デフォルト）/ PUT（有効/無効切替）
- `network-filter/test/route.ts`: POST（dry-run通信テスト）
- `network-rules/templates/route.ts`: GET（テンプレート一覧）
- `network-rules/templates/apply/route.ts`: POST（テンプレート一括適用）
全12件テスト通過。
