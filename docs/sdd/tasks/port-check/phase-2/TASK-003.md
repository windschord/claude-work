# TASK-003: PortMappingList UI拡張のテスト作成・実装

## 説明

既存のPortMappingListコンポーネントにポート使用状況チェック機能を追加する。

- 対象ファイル:
  - テスト: `src/components/environments/__tests__/PortMappingList.test.tsx`
  - 実装: `src/components/environments/PortMappingList.tsx`
- 設計書: `docs/sdd/design/port-check/components/port-mapping-list.md`

## 技術的文脈

- フレームワーク: React (Next.js)
- UIライブラリ: Tailwind CSS, Lucide Icons
- テストフレームワーク: Vitest + @testing-library/react
- 参照すべき既存コード: `src/components/environments/PortMappingList.tsx`

## 実装手順（TDD）

### 1. テスト作成: `src/components/environments/__tests__/PortMappingList.test.tsx`

テストケース:
1. **チェックボタン表示**: 有効なポートがある場合「ポートチェック」ボタンが表示される
2. **チェックボタン非表示**: ポートがない場合チェックボタンが表示されない
3. **チェック実行**: ボタンクリックでfetch APIが呼ばれる
4. **ローディング状態**: チェック中にローディングインジケータ（Loader2）が表示される
5. **available表示**: チェック結果がavailableの場合緑チェックアイコン（CheckCircle2）が表示される
6. **in_use表示**: チェック結果がin_useの場合赤警告アイコン（AlertCircle）と使用元情報が表示される
7. **unknown表示**: チェック結果がunknownの場合グレーアイコン（HelpCircle）が表示される
8. **ポート変更時リセット**: ホストポート変更時にチェック結果がリセットされる
9. **excludeEnvironmentId**: propとしてexcludeEnvironmentIdがfetchリクエストに含まれる

fetch APIをモック化:
```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ results: [...] }),
});
```

### 2. テスト実行: 失敗を確認

```bash
npx vitest run src/components/environments/__tests__/PortMappingList.test.tsx
```

### 3. テストコミット

### 4. 実装: `src/components/environments/PortMappingList.tsx` を拡張

追加するprops:
```typescript
excludeEnvironmentId?: string;
```

追加するstate:
```typescript
const [portCheckResults, setPortCheckResults] = useState<Map<number, PortCheckResult>>(new Map());
const [isChecking, setIsChecking] = useState(false);
```

追加するLucide Icons import:
```typescript
import { Plus, X, CheckCircle2, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
```

### 5. テスト通過を確認、実装コミット

## 受入基準

- [ ] `src/components/environments/__tests__/PortMappingList.test.tsx` に9つ以上のテストケース
- [ ] PortMappingListに `excludeEnvironmentId` propが追加されている
- [ ] 4つの状態（available/in_use/unknown/チェック中）が正しく表示される
- [ ] 全テストがパスする: `npx vitest run src/components/environments/__tests__/PortMappingList.test.tsx`
- [ ] ESLintエラーがゼロ

## 依存関係

TASK-001, TASK-002（APIの型定義を使用）

## 推定工数

40分

## ステータス

DONE
