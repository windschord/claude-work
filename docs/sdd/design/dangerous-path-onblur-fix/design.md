# 設計書: 危険パス警告ダイアログのonBlur発火修正

## 変更概要

`VolumeMountList`コンポーネントの危険パス検出ロジックを、`useEffect`（value変更ごと）から`onBlur`ハンドラ（フォーカス離脱時）に変更する。

## 現在の実装

```text
onChange → value更新 → useEffect発火 → isDangerousPath判定 → onDangerousPathコールバック → ダイアログ表示
```

入力の各キーストロークでuseEffectが発火し、中間状態（`/`のみ等）で誤検出する。

## 修正後の実装

```text
onBlur（hostPathフィールド） → isDangerousPath判定 → onDangerousPathコールバック → ダイアログ表示
```

## コンポーネント変更

### VolumeMountList.tsx

#### 削除するコード

1. `useEffect`ブロック全体（行98-115）: value変更時のisDangerousPathチェック

#### 追加するコード

1. `handleHostPathBlur`関数: blurイベントからhostPathを直接受け取り判定

```typescript
const handleHostPathBlur = (hostPath: string) => {
  if (!onDangerousPath) return;
  if (!hostPath || !isDangerousPath(hostPath)) return;
  if (notifiedPathsRef.current.has(hostPath)) return;
  notifiedPathsRef.current.add(hostPath);
  onDangerousPath(hostPath);
};
```

2. hostPath inputに`onBlur`プロパティを追加（event.currentTarget.valueで最新値を取得）:

```tsx
<input
  ...
  onBlur={(e) => handleHostPathBlur(e.currentTarget.value)}
/>
```

3. `handleChange`でhostPath変更時に旧パスの通知状態をクリア:

```typescript
const handleChange = (index: number, field: keyof VolumeMount, fieldValue: string) => {
  if (field === 'hostPath') {
    const prevHostPath = value[index]?.hostPath;
    if (prevHostPath && prevHostPath !== fieldValue) {
      notifiedPathsRef.current.delete(prevHostPath);
    }
  }
  // ...
};
```

#### notifiedPathsRefの管理

- `handleRemove`: 行削除時にnotifiedPathsRefから該当パスを削除（維持）
- `handleChange`: hostPath変更時に旧パスをnotifiedPathsRefから削除（新規追加）
- 親コンポーネント（EnvironmentForm）のDangerousPathWarning onCancelは`setVolumeMounts(prev.filter(...))`でvalue配列を直接変更する。この場合、VolumeMountListのhandleRemoveは呼ばれないが、handleChangeのクリーンアップにより同じパスの再入力時に再通知が可能

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

### event.currentTarget.valueの使用

handleHostPathBlurはvalue[index]からではなく、blurイベントのcurrentTarget.valueから最新の入力値を直接取得する。これにより、Reactの状態更新バッチングによる古い値の参照リスクを排除する。

### notifiedPathsRefの二重クリーンアップ

handleRemove（内部削除）とhandleChange（hostPath変更時）の両方でnotifiedPathsRefをクリアする。EnvironmentFormのDangerousPathWarning onCancelはvolumeMountsを直接`prev.filter`で更新するため、VolumeMountListのhandleRemoveは経由しない。handleChangeでのクリーンアップにより、パスを編集して同じ危険パスを再入力した場合も再通知される。

## 要件との整合性

| 要件 | 対応方法 |
|------|----------|
| REQ-112-FIX-001 | useEffectをonBlurハンドラに置換 |
| REQ-112-FIX-002 | validateMount関数は変更なし（onChangeで即座にインライン表示） |
| REQ-112-FIX-003 | useEffect削除により、初期表示時にコールバックは発火しない |
| REQ-112-FIX-004 | handleChangeとhandleRemoveでnotifiedPathsRefをクリアするため、再blur時に再発火する |
