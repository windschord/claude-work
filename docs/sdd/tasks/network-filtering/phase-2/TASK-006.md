# TASK-006: DockerAdapter拡張（フィルタリング統合）

## 説明

既存のDockerAdapterにネットワークフィルタリング統合を追加する。コンテナ起動時にフィルタリングを適用し、停止時にクリーンアップする。

- **対象ファイル**:
  - `src/services/adapters/docker-adapter.ts` （既存に変更追加）
  - `src/services/adapters/__tests__/docker-adapter-filter.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/index.md`（コンテナ起動時のフロー）

## 技術的文脈

- DockerAdapterの`createSession`メソッドにフィルタリング適用を統合
- DockerAdapterの`destroySession`メソッドにクリーンアップを統合
- `buildContainerOptions`でDockerカスタムネットワークの設定を追加
- フィルタリング無効時は既存の動作と完全に同一（NFR-MNT-002）
- 既存の`CapDrop: ['ALL']`を維持（NFR-SEC-002）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 統合ポイント、フェイルセーフ動作、既存動作の維持（設計書・要件に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成: `src/services/adapters/__tests__/docker-adapter-filter.test.ts`

```typescript
// NetworkFilterServiceとDockerodeをモックしてテスト
// テストケース:
// 1. createSession: フィルタリング有効時にapplyFilterが呼ばれる
// 2. createSession: フィルタリング無効時にapplyFilterが呼ばれない
// 3. createSession: applyFilter失敗時にコンテナ起動が中止される
// 4. createSession: applyFilter失敗時にエラーがログに記録される
// 5. destroySession: removeFilterが呼ばれる
// 6. destroySession: removeFilter失敗時は警告ログのみ（セッション破棄は続行）
// 7. buildContainerOptions: フィルタリング有効時にDockerネットワーク設定が含まれる
// 8. buildContainerOptions: フィルタリング無効時にネットワーク設定が含まれない
// 9. buildContainerOptions: CapDrop['ALL']が維持されている
// 10. 既存のcreateSessionテストが引き続きパスする
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

`src/services/adapters/docker-adapter.ts` の変更箇所:

**constructorまたはプロパティ追加**:
```typescript
private networkFilterService: NetworkFilterService;
```

**createSession変更**（既存フローにフィルタリングステップを追加）:
```typescript
// 既存: コンテナ作成 → stream attach → コンテナ起動
// 変更: コンテナ作成 → stream attach → コンテナ起動 → applyFilter
//
// フィルタリング適用ステップ:
// 1. networkFilterService.applyFilter(environmentId, containerSubnet)
// 2. 失敗時: コンテナ停止・削除 → エラースロー
```

**destroySession変更**:
```typescript
// 既存フローの先頭にクリーンアップを追加:
// 1. networkFilterService.removeFilter(environmentId)  // 追加
// 2. PTY process kill（既存）
// 3. コンテナ停止（既存）
```

**buildContainerOptions変更**:
```typescript
// フィルタリング有効時:
// NetworkingConfig に カスタムネットワーク設定を追加
// ネットワーク名: `claudework-filter-${environmentId.slice(0, 8)}`
```

### 5. テスト実行: 全テスト通過を確認（既存テスト含む）
### 6. 実装コミット

## 受入基準

- [x] `createSession` にフィルタリング適用ステップが統合されている
- [x] `destroySession` にクリーンアップステップが統合されている
- [x] フィルタリング無効時は既存動作と完全に同一
- [x] フィルタリング適用失敗時はコンテナ起動が中止される
- [x] `CapDrop: ['ALL']` が維持されている
- [x] 既存のDockerAdapter関連テストが全てパスする
- [x] 新規テストが10件以上あり、全て通過する

## 依存関係
TASK-005（フィルタリング適用ロジック）

## 推定工数
40分

## ステータス
`DONE`

## 完了サマリー
DockerAdapterにnetworkFilterServiceを統合。createSessionでコンテナ起動後にapplyFilterを適用し、destroySessionでremoveFilterをクリーンアップする。フィルタリング失敗時はコンテナを停止・削除してエラーをスロー（フェイルセーフ）。既存CapDrop['ALL']維持、フィルタリング無効時は既存動作と完全同一。TDDで13件のテストを作成し全て通過、既存102テストも全てパス。
