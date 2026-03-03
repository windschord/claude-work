# TASK-005: フィルタリング適用・クリーンアップの実装

## 説明

NetworkFilterServiceにフィルタリング適用（applyFilter）とクリーンアップ（removeFilter）のオーケストレーションロジックを追加する。IptablesManagerと連携してiptablesルールを管理する。

- **対象ファイル**:
  - `src/services/network-filter-service.ts` （既存に追加）
  - `src/services/__tests__/network-filter-service-apply.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/network-filter-service.md`（applyFilter, removeFilter）

## 技術的文脈

- IptablesManager（TASK-002で作成）を使用
- resolveDomains（TASK-004で作成）を使用
- フェイルセーフ: iptables適用失敗時はエラーをスローしコンテナ起動を中止
- Winstonロガーでフィルタリング操作をログ記録

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | フェイルセーフ動作、iptables適用フロー（設計書・NFR-SEC-003に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/services/__tests__/network-filter-service-apply.test.ts`

```typescript
// IptablesManagerとDBをモックしてテスト
// テストケース（applyFilter）:
// 1. フィルタリング有効時: ルール取得→DNS解決→iptables適用の順序で実行される
// 2. フィルタリング無効時: 何も実行されない
// 3. iptables適用失敗時: FilterApplicationErrorがスローされる（フェイルセーフ）
// 4. DNS解決で一部失敗: 警告ログ出力、解決成功分のみ適用
// 5. ルールが0件の場合: DNS許可とデフォルトDROPのみ適用
// 6. iptablesが利用不可の場合: FilterApplicationErrorがスローされる
//
// テストケース（removeFilter）:
// 7. フィルタチェインが正しく削除される
// 8. チェインが存在しない場合もエラーにならない（冪等）
// 9. 削除時にINFOレベルのログが出力される
//
// テストケース（ログ）:
// 10. applyFilter成功時にINFOログが出力される
// 11. applyFilter失敗時にERRORログが出力される
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

`src/services/network-filter-service.ts` に追加するメソッド:

```typescript
// フィルタリング適用
async applyFilter(environmentId: string, containerSubnet: string): Promise<void>

// フィルタリングクリーンアップ
async removeFilter(environmentId: string): Promise<void>
```

処理フロー（applyFilter）:
1. `getFilterConfig(environmentId)` でフィルタリング設定を確認
2. 無効なら即座にreturn
3. `iptablesManager.checkAvailability()` で利用可否チェック
4. `getRules(environmentId)` でルール取得
5. `resolveDomains(rules)` でDNS解決
6. `iptablesManager.setupFilterChain(envId, resolvedRules, subnet)` でiptables適用
7. 失敗時は `FilterApplicationError` をスロー

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] `applyFilter` メソッドが実装されている
- [ ] `removeFilter` メソッドが実装されている
- [ ] フィルタリング無効時はスキップされる
- [ ] iptables利用不可時にエラーがスローされる（フェイルセーフ）
- [ ] iptables適用失敗時にエラーがスローされる（フェイルセーフ）
- [ ] 適用・クリーンアップ時にログが出力される
- [ ] テストが11件以上あり、全て通過する

## 依存関係
TASK-002（IptablesManager）、TASK-004（DNS解決）

## 推定工数
40分

## ステータス
`IN_PROGRESS`
