# コンポーネント設計: PortMappingList拡張

## 概要

既存の `PortMappingList` コンポーネントにポート使用状況チェック機能を追加する。

**ファイル**: `src/components/environments/PortMappingList.tsx`

## 変更概要

### 新規props

```typescript
interface PortMappingListProps {
  value: PortMapping[];
  onChange: (mappings: PortMapping[]) => void;
  // 新規追加
  excludeEnvironmentId?: string;  // 編集中の環境ID（自己除外用）
}
```

### 新規state

```typescript
// ポートチェック結果を管理する状態
const [portCheckResults, setPortCheckResults] = useState<Map<number, PortCheckResult>>(new Map());
const [isChecking, setIsChecking] = useState(false);
```

## UI設計

### ポートマッピング行のレイアウト

```
[ホストポート入力] : [コンテナポート入力] [protocol] [チェック結果アイコン] [削除ボタン]

[ポートチェック] ボタン（Loader2アニメーション: チェック中）
```

### チェック結果アイコン（Lucide Icons）

| status | Lucideアイコン | 色 | テキスト |
|--------|--------------|-----|---------|
| available | CheckCircle2 | 緑（text-green-500） | 利用可能 |
| in_use | AlertCircle | 赤（text-red-500） | 使用中: {usedBy} |
| unknown | HelpCircle | グレー（text-gray-400） | チェック不可 |
| チェック中 | Loader2 | - | animate-spin |

### Lucide Iconsのimport

```typescript
import { Plus, X, CheckCircle2, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
```

## 処理フロー

### handleCheckPorts

1. 有効なホストポート（1-65535の整数）を抽出
2. `isChecking = true` に設定
3. `POST /api/environments/check-ports` にfetchリクエスト送信
   - body: `{ ports: [...], excludeEnvironmentId }`
4. レスポンスの `results` を `portCheckResults` Map に格納（port番号をキーに）
5. `isChecking = false` に設定

### ポート変更時のリセット

- ホストポートの値が変更された場合、該当ポートのチェック結果をMapから削除（未チェック状態に戻す）

## EnvironmentFormとの連携

`EnvironmentForm.tsx` での変更は最小限:

```tsx
<PortMappingList
  value={portMappings}
  onChange={setPortMappings}
  excludeEnvironmentId={mode === 'edit' ? environment?.id : undefined}
/>
```

## テスト方針

- `global.fetch` をモック化してAPIコールをテスト
- チェック結果に応じたアイコン表示の検証（@testing-library/react）
- `isChecking` 状態のローディング表示検証
- ポート変更時のチェック結果リセット動作の検証
- `excludeEnvironmentId` がfetchリクエストbodyに含まれることを検証
