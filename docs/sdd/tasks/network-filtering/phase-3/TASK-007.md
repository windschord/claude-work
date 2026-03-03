# TASK-007: REST APIエンドポイント（ルールCRUD）

## 説明

ネットワークフィルタリングルールのCRUD操作を提供するREST APIエンドポイントを実装する。

- **対象ファイル**:
  - `src/app/api/environments/[id]/network-rules/route.ts` （新規作成）
  - `src/app/api/environments/[id]/network-rules/[ruleId]/route.ts` （新規作成）
  - `src/app/api/environments/[id]/network-rules/__tests__/route.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/api/network-rules.md`

## 技術的文脈

- Next.js App Router API Routes
- 既存パターン参照: `src/app/api/environments/[id]/route.ts`
- NetworkFilterService（TASK-003で作成）を使用
- エラーレスポンス形式: `{ error: "message" }`

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | エンドポイント、リクエスト/レスポンス形式（API設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/app/api/environments/[id]/network-rules/__tests__/route.test.ts`

```typescript
// NetworkFilterServiceをモックしてテスト
// テストケース:
// GET /api/environments/[id]/network-rules
// 1. 正常: ルール一覧を返す（200）
// 2. 異常: 環境が存在しない場合404を返す
//
// POST /api/environments/[id]/network-rules
// 3. 正常: ルールを作成して201を返す
// 4. 異常: 不正なtarget形式で400を返す
// 5. 異常: リクエストボディが空で400を返す
//
// PUT /api/environments/[id]/network-rules/[ruleId]
// 6. 正常: ルールを更新して200を返す
// 7. 異常: ルールが存在しない場合404を返す
//
// DELETE /api/environments/[id]/network-rules/[ruleId]
// 8. 正常: ルールを削除して204を返す
// 9. 異常: ルールが存在しない場合404を返す
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

**`network-rules/route.ts`**:
- `GET`: `networkFilterService.getRules(id)` → 200
- `POST`: バリデーション → `networkFilterService.createRule(id, body)` → 201

**`network-rules/[ruleId]/route.ts`**:
- `PUT`: バリデーション → `networkFilterService.updateRule(ruleId, body)` → 200
- `DELETE`: `networkFilterService.deleteRule(ruleId)` → 204

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] GET /api/environments/[id]/network-rules が実装されている
- [ ] POST /api/environments/[id]/network-rules が実装されている
- [ ] PUT /api/environments/[id]/network-rules/[ruleId] が実装されている
- [ ] DELETE /api/environments/[id]/network-rules/[ruleId] が実装されている
- [ ] 適切なHTTPステータスコードが返される
- [ ] バリデーションエラーが正しく処理される
- [ ] テストが9件以上あり、全て通過する

## 依存関係
TASK-003（NetworkFilterService CRUD）

## 推定工数
40分

## ステータス
`IN_PROGRESS`
