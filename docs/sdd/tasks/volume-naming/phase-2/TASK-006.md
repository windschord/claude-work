# TASK-006: useDockerVolumesフック作成

## 説明

Docker Volume一覧をAPIから取得するReactフックを新規作成する。

- 対象ファイル:
  - `src/hooks/useDockerVolumes.ts` (新規)
  - `src/hooks/__tests__/useDockerVolumes.test.ts` (新規)
- 設計書: `docs/sdd/design/volume-naming/components/volume-mount-list-ui.md`

## 技術的文脈

- `GET /api/docker/volumes` を呼び出し
- `{ volumes, loading, error, refetch }` を返す
- fetchベースのシンプルな実装

## 実装手順（TDD）

### 1. テスト作成

```typescript
describe('useDockerVolumes', () => {
  it('Volume一覧をフェッチして返す', async () => {});
  it('ロード中はloading=trueを返す', async () => {});
  it('エラー時にerrorを返す', async () => {});
  it('refetchで再フェッチする', async () => {});
});
```

### 2. テスト実行: 失敗を確認

### 3. テストコミット

### 4. 実装: `src/hooks/useDockerVolumes.ts`

```typescript
export function useDockerVolumes() {
  // useState + useEffect + fetch('/api/docker/volumes')
  // returns { volumes, loading, error, refetch }
}
```

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] useDockerVolumesフックが存在する
- [ ] Volume一覧を正常に取得できる
- [ ] loading/errorステートが正しく管理される
- [ ] テストが通過する

## 依存関係

TASK-004（APIエンドポイントを使用）

## 推定工数

20分

## ステータス

TODO
