# TASK-011: UIコンポーネント（TemplateDialog, TestDialog）

## 説明

デフォルトテンプレート適用ダイアログと通信テスト（dry-run）ダイアログを実装する。

- **対象ファイル**:
  - `src/components/environments/NetworkTemplateDialog.tsx` （新規作成）
  - `src/components/environments/NetworkTestDialog.tsx` （新規作成）
  - `src/components/environments/__tests__/NetworkTemplateDialog.test.tsx` （新規作成）
  - `src/components/environments/__tests__/NetworkTestDialog.test.tsx` （新規作成）
- **設計参照**: `docs/sdd/design/network-filtering/components/network-filter-ui.md`

## 技術的文脈

- Headless UI Dialog でモーダル表示
- useNetworkFilter フック（TASK-010で作成）を使用
- テンプレートデータはAPI経由で取得
- Tailwind CSS でスタイリング

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | ダイアログ構成、テンプレート内容、テスト機能仕様（UI設計書に定義済み） |
| 不明/要確認の情報 | なし |

## 実装手順（TDD）

### 1. テスト作成

**`src/components/environments/__tests__/NetworkTemplateDialog.test.tsx`**:
```typescript
// テストケース:
// 1. テンプレート一覧がカテゴリ別に表示される
// 2. 各ルールにチェックボックスが表示される
// 3. 「全選択」ボタンで全ルールが選択される
// 4. 「全解除」ボタンで全ルールが解除される
// 5. 「適用」ボタンで選択されたルールがAPI経由で追加される
// 6. 重複ルールがある場合にスキップ数が表示される
// 7. 「キャンセル」ボタンでダイアログが閉じる
```

**`src/components/environments/__tests__/NetworkTestDialog.test.tsx`**:
```typescript
// テストケース:
// 8. ドメイン/IPアドレス入力フィールドが表示される
// 9. ポート番号入力フィールドが表示される
// 10. テスト実行ボタンでAPIが呼ばれる
// 11. 許可結果が緑色で表示される
// 12. ブロック結果が赤色で表示される
// 13. マッチしたルール情報が表示される
```

### 2. テスト実行: 失敗を確認
### 3. テストコミット

### 4. 実装

**`NetworkTemplateDialog.tsx`**:
- Headless UI Dialog
- テンプレートAPI呼び出し（`GET /api/environments/[id]/network-rules/templates`）
- カテゴリ別グルーピング表示
- チェックボックス付きルール一覧
- 全選択/全解除ボタン
- 適用ボタン（`POST /api/environments/[id]/network-rules/templates/apply`）
- 結果表示（created数、skipped数）

**`NetworkTestDialog.tsx`**:
- Headless UI Dialog
- ドメイン/IPアドレス入力フィールド
- ポート番号入力フィールド（任意）
- テスト実行ボタン（`POST /api/environments/[id]/network-filter/test`）
- 結果表示:
  - 許可: 緑バッジ + マッチしたルール名
  - ブロック: 赤バッジ

**NetworkFilterSectionへの統合**:
- テンプレート適用ボタン → NetworkTemplateDialogを開く
- 通信テストボタン → NetworkTestDialogを開く

### 5. テスト実行: 全テスト通過を確認
### 6. 実装コミット

## 受入基準

- [ ] テンプレート適用ダイアログが正しく表示される
- [ ] テンプレートのカテゴリ別表示が動作する
- [ ] 全選択/全解除が動作する
- [ ] テンプレート適用後に結果（created/skipped）が表示される
- [ ] 通信テストダイアログが正しく表示される
- [ ] テスト結果が色分けで表示される（許可=緑、ブロック=赤）
- [ ] テストが13件以上あり、全て通過する

## 依存関係
TASK-008（テンプレート・テストAPI）

## 推定工数
40分

## ステータス
`TODO`
