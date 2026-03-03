# TASK-010: UIコンポーネント（NetworkFilterSection, RuleList, RuleForm）

## 説明

環境設定ページにネットワークフィルタリングの設定セクションを追加する。ルール一覧、追加/編集フォーム、フィルタリングの有効/無効トグルを実装する。

- **対象ファイル**:
  - `src/components/environments/NetworkFilterSection.tsx` （新規作成）
  - `src/components/environments/NetworkRuleList.tsx` （新規作成）
  - `src/components/environments/NetworkRuleForm.tsx` （新規作成）
  - `src/hooks/useNetworkFilter.ts` （新規作成）
  - `src/components/environments/__tests__/NetworkFilterSection.test.tsx` （新規作成）
  - `src/hooks/__tests__/useNetworkFilter.test.ts` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/network-filter-ui.md`
- **既存パターン参照**: `src/components/environments/` 内の既存コンポーネント

## 技術的文脈

- React + TypeScript
- Tailwind CSS でスタイリング
- Headless UI でモーダル/トグル
- Lucide icons でアイコン
- useEffect依存配列: primitive値のみ（CLAUDE.mdのガイドライン準拠）
- API呼び出し: fetch (既存パターンに従う)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | コンポーネント構成、Props、表示条件（UI設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

**`src/hooks/__tests__/useNetworkFilter.test.ts`**:
```typescript
// fetchをモックしてテスト
// 1. ルール一覧を正しくフェッチする
// 2. フィルタリング設定を正しくフェッチする
// 3. ルール作成後にルール一覧を再フェッチする
// 4. ルール削除後にルール一覧を再フェッチする
// 5. フィルタリング有効/無効切り替えが正しくAPIを呼ぶ
// 6. エラー発生時にerror状態を設定する
```

**`src/components/environments/__tests__/NetworkFilterSection.test.tsx`**:
```typescript
// useNetworkFilterをモックしてテスト
// 7. Docker環境の場合にフィルタリングセクションが表示される
// 8. HOST環境の場合にフィルタリングセクションが非表示
// 9. SSH環境の場合にフィルタリングセクションが非表示
// 10. ルール一覧が正しく表示される
// 11. ルール追加ボタンクリックでフォームが表示される
// 12. フィルタリングトグルのON/OFF操作
// 13. ルール削除ボタンクリックで削除が実行される
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

**`useNetworkFilter.ts`**:
```typescript
export function useNetworkFilter(environmentId: string) {
  // rules, filterConfig, isLoading, error の状態管理
  // createRule, updateRule, deleteRule, toggleRule, toggleFilter のAPI呼び出し
}
```

**`NetworkFilterSection.tsx`**:
- 環境タイプがDOCKERの場合のみ表示
- フィルタリング有効/無効トグル
- NetworkRuleList コンポーネント
- ルール追加ボタン

**`NetworkRuleList.tsx`**:
- ルール一覧テーブル（ターゲット、ポート、説明、有効/無効、操作）
- 各行に編集・削除ボタン

**`NetworkRuleForm.tsx`**:
- Headless UI Dialog（モーダル）
- ターゲット入力（ドメイン/IP/ワイルドカード/CIDR）
- ポート入力（任意）
- 説明入力（任意）
- ワイルドカード入力時のヘルプテキスト表示
- フロントエンドバリデーション

**環境詳細ページへの統合**:
- 既存の環境詳細コンポーネントに `<NetworkFilterSection>` を追加

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] `NetworkFilterSection` がDocker環境でのみ表示される
- [ ] フィルタリングの有効/無効トグルが動作する
- [ ] ルール一覧が正しく表示される
- [ ] ルール追加フォーム（モーダル）が動作する
- [ ] ルール編集・削除が動作する
- [ ] ワイルドカード入力時にヘルプテキストが表示される
- [ ] フロントエンドバリデーションが動作する
- [ ] `useNetworkFilter` フックのテストが通過する
- [ ] コンポーネントテストが通過する

## 依存関係
TASK-007（ルールCRUD API）、TASK-008（設定API）

## 推定工数
60分

## 完了サマリー
useNetworkFilter フックと NetworkFilterSection/NetworkRuleList/NetworkRuleForm コンポーネントを実装。TDD（Red→Green）で26件のテストが全通過。

## ステータス
`DONE`
