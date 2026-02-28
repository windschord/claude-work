# TASK-007: VolumeMountList既存Volume選択UI

## 説明

既存の `VolumeMountList` コンポーネントにDocker Named Volume選択機能を追加する。

- 対象ファイル:
  - `src/components/environments/VolumeMountList.tsx` (既存修正)
  - `src/components/environments/__tests__/VolumeMountList.test.tsx` (既存修正 or 新規)
- 設計書: `docs/sdd/design/volume-naming/components/volume-mount-list-ui.md`

## 技術的文脈

- 各マウント行の先頭にソース種別セレクタ（bind/volume）を追加
- `sourceType === 'volume'` 時: Docker Volume一覧ドロップダウンを表示
- `useDockerVolumes()` フックでVolume一覧を取得
- `validateVolumeName()` でVolume名バリデーション

## UI設計

```text
[ホストパス ▼] [/host/path     ] → [/container/path] [RW ▼] [X]
[Volume    ▼] [cw-repo-xxx  ▼ ] → [/container/path] [RW ▼] [X]
```

## 実装手順（TDD）

### 1. テスト作成

```typescript
describe('VolumeMountList - Volume selection', () => {
  it('ソース種別セレクタが表示される', () => {});
  it('bindモードでは既存のhostPath入力を表示', () => {});
  it('volumeモードではVolume一覧ドロップダウンを表示', () => {});
  it('Volume選択でhostPathが更新される', () => {});
  it('volumeモードで無効なVolume名にエラー表示', () => {});
});
```

### 2. テスト実行: 失敗を確認

### 3. テストコミット

### 4. 実装
- ソース種別セレクタの追加
- Docker Volume選択ドロップダウンの実装
- Volume名手動入力オプションの追加
- バリデーション統合

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] ソース種別セレクタ（bind/volume）が表示される
- [ ] volumeモードでDocker Volume一覧が表示される
- [ ] Volume選択でhostPathが正しく更新される
- [ ] バリデーションが正しく動作する
- [ ] 既存のbindマウント動作が壊れていない
- [ ] テストが通過する

## 依存関係

TASK-003（バリデーション更新）、TASK-006（useDockerVolumesフック）

## 推定工数

40min

## ステータス

TODO
