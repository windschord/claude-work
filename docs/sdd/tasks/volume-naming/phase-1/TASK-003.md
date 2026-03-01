# TASK-003: docker-config-validator Volume名バリデーション追加

## 説明

`docker-config-validator.ts` の `validateVolumeMounts()` を拡張し、`sourceType === 'volume'` 時にVolume名バリデーションを適用する。

- 対象ファイル:
  - `src/lib/docker-config-validator.ts` (既存修正)
  - `src/lib/__tests__/docker-config-validator.test.ts` (既存修正)
  - `src/types/environment.ts` (既存修正 - VolumeMount型にsourceType追加)
- 設計書: `docs/sdd/design/volume-naming/components/volume-mount-list-ui.md`

## 技術的文脈

- `docker-config-validator.ts` はフロントエンド・バックエンド共用
- `VolumeMount` 型に `sourceType?: 'bind' | 'volume'` を追加
- `sourceType === 'volume'` の場合、hostPathをVolume名として扱い、`validateVolumeName()` で検証
- ホストパス固有バリデーション（絶対パス、パストラバーサル等）をスキップ

## 実装手順（TDD）

### 1. テスト作成

```typescript
describe('validateVolumeMounts - sourceType volume', () => {
  it('sourceType=volumeで有効なVolume名は通過', () => {});
  it('sourceType=volumeで無効なVolume名はエラー', () => {});
  it('sourceType=volumeでhostPathの絶対パスチェックをスキップ', () => {});
  it('sourceType未指定(bind)は既存の動作を維持', () => {});
});
```

### 2. テスト実行: 失敗を確認

### 3. テストコミット

### 4. 実装
- `src/types/environment.ts`: VolumeMount型にsourceType追加
- `src/lib/docker-config-validator.ts`: validateVolumeMounts()を拡張
- TASK-001の`validateVolumeName()`をimportして使用

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] VolumeMount型にsourceTypeフィールドが追加されている
- [ ] sourceType='volume'時にVolume名バリデーションが適用される
- [ ] sourceType未指定時に既存のバリデーションが動作する
- [ ] 既存テストが壊れていない

## 依存関係

TASK-001（validateVolumeName関数を使用）

## 推定工数

20分

## ステータス

TODO
