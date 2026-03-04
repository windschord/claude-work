# Issue #191: テンプレート適用後のUI更新 - タスク

## ステータス: DONE

## タスク一覧

### TASK-001: テストを追加（TDD）

**ステータス**: DONE

**対象ファイル**:
- `src/hooks/__tests__/useNetworkFilter.test.ts`
- `src/components/environments/__tests__/NetworkFilterSection.test.tsx`

**作業内容**:
1. `useNetworkFilter.test.ts` に `refresh` 関数のテストを追加
   - `refresh()` を呼ぶとルール一覧が再取得される
2. `NetworkFilterSection.test.tsx` にテンプレート適用後のrefresh検証テストを追加
   - テンプレートダイアログの `onApplied` が呼ばれたとき `refresh` が実行される

**受入基準**:
- 追加したテストが実行時に失敗すること（TDD赤フェーズ）

### TASK-002: 実装

**ステータス**: DONE

**対象ファイル**:
- `src/hooks/useNetworkFilter.ts`
- `src/components/environments/NetworkFilterSection.tsx`

**作業内容**:
1. `useNetworkFilter.ts`:
   - `UseNetworkFilterReturn` 型に `refresh: () => Promise<void>` を追加
   - `fetchAll(environmentId)` を呼ぶ `refresh` 関数を実装して返却
2. `NetworkFilterSection.tsx`:
   - `useNetworkFilter` から `refresh` を取得
   - `NetworkTemplateDialog` の `onApplied` コールバックで `refresh()` を呼ぶ
   - ダイアログクローズも維持する

**受入基準**:
- TASK-001 のテストがすべてパスすること
- 既存のテストが引き続きパスすること
