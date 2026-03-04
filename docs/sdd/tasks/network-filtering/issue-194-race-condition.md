# Issue #194: ネットワークフィルタリング レースコンディション修正 - タスク

## タスク概要

| 項目 | 内容 |
|------|------|
| タスクID | TASK-194 |
| タイトル | NetworkFilterServiceのapplyFilter/removeFilterをmutex化して直列化 |
| 優先度 | 高 |
| ステータス | DONE |
| ブランチ | fix/issue-194-network-filter-race-condition |

## 関連ドキュメント

- 要件: `docs/sdd/requirements/network-filtering/issue-194-race-condition.md`
- 設計: `docs/sdd/design/network-filtering/issue-194-race-condition.md`

## タスクリスト

### Phase 1: TDD（テスト先行）

- [x] TASK-194-1: 同時実行テストの作成
  - `src/services/__tests__/network-filter-service.test.ts` にテスト追加
  - 同一environmentIdで2つのapplyFilterを同時呼び出しするテスト
  - removeFilterとapplyFilterの同時実行テスト
  - 異なるenvironmentIdは並列実行されることのテスト
  - エラー発生時もmutexが解放されることのテスト
  - テスト実行して失敗を確認

### Phase 2: 実装

- [x] TASK-194-2: withFilterLockメソッドの追加
  - `filterMutex: Map<string, Promise<void>>` プロパティを追加
  - `withFilterLock<T>` プライベートメソッドを追加

- [x] TASK-194-3: applyFilter/removeFilterのラップ
  - `applyFilter` の内部ロジックをwithFilterLockでラップ
  - `removeFilter` の内部ロジックをwithFilterLockでラップ

### Phase 3: 確認

- [x] TASK-194-4: テスト実行と確認
  - 新規テストがパスすることを確認
  - 既存テストが引き続きパスすることを確認
  - 全テスト実行

## 受入基準

- [x] 同一environmentIdでのapplyFilter並行呼び出しが直列実行される
- [x] removeFilterとapplyFilterの同時呼び出しが直列実行される
- [x] 異なるenvironmentId間では並列実行が維持される
- [x] エラー発生時にmutexが適切に解放される
- [x] 外部ライブラリを追加していない
- [x] 既存のapplyFilter/removeFilter内部ロジックが変更されていない
- [x] 既存テストがすべてパスする

## 完了サマリー

Promise-based mutexを`NetworkFilterService`に追加し、`applyFilter`/`removeFilter`を
`withFilterLock`によるラップにより直列化を実現した。同一`environmentId`に対する操作は
順番に実行されるようになり、iptablesチェインの競合状態が解消された。
異なる`environmentId`間は引き続き並列実行されるため、パフォーマンスへの影響は最小限。
