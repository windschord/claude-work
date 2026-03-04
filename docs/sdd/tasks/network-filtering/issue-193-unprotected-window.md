# タスク: ネットワークフィルタリング無保護ウィンドウの修正 (Issue #193)

## タスク概要

| 項目 | 内容 |
|------|------|
| ID | TASK-193 |
| 要件 | [docs/sdd/requirements/network-filtering/issue-193-unprotected-window.md](../../requirements/network-filtering/issue-193-unprotected-window.md) |
| 設計 | [docs/sdd/design/network-filtering/issue-193-unprotected-window.md](../../design/network-filtering/issue-193-unprotected-window.md) |
| ステータス | DONE |
| 優先度 | High |
| 推定工数 | 60min |
| 依存 | なし |

## 背景

コンテナ起動（container.start()）からiptablesフィルタ適用（applyFilter()）完了までの間、コンテナはネットワークアクセスが無制限な無保護ウィンドウが存在する。

## 実装内容

### Phase 1: NetworkFilterService に isFilterEnabled() 追加

**ファイル**: `src/services/network-filter-service.ts`

フィルタリングの有効/無効を確認するヘルパーメソッドを追加。

受入基準:
- [x] `isFilterEnabled(environmentId)` メソッドが実装されている
- [x] フィルタリング設定が存在してenabledがtrueの場合にtrueを返す
- [x] フィルタリング設定が存在しない場合にfalseを返す
- [x] フィルタリング設定が存在してもenabledがfalseの場合にfalseを返す

### Phase 2: テスト追加（TDD - 先にテストを書く）

**ファイル**: `src/services/adapters/__tests__/docker-adapter-filter.test.ts`

新規テストケース:
- [x] フィルタリング有効時はNetworkModeがnoneに設定される
- [x] フィルタリング有効時はbridgeネットワークに接続される
- [x] フィルタリング有効時はbridge接続後にapplyFilterが呼ばれる（順序確認）
- [x] bridge接続失敗時はコンテナをクリーンアップする
- [x] フィルタリング無効時はNetworkModeがデフォルト（未設定）
- [x] フィルタリング無効時はbridge接続は実施されない

### Phase 3: DockerAdapter の createSession() 修正

**ファイル**: `src/services/adapters/docker-adapter.ts`

修正内容:
- [x] container.start()前にisFilterEnabled()でフィルタリング有効チェック
- [x] フィルタリング有効時はNetworkMode: 'none'をcreateOptionsに設定
- [x] container.start()後にbridgeネットワークに接続
- [x] bridge接続後にgetContainerSubnet()とapplyFilter()を実行
- [x] bridge接続エラーのハンドリング（コンテナクリーンアップ含む）
- [x] フィルタリング無効時は既存フローを維持

## 受入基準（全体）

- [x] フィルタリング有効時: container.start()時点でNetworkMode='none'のためネットワーク通信不可
- [x] フィルタリング有効時: iptablesルール適用後にbridgeネットワーク接続
- [x] フィルタリング無効時: 既存の動作を維持（NetworkMode未設定、bridge接続なし）
- [x] 全テストがパスすること
- [x] 既存テストが壊れていないこと

## テスト実行手順

```bash
# フィルタリングテストのみ
npx vitest run src/services/adapters/__tests__/docker-adapter-filter.test.ts

# 全テスト
npx vitest run
```

## 完了サマリー

NetworkMode='none'で起動 + bridge接続方式による無保護ウィンドウ修正を実装。isFilterEnabled()ヘルパーを追加し、フィルタリング有効時のみNetworkMode変更・bridge接続を行う。既存テスト含む全テストがパス。

## 関連情報

- Issue: #193
- ブランチ: fix/issue-193-network-filter-unprotected-window
- 参考PR: #185 (ネットワークフィルタリング機能追加)
