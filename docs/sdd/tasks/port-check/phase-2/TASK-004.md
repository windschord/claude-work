# TASK-004: EnvironmentForm連携とE2E確認

## 説明

EnvironmentFormコンポーネントからPortMappingListにexcludeEnvironmentIdを渡す連携を追加し、全体の動作を確認する。

- 対象ファイル:
  - 実装: `src/components/environments/EnvironmentForm.tsx`
- 設計書: `docs/sdd/design/port-check/components/port-mapping-list.md`

## 技術的文脈

- フレームワーク: React (Next.js)
- 参照すべき既存コード: `src/components/environments/EnvironmentForm.tsx`

## 実装手順

### 1. EnvironmentForm.tsx の変更

PortMappingListコンポーネントに `excludeEnvironmentId` propsを追加:

```tsx
<PortMappingList
  value={portMappings}
  onChange={setPortMappings}
  excludeEnvironmentId={mode === 'edit' ? environment?.id : undefined}
/>
```

### 2. 全テスト実行

```bash
npx vitest run
```

### 3. ビルド確認

```bash
npm run build
```

### 4. lint確認

```bash
npm run lint
```

### 5. コミット

## 受入基準

- [ ] EnvironmentFormからPortMappingListにexcludeEnvironmentIdが渡されている
- [ ] 編集モード時に環境IDが渡され、新規作成時はundefined
- [ ] 全テストがパスする: `npx vitest run`
- [ ] ビルドが成功する: `npm run build`
- [ ] ESLintエラーがゼロ: `npm run lint`

## 依存関係

TASK-003

## 推定工数

20分

## ステータス

TODO
