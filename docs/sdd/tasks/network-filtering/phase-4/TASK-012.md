# TASK-012: 統合テスト・孤立ルールクリーンアップ

## 説明

アプリケーション起動時の孤立iptablesルールクリーンアップ機能の実装と、フィルタリング機能全体の統合テストを作成する。

- **対象ファイル**:
  - `src/services/network-filter-service.ts` （cleanupOrphanedRules実装）
  - `server.ts` （起動時クリーンアップ呼び出し追加）
  - `src/services/__tests__/network-filter-service-cleanup.test.ts` （新規作成）
  - `src/services/__tests__/network-filter-integration.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/network-filter-service.md`（cleanupOrphanedRules）

## 技術的文脈

- 既存パターン: `DockerAdapter.cleanupOrphanedContainers()` がserver.ts起動時に呼ばれる
- IptablesManager.cleanupOrphanedChains()を使用
- Winstonロガーでクリーンアップログを記録

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | クリーンアップ対象、起動時実行、ログ出力（設計書・NFR-SEC-004に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

**`src/services/__tests__/network-filter-service-cleanup.test.ts`**:
```typescript
// テストケース:
// 1. cleanupOrphanedRules: CWFILTER-プレフィックスの孤立チェインを削除する
// 2. cleanupOrphanedRules: 有効な環境のチェインは削除しない
// 3. cleanupOrphanedRules: IptablesManagerのcleanupOrphanedChainsを呼ぶ
// 4. cleanupOrphanedRules: クリーンアップ結果をINFOログに出力する
// 5. cleanupOrphanedRules: iptables利用不可時は警告ログのみ（エラーにしない）
```

**`src/services/__tests__/network-filter-integration.test.ts`**:
```typescript
// 統合テスト（モック使用）:
// 6. フルフロー: ルール作成→フィルタリング有効化→applyFilter→removeFilter→ルール削除
// 7. フェイルセーフ: iptables失敗時にコンテナ起動が中止される
// 8. フィルタリング無効時: 全フローが既存動作と同一
// 9. DNS解決→iptablesルール生成→適用の一貫したフロー
// 10. テンプレート適用→DNS解決→iptablesルール生成→適用のフロー
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

**`src/services/network-filter-service.ts`**:
```typescript
async cleanupOrphanedRules(): Promise<void> {
  // 1. iptables利用可否チェック（利用不可なら警告のみ）
  // 2. iptablesManager.cleanupOrphanedChains() 呼び出し
  // 3. 結果をログ出力
}
```

**`server.ts` 変更**:
- サーバー起動時のフックに `networkFilterService.cleanupOrphanedRules()` を追加
- 既存の `cleanupOrphanedContainers()` の直後に配置

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] `cleanupOrphanedRules` メソッドが実装されている
- [ ] `server.ts` の起動時にクリーンアップが呼ばれる
- [ ] 孤立チェイン（対応環境なし）が削除される
- [ ] 有効なチェインは削除されない
- [ ] iptables利用不可時に警告ログのみでエラーにならない
- [ ] 統合テストでフルフローが検証されている
- [ ] テストが10件以上あり、全て通過する
- [ ] 既存テストが全てパスする

## 依存関係
TASK-006（DockerAdapter統合）、TASK-009（Docker Compose対応）

## 推定工数
40分

## 完了サマリー

TDDで実装を完了。

- `cleanupOrphanedRules()` を実装: iptables可否チェック → `cleanupOrphanedChains()` 委譲 → 結果ログ
- `server.ts` にDocker孤立コンテナクリーンアップの直後にフィルタークリーンアップ呼び出しを追加
- テスト14件（cleanup: 5件、integration: 9件）全て通過

## ステータス
`DONE`
