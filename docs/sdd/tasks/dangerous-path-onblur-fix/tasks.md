# タスク管理書: 危険パス警告ダイアログのonBlur発火修正

## タスク一覧

| ID | タスク | ステータス |
|----|--------|-----------|
| TASK-001 | テスト修正（Red） | TODO |
| TASK-002 | VolumeMountList実装修正（Green） | TODO |

## TASK-001: テスト修正（Red）

### 概要

VolumeMountList.test.tsxの`dangerous path warning`セクションを修正し、onBlur発火の期待動作に合わせる。

### 受入基準

1. 既存テスト`should call onDangerousPath when dangerous path is detected`を修正: render時ではなくblurイベントでonDangerousPathが呼ばれることを検証
2. 新規テスト追加: `should NOT call onDangerousPath on render with dangerous path` - 危険パスを含むvalueで初期レンダリングしても、onDangerousPathが呼ばれないことを検証
3. 新規テスト追加: `should call onDangerousPath on hostPath blur with dangerous path` - hostPath入力後にblurすると、onDangerousPathが呼ばれることを検証
4. 新規テスト追加: `should NOT call onDangerousPath on blur with safe path` - 安全なパスでblurしてもonDangerousPathが呼ばれないことを検証

### TDD手順

1. テストを修正・追加
2. `npx vitest run src/components/environments/__tests__/VolumeMountList.test.tsx` を実行
3. 新規テストが失敗することを確認（Red）
4. コミット

### ステータス

TODO

## TASK-002: VolumeMountList実装修正（Green）

### 概要

VolumeMountList.tsxのuseEffectをonBlurハンドラに置換する。

### 受入基準

1. useEffectブロック（行98-115）を削除
2. `handleHostPathBlur`関数を追加: blurイベントでisDangerousPath判定を実行
3. hostPath inputに`onBlur={() => handleHostPathBlur(index)}`を追加
4. useEffectのimportを削除（useRefは残す）
5. TASK-001で追加したテストがすべてパスする
6. 既存テスト（インライン警告表示等）が引き続きパスする

### 実装手順

1. `useEffect`ブロック削除（行98-115）
2. `import { useState, useEffect, useRef }`から`useEffect`を削除
3. `handleHostPathBlur`関数を`handleChange`の後に追加:
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
4. hostPath inputに`onBlur`追加（行167付近）
5. テスト実行: `npx vitest run src/components/environments/__tests__/VolumeMountList.test.tsx`
6. 全テストがパスすることを確認（Green）
7. コミット

### ステータス

TODO
