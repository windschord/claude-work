# TASK-002: DockerClient Volume一覧メソッド追加

## 説明

既存の `DockerClient` クラスに `listVolumes()` と `inspectVolume()` メソッドを追加する。

- 対象ファイル:
  - `src/services/docker-client.ts` (既存修正)
  - `src/services/__tests__/docker-client.test.ts` (既存修正 or 新規)
- 設計書: `docs/sdd/design/volume-naming/components/docker-client-volumes.md`

## 技術的文脈

- DockerClientはシングルトンパターン
- dockerodeライブラリのlistVolumes()とVolume.inspect()をラップ
- 既存のcreateVolume, getVolume, removeVolumeパターンに合わせる

## 実装手順（TDD）

### 1. テスト作成

```typescript
describe('listVolumes', () => {
  it('Docker Volume一覧を返す', async () => {});
  it('エラー時に例外をスローする', async () => {});
});

describe('inspectVolume', () => {
  it('指定Volumeの詳細を返す', async () => {});
  it('存在しないVolumeでエラーをスローする', async () => {});
});
```

### 2. テスト実行: 失敗を確認

### 3. テストコミット

### 4. 実装: `src/services/docker-client.ts` にメソッド追加

```typescript
public async listVolumes(): Promise<Docker.VolumeListResponse> {
  // this.docker.listVolumes() をラップ
}

public async inspectVolume(name: string): Promise<Docker.VolumeInspectInfo> {
  // this.docker.getVolume(name).inspect() をラップ
}
```

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] `listVolumes()` メソッドがDockerClientに追加されている
- [ ] `inspectVolume()` メソッドがDockerClientに追加されている
- [ ] テストが通過する
- [ ] 既存のDockerClientテストが壊れていない

## 依存関係

なし

## 推定工数

20分

## ステータス

TODO
