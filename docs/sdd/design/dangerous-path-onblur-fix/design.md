# 設計書: 危険パス警告ダイアログのonBlur発火修正

## 変更概要

`VolumeMountList`コンポーネントの危険パス検出ロジックを、`useEffect`（value変更ごと）から`onBlur`ハンドラ（フォーカス離脱時）に変更する。

## 現在の実装

```
onChange → value更新 → useEffect発火 → isDangerousPath判定 → onDangerousPathコールバック → ダイアログ表示
```

入力の各キーストロークでuseEffectが発火し、中間状態（`/`のみ等）で誤検出する。

## 修正後の実装

```
onBlur（hostPathフィールド） → isDangerousPath判定 → onDangerousPathコールバック → ダイアログ表示
```

## コンポーネント変更

### VolumeMountList.tsx

#### 削除するコード

1. `useEffect`ブロック全体（行98-115）: value変更時のisDangerousPathチェック

#### 追加するコード

1. `handleHostPathBlur`関数: hostPathフィールドのblurイベントハンドラ

```typescript
const handleHostPathBlur = (index: number) => {
  if (!onDangerousPath) return;
  const hostPath = value[index]?.hostPath;
  if (!hostPath || !isDangerousPath(hostPath)) return;
  if (notifiedPathsRef.current.has(hostPath)) return;
  notifiedPathsRef.current.add(hostPath);
  onDangerousPath(hostPath);
};
```

2. hostPath inputに`onBlur`プロパティを追加:

```tsx
<input
  ...
  onBlur={() => handleHostPathBlur(index)}
/>
```

#### notifiedPathsRefの管理変更

- `useEffect`でのクリーンアップロジックは不要（useEffect自体を削除するため）
- `handleRemove`内の既存の`notifiedPathsRef.current.delete(removedPath)`は維持
- `handleHostPathBlur`内で変更前パスの通知状態をクリアする必要があるか検討
  - 不要: `handleRemove`（キャンセル時にEnvironmentFormが呼ぶ`prev.filter`で行が削除される）で既にクリアされている

#### import変更

- `useEffect`が不要になるため、importから削除

### EnvironmentForm.tsx

変更なし。`onDangerousPath`コールバックの呼び出し元が変わるだけで、インターフェースは同一。

### 影響を受けるテスト

#### VolumeMountList.test.tsx

`dangerous path warning` describeブロックの以下テスト修正:

- `should call onDangerousPath when dangerous path is detected`: 初期render時のコールバック発火テストを、blurイベントでの発火テストに変更
- 新規テスト追加: `should NOT call onDangerousPath on render with dangerous path`（REQ-112-FIX-003）
- 新規テスト追加: `should call onDangerousPath on hostPath blur with dangerous path`

## 技術的決定事項

### useEffect削除の根拠

useEffectはvalue配列全体を依存配列に持つため、どのフィールドが変更されても全マウントを再チェックしてしまう。onBlurに移行することで、ユーザーが入力を完了した特定の行のみをチェックでき、効率的かつ正確になる。

### notifiedPathsRefのクリーンアップ簡素化

useEffect内のクリーンアップロジック（現在のvalueに含まれないパスの通知状態クリア）は、handleRemove内の`notifiedPathsRef.current.delete(removedPath)`で代替される。EnvironmentFormのonCancelはvolumeMountsを`prev.filter`で更新し、VolumeMountListのhandleRemoveが呼ばれるフローのため、クリーンアップは維持される。

## 要件との整合性

| 要件 | 対応方法 |
|------|----------|
| REQ-112-FIX-001 | useEffectをonBlurハンドラに置換 |
| REQ-112-FIX-002 | validateMount関数は変更なし（onChangeで即座にインライン表示） |
| REQ-112-FIX-003 | useEffect削除により、初期表示時にコールバックは発火しない |
| REQ-112-FIX-004 | handleRemoveでnotifiedPathsRefからパスを削除するため、再blur時に再発火する |
