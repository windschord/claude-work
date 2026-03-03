# TASK-003: NetworkFilterServiceのルールCRUD実装

## 説明

ネットワークフィルタリングルールのCRUD操作とバリデーションを実装する。DNS解決やフィルタリング適用は後続タスクで実装。

- **対象ファイル**:
  - `src/services/network-filter-service.ts` （新規作成）
  - `src/services/__tests__/network-filter-service.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/network-filter-service.md`

## 技術的文脈

- Drizzle ORM使用（`src/lib/db.ts`）
- スキーマ: TASK-001で作成した `networkFilterConfigs`, `networkFilterRules`
- バリデーション: ドメイン名/IPアドレス/ワイルドカード/CIDR形式の検証
- 既存パターン参照: `src/services/environment-service.ts`

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | CRUD操作、バリデーションルール、デフォルトテンプレート内容（設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/services/__tests__/network-filter-service.test.ts`

```typescript
// Drizzle ORMをモックしてテスト
// テストケース（CRUD）:
// 1. getRules: 指定環境のルール一覧を取得できる
// 2. getRules: 存在しない環境IDで空配列を返す
// 3. createRule: 有効なドメイン名でルールを作成できる
// 4. createRule: 有効なIPアドレスでルールを作成できる
// 5. createRule: ワイルドカード（*.example.com）でルールを作成できる
// 6. createRule: CIDR形式でルールを作成できる
// 7. createRule: ポート省略時にnullが設定される
// 8. createRule: 不正な形式でValidationErrorがスローされる
// 9. updateRule: ルールを更新できる
// 10. deleteRule: ルールを削除できる
//
// テストケース（FilterConfig）:
// 11. getFilterConfig: 環境のフィルタリング設定を取得（未設定時はdisabled）
// 12. updateFilterConfig: フィルタリングの有効/無効を切り替え
//
// テストケース（バリデーション）:
// 13. validateTarget: 有効なドメイン名を受け付ける
// 14. validateTarget: 有効なIPv4アドレスを受け付ける
// 15. validateTarget: 有効なIPv6アドレスを受け付ける
// 16. validateTarget: *.サブドメイン形式を受け付ける
// 17. validateTarget: CIDR形式を受け付ける
// 18. validateTarget: 空文字列を拒否する
// 19. validateTarget: 不正なドメイン名を拒否する
// 20. validatePort: 1-65535の範囲を受け付ける
// 21. validatePort: 範囲外のポートを拒否する
//
// テストケース（テンプレート）:
// 22. getDefaultTemplates: デフォルトテンプレートを返す
// 23. applyTemplates: テンプレートからルールを一括追加できる
// 24. applyTemplates: 重複ルールをスキップする
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装: `src/services/network-filter-service.ts`

このタスクで実装するメソッド:
- `getRules(environmentId)`
- `createRule(environmentId, input)`
- `updateRule(ruleId, input)`
- `deleteRule(ruleId)`
- `getFilterConfig(environmentId)`
- `updateFilterConfig(environmentId, enabled)`
- `getDefaultTemplates()`
- `applyTemplates(environmentId, ruleInputs)`
- `private validateTarget(target: string): boolean`
- `private validatePort(port: number | null): boolean`

後続タスクで追加するメソッド（スタブのみ作成）:
- `resolveDomains()` → TASK-004
- `applyFilter()` → TASK-005
- `removeFilter()` → TASK-005
- `testConnection()` → TASK-004
- `cleanupOrphanedRules()` → TASK-012

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] `src/services/network-filter-service.ts` が作成されている
- [ ] ルールのCRUD操作が全て実装されている
- [ ] ターゲットのバリデーション（ドメイン名、IP、ワイルドカード、CIDR）が実装されている
- [ ] ポートのバリデーション（1-65535、null許容）が実装されている
- [ ] フィルタリング設定の有効/無効切り替えが実装されている
- [ ] デフォルトテンプレートが定義されている
- [ ] テンプレート一括適用（重複スキップ）が実装されている
- [ ] テストが20件以上あり、全て通過する

## 依存関係
TASK-001（DBスキーマ）

## 推定工数
40分

## 完了サマリー
NetworkFilterServiceのルールCRUD、バリデーション、テンプレート機能を実装。
26件のテストが全て通過。後続タスク用スタブ（resolveDomains, applyFilter等）も作成済み。

## ステータス
`DONE`
