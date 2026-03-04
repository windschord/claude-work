# Issue #194: ネットワークフィルタリング レースコンディション修正 - 設計書

## 概要

`NetworkFilterService`の`applyFilter`/`removeFilter`メソッドに、環境IDごとのPromise-based
mutexを導入して直列化する。これによりiptablesチェインの競合状態を防ぐ。

## 設計方針

### Mutex実装方式

外部ライブラリを使用せず、Promiseチェーンを使ったシンプルなmutexを実装する。

```
filterMutex: Map<environmentId, Promise<void>>
```

- 環境IDごとにPromiseを保持する
- 新しい操作は既存のPromiseが解決するまで待機する
- 操作完了後は次の操作のためのPromiseをセットする
- 最後の操作完了後はMapからエントリを削除してメモリリークを防ぐ

### withFilterLockメソッド

```typescript
private filterMutex = new Map<string, Promise<void>>();

private async withFilterLock<T>(environmentId: string, fn: () => Promise<T>): Promise<T> {
  const current = this.filterMutex.get(environmentId) ?? Promise.resolve();

  let resolve: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  this.filterMutex.set(environmentId, next);

  try {
    await current;       // 前の操作の完了を待つ
    return await fn();   // 実際の処理を実行
  } finally {
    resolve!();          // 次の操作のためにロックを解放
    // 最後のpromiseなら削除（メモリリーク防止）
    if (this.filterMutex.get(environmentId) === next) {
      this.filterMutex.delete(environmentId);
    }
  }
}
```

### 動作シーケンス

```
同時呼び出し例: applyFilter(envA, subnet1) と applyFilter(envA, subnet2)

時刻  操作A（先着）          操作B（後着）
 0:   current = resolved
      next_A = new Promise
      set(envA, next_A)
                             current = next_A（操作Aの完了待ち）
                             next_B = new Promise
                             set(envA, next_B)
 1:   await current(即解決)
      fn()実行開始
 2:   fn()実行完了
      resolve_A()           ← resolve_A()によりoperationBのawaitが解除される
      next_A !== next_B のためMapから削除しない
 3:                         await current(next_A)が解決
                             fn()実行開始
 4:                         fn()実行完了
                             resolve_B()
                             next_B === Mapの値のため削除する
```

### applyFilter/removeFilterのラップ

```typescript
async applyFilter(environmentId: string, containerSubnet: string): Promise<void> {
  return this.withFilterLock(environmentId, async () => {
    // 既存の内部ロジックをそのまま移動
  });
}

async removeFilter(environmentId: string): Promise<void> {
  return this.withFilterLock(environmentId, async () => {
    // 既存の内部ロジックをそのまま移動
  });
}
```

## コンポーネント変更

### NetworkFilterService（src/services/network-filter-service.ts）

| 変更 | 詳細 |
|------|------|
| 追加 | `filterMutex: Map<string, Promise<void>>` プロパティ |
| 追加 | `withFilterLock<T>(environmentId, fn)` メソッド |
| 変更 | `applyFilter` をwithFilterLockでラップ |
| 変更 | `removeFilter` をwithFilterLockでラップ |

## テスト設計

### 同時実行テスト

1. **同一environmentIdで2つのapplyFilterを同時呼び出し**
   - IptablesManagerをモック（遅延あり）
   - 実行順序が直列になることを確認
   - 完全に終わってから次が始まることを確認

2. **removeFilterとapplyFilterの同時実行**
   - 同一environmentIdで同時呼び出し
   - 直列実行されることを確認

3. **異なるenvironmentIdは並列実行されること**
   - 異なるenvironmentIdでは待機しないことを確認

4. **エラーが発生してもmutexが解放されること**
   - fnがエラーをスローしてもresolve()が呼ばれることを確認
   - 次の操作が実行できることを確認

## 影響範囲

- `src/services/network-filter-service.ts`: 変更
- `src/services/__tests__/network-filter-service.test.ts`: テスト追加
- 外部インターフェース変更なし（同じシグネチャ）

## 関連ドキュメント

- 要件: `docs/sdd/requirements/network-filtering/issue-194-race-condition.md`
- タスク: `docs/sdd/tasks/network-filtering/issue-194-race-condition.md`
