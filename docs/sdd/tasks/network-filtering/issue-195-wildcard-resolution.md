# タスク: Issue #195 - ワイルドカードドメイン解決の改善

## タスク概要

| 項目 | 内容 |
|------|------|
| ステータス | IN_PROGRESS |
| 優先度 | Medium |
| 担当フェーズ | Phase-1（単一フェーズ） |
| 推定工数 | 1日 |
| 関連Issue | #195 |

## タスクリスト

### Phase-1: ワイルドカードドメイン解決の改善実装

| ID | タスク | ステータス | 依存 |
|----|--------|-----------|------|
| TASK-001 | TDD: テストを先に作成（失敗確認） | IN_PROGRESS | なし |
| TASK-002 | 実装: KNOWN_SERVICE_CIDRS定数定義 | TODO | TASK-001 |
| TASK-003 | 実装: SERVICE_SPECIFIC_SUBDOMAINS定数定義 | TODO | TASK-001 |
| TASK-004 | 実装: resolveWildcardDomainメソッド拡張 | TODO | TASK-002, TASK-003 |
| TASK-005 | 実装: NetworkRuleFormのヘルプテキスト更新 | TODO | なし |
| TASK-006 | テスト実行・確認 | TODO | TASK-004, TASK-005 |

## タスク詳細

### TASK-001: TDD - テストを先に作成

**ステータス**: IN_PROGRESS

**対象ファイル**: `src/services/__tests__/network-filter-service.test.ts`

**追加するテストケース**:
1. `github.com` ワイルドカードでサービス固有サブドメインが解決される
2. `github.com` ワイルドカードで既知CIDRが含まれる
3. `githubusercontent.com` ワイルドカードで固有サブドメインとCIDRが含まれる
4. `npmjs.org` ワイルドカードで `registry` サブドメインが解決される
5. 未知ドメインでCIDR追加なしで動作する

**受入基準**:
- [ ] テストを実行すると失敗する（実装前のred状態）
- [ ] テストケースが要件の受入基準を網羅している

### TASK-002, TASK-003, TASK-004: 実装

**ステータス**: TODO

**対象ファイル**: `src/services/network-filter-service.ts`

**変更内容**:
1. `KNOWN_SERVICE_CIDRS` 定数を `COMMON_SUBDOMAINS` 付近に追加
2. `SERVICE_SPECIFIC_SUBDOMAINS` 定数を追加
3. `resolveWildcardDomain` メソッドにサービス固有サブドメインとCIDRの処理を追加

**受入基準**:
- [ ] TASK-001で作成したテストがすべてパスする
- [ ] 既存テストが引き続きパスする

### TASK-005: UIヘルプテキスト更新

**ステータス**: TODO

**対象ファイル**: `src/components/environments/NetworkRuleForm.tsx`

**変更内容**:
- ワイルドカード入力時のヘルプテキストにDNS解決の制限とCIDR推奨を追記

**受入基準**:
- [ ] ヘルプテキストにDNS解決の制限について記載される
- [ ] CIDR形式の使用が推奨されることが明示される

### TASK-006: テスト実行・確認

**ステータス**: TODO

**実行内容**:
```bash
npx vitest run src/services/__tests__/network-filter-service.test.ts
npx vitest run
```

**受入基準**:
- [ ] 追加したテストがすべてパスする
- [ ] 既存テストが引き続きパスする

## 完了サマリー

（完了後に記載）

## 関連ドキュメント

- [要件定義書](../../requirements/network-filtering/issue-195-wildcard-resolution.md)
- [設計書](../../design/network-filtering/issue-195-wildcard-resolution.md)
