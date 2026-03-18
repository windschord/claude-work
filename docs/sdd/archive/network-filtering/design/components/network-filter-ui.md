# NetworkFilterUI

## 概要

**目的**: 環境設定ページにネットワークフィルタリングの設定セクションを統合するUIコンポーネント群

**責務**:
- フィルタリングの有効/無効トグル表示
- ホワイトリストルールの一覧・追加・編集・削除UI
- デフォルトテンプレート適用ダイアログ
- 通信テスト機能UI
- フィルタリング状態のステータス表示

**ファイルパス**:
- `src/components/environments/NetworkFilterSection.tsx` - メインセクション
- `src/components/environments/NetworkRuleList.tsx` - ルール一覧
- `src/components/environments/NetworkRuleForm.tsx` - ルール追加/編集フォーム
- `src/components/environments/NetworkTemplateDialog.tsx` - テンプレート適用ダイアログ
- `src/components/environments/NetworkTestDialog.tsx` - 通信テストダイアログ
- `src/hooks/useNetworkFilter.ts` - データ取得・操作フック

---

## コンポーネント構成

```text
EnvironmentDetail (既存)
  └── NetworkFilterSection
        ├── FilterToggle (有効/無効)
        ├── NetworkRuleList
        │     ├── RuleRow (各ルール)
        │     │     ├── EnableToggle
        │     │     ├── EditButton
        │     │     └── DeleteButton
        │     └── AddRuleButton
        ├── NetworkRuleForm (モーダル)
        ├── NetworkTemplateDialog (モーダル)
        └── NetworkTestDialog (モーダル)
```

---

## 主要コンポーネント

### NetworkFilterSection

環境詳細ページ内のフィルタリング設定セクション。Docker環境の場合のみ表示。

**Props**:
```typescript
interface NetworkFilterSectionProps {
  environmentId: string;
  environmentType: 'HOST' | 'DOCKER' | 'SSH';
}
```

**表示条件**: `environmentType === 'DOCKER'` の場合のみレンダリング

### NetworkRuleList

ルール一覧テーブル。

**カラム**:
| カラム | 説明 |
|--------|------|
| ターゲット | ドメイン/IP/ワイルドカード |
| ポート | ポート番号（全ポートの場合は「全て」） |
| 説明 | 任意のメモ |
| 有効 | 有効/無効トグル |
| 操作 | 編集・削除ボタン |

### NetworkRuleForm

ルール追加・編集用モーダルフォーム。

**フォームフィールド**:
| フィールド | 型 | バリデーション |
|-----------|-----|---------------|
| ターゲット | text | 必須。ドメイン名/IPアドレス/ワイルドカード/CIDR形式 |
| ポート | number | 任意。1-65535の整数 |
| 説明 | text | 任意。最大200文字 |

**ワイルドカード入力時のヘルプ表示**:
- `*.example.com` 入力時: 「example.comの全てのサブドメインにマッチします」

### NetworkTemplateDialog

デフォルトテンプレート適用ダイアログ。

**UI要素**:
- カテゴリ別のルール一覧（チェックボックス付き）
- 各ルールの説明
- 「全選択」「全解除」ボタン
- 重複ルールの自動検出・表示
- 「適用」「キャンセル」ボタン

### NetworkTestDialog

通信テスト（dry-run）ダイアログ。

**UI要素**:
- ドメイン/IPアドレス入力フィールド
- ポート番号入力フィールド
- テスト実行ボタン
- 結果表示: 許可（緑）/ ブロック（赤）、マッチしたルール名

---

## カスタムフック

### useNetworkFilter

```typescript
interface UseNetworkFilterReturn {
  // 状態
  rules: NetworkFilterRule[];
  filterConfig: NetworkFilterConfig | null;
  isLoading: boolean;
  error: string | null;

  // ルール操作
  createRule: (input: CreateRuleInput) => Promise<void>;
  updateRule: (ruleId: string, input: UpdateRuleInput) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;

  // フィルタリング設定
  toggleFilter: (enabled: boolean) => Promise<void>;

  // テンプレート
  getTemplates: () => Promise<DefaultTemplate[]>;
  applyTemplates: (rules: CreateRuleInput[]) => Promise<void>;

  // テスト
  testConnection: (target: string, port?: number) => Promise<TestResult>;
}
```

**依存配列の注意**: useEffect内ではprimitiveな値（environmentId）のみを依存配列に含める。

---

## 状態管理

| 状態 | 説明 | 遷移条件 |
|------|------|---------|
| LOADING | データ取得中 | コンポーネントマウント時 |
| READY | 表示可能 | データ取得完了 |
| SAVING | ルール保存中 | ルール追加/編集/削除実行時 |
| ERROR | エラー状態 | API呼び出し失敗時 |

---

## テスト観点

- [ ] 正常系: Docker環境の場合のみフィルタリングセクションが表示されること
- [ ] 正常系: HOST/SSH環境ではフィルタリングセクションが非表示であること
- [ ] 正常系: ルール一覧が正しく表示されること
- [ ] 正常系: ルール追加・編集・削除が動作すること
- [ ] 正常系: テンプレート適用ダイアログが正しく動作すること
- [ ] 異常系: バリデーションエラーが表示されること
- [ ] 異常系: API呼び出し失敗時にエラーメッセージが表示されること

## 関連要件

- [REQ-001](../../requirements/network-filtering/stories/US-001.md) @../../requirements/network-filtering/stories/US-001.md: ルール設定管理UI
- [REQ-003](../../requirements/network-filtering/stories/US-003.md) @../../requirements/network-filtering/stories/US-003.md: テンプレート
- [REQ-004](../../requirements/network-filtering/stories/US-004.md) @../../requirements/network-filtering/stories/US-004.md: モニタリング
- [NFR-USA](../../requirements/network-filtering/nfr/usability.md) @../../requirements/network-filtering/nfr/usability.md: ユーザビリティ要件
