# Issue #194: ネットワークフィルタリング レースコンディション修正 - 要件定義

## 概要

同一の`environmentId`で複数のセッションが同時に起動されたとき、`applyFilter`内の
`_removeChain + iptables-restore`がアトミックでないため、iptablesチェインが一時的に
存在しない状態が発生するレースコンディションを修正する。

## 問題の詳細

### 発生条件

1. 同一`environmentId`に紐付く複数のセッションがほぼ同時に起動される
2. 各セッション起動時に`applyFilter(environmentId, subnet)`が呼ばれる
3. `applyFilter`内部では：
   - 既存チェインの削除（`removeFilterChain`）
   - 新しいチェインの設定（`setupFilterChain`）
   という非アトミックな操作が行われる

### 問題の影響

- iptablesチェインが一時的に存在しない状態が発生（セキュリティホール）
- iptablesコマンドの競合によるエラー発生
- コンテナのネットワーク制御が不安定になる

## ユーザーストーリー

**US-194**: ネットワークフィルタリングの競合防止

**As** システム管理者
**I want** 同一環境で複数セッションが同時に起動されても、ネットワークフィルタリングが
正しく適用される
**So that** セキュリティポリシーが常に有効な状態を保てる

## 機能要件

| 要件ID | 概要 | 優先度 |
|--------|------|--------|
| REQ-194-001 | 同一environmentIdに対するapplyFilter/removeFilterの直列化 | 高 |
| REQ-194-002 | 直列化によりiptablesチェインの一時的消滅を防ぐ | 高 |
| REQ-194-003 | 異なるenvironmentId間では並列実行を維持する | 中 |
| REQ-194-004 | mutex解放後のメモリリークを防ぐ | 中 |

## 非機能要件

- 外部ライブラリを追加しない（Promise-based lockingのみ使用）
- 既存の`applyFilter`/`removeFilter`内部ロジックを変更しない
- 直列化によるパフォーマンス影響を最小限にする（異なるenvironmentId間は影響なし）

## スコープ

### スコープ内

- `NetworkFilterService.applyFilter`のmutex化
- `NetworkFilterService.removeFilter`のmutex化
- `environmentId`ごとのmutex管理（Map使用）
- メモリリーク防止（最後のpromise解放後にMapから削除）

### スコープ外

- `IptablesManager`内部のアトミック性保証
- DBアクセスの直列化（影響なし）
- 他サービスの競合制御

## 関連

- Issue #194: https://github.com/windschord/claude-work/issues/194
- 元の実装: `src/services/network-filter-service.ts`
- 関連設計: `docs/sdd/design/network-filtering/index.md`
