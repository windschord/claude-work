# TASK-004: GET /api/docker/volumes エンドポイント作成

## 説明

Docker Volume一覧を返すAPIエンドポイントを新規作成する。

- 対象ファイル:
  - `src/app/api/docker/volumes/route.ts` (新規)
  - `src/app/api/docker/volumes/__tests__/route.test.ts` (新規)
- 設計書: `docs/sdd/design/volume-naming/api/docker-volumes.md`

## 技術的文脈

- Next.js App Router のAPIルートとして実装
- DockerClient.listVolumes() を使用
- Docker未接続時は503を返す

## 実装手順（TDD）

### 1. テスト作成

```typescript
describe('GET /api/docker/volumes', () => {
  it('Volume一覧を正常に返す', async () => {});
  it('Docker未接続時に503を返す', async () => {});
  it('エラー時に500を返す', async () => {});
});
```

### 2. テスト実行: 失敗を確認

### 3. テストコミット

### 4. 実装: `src/app/api/docker/volumes/route.ts`
- DockerClient.ping()で接続確認
- DockerClient.listVolumes()でVolume一覧取得
- レスポンス形式: `{ volumes: Array<{ name, driver, createdAt, labels }> }`

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] `GET /api/docker/volumes` がVolume一覧を返す
- [ ] Docker未接続時に503レスポンス
- [ ] テストが通過する

## 依存関係

TASK-002（DockerClient.listVolumes()を使用）

## 推定工数

25分

## ステータス

TODO
