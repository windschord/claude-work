# Docker環境ネットワークフィルタリング - タスク一覧

## 概要

Docker環境のネットワークフィルタリング機能を実装するためのタスク管理。

- **要件定義**: [docs/sdd/requirements/network-filtering/](../../requirements/network-filtering/index.md)
- **技術設計**: [docs/sdd/design/network-filtering/](../../design/network-filtering/index.md)

## 進捗サマリ

### Phase 1-4: 旧iptables方式（完了・一部廃止）

| フェーズ | タスク数 | 完了 | 廃止 |
|---------|---------|------|------|
| Phase 1: 基盤構築 | 3 | 3 | 1（TASK-002: IptablesManager） |
| Phase 2: コアサービス | 3 | 3 | 2（TASK-005, TASK-006: 部分廃止） |
| Phase 3: API・Docker Compose対応 | 3 | 3 | 0 |
| Phase 4: UI・統合テスト | 3 | 3 | 1（TASK-012: 部分廃止） |

### Phase 5-6: Proxy方式（新規）

| フェーズ | タスク数 | 完了 | 進行中 | TODO |
|---------|---------|------|--------|------|
| Phase 5: Proxy基盤構築 | 3 | 1 | 0 | 2 |
| Phase 6: Proxy統合 | 3 | 0 | 0 | 3 |
| **合計** | **6** | **1** | **0** | **5** |

## タスク一覧

### Phase 1-4: 旧iptables方式（略）

> 旧Phase 1-4の詳細は Git履歴を参照。TASK-001~012は全て完了済み。iptables関連コンポーネント（IptablesManager、applyFilter、removeFilter等）はPR#217で削除済み。

### Phase 5: Proxy基盤構築

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-013 | ProxyClient新規作成 | DONE | なし | 40min | [詳細](phase-5/TASK-013.md) @phase-5/TASK-013.md |
| TASK-014 | NetworkFilterServiceのDNS解決機能削除 | TODO | なし | 20min | [詳細](phase-5/TASK-014.md) @phase-5/TASK-014.md |
| TASK-015 | docker-compose.ymlにproxyサービスとinternalネットワーク追加 | TODO | なし | 20min | [詳細](phase-5/TASK-015.md) @phase-5/TASK-015.md |

### Phase 6: Proxy統合

| ID | タイトル | ステータス | 依存 | 推定工数 | 詳細 |
|----|---------|-----------|------|---------|------|
| TASK-016 | DockerAdapterのフィルタリング統合 | TODO | TASK-013 | 40min | [詳細](phase-6/TASK-016.md) @phase-6/TASK-016.md |
| TASK-017 | ルール変更時のproxy同期（API層） | TODO | TASK-013, TASK-016 | 40min | [詳細](phase-6/TASK-017.md) @phase-6/TASK-017.md |
| TASK-018 | 通信テスト機能のproxy経由実テスト化 | IN_PROGRESS | TASK-013, TASK-014 | 30min | [詳細](phase-6/TASK-018.md) @phase-6/TASK-018.md |

## 並列実行グループ

### グループA（最初に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-013 | src/services/proxy-client.ts（新規） | なし |
| TASK-014 | src/services/network-filter-service.ts（修正） | なし |
| TASK-015 | docker-compose.yml, docs/ENV_VARS.md | なし |

### グループB（TASK-013完了後に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-016 | src/services/adapters/docker-adapter.ts | TASK-013 |
| TASK-018 | src/services/network-filter-service.ts（testConnection修正） | TASK-013, TASK-014 |

### グループC（TASK-016完了後）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-017 | src/lib/proxy-sync.ts（新規）, src/app/api/**（修正） | TASK-013, TASK-016 |

## upstream依存

以下のupstream Issue が完了しないと本番環境での動作確認ができない（開発・テストは可能）:

- [network-filter-proxy #5](https://github.com/windschord/network-filter-proxy/issues/5): API_BIND_ADDR環境変数
- [network-filter-proxy #6](https://github.com/windschord/network-filter-proxy/issues/6): healthcheckサブコマンド

## 逆順レビュー結果

### タスク -> 設計 の整合性

| 設計コンポーネント | カバーするタスク | 状態 |
|------------------|----------------|------|
| ProxyClient | TASK-013 | OK |
| Docker Compose Proxy構成 | TASK-015 | OK |
| NetworkFilterService（DNS削除） | TASK-014 | OK |
| DockerAdapter（フィルタ統合） | TASK-016 | OK |
| ルール変更時の同期 | TASK-017 | OK |
| 通信テスト（proxy経由） | TASK-018 | OK |

### 設計 -> 要件 の整合性

| 要件ID | 概要 | カバーするタスク | 状態 |
|--------|------|----------------|------|
| REQ-001 | ルール管理CRUD | 既存（TASK-001,003,007,010） | 維持 |
| REQ-002 | ワイルドカード | proxy側でサポート | 維持 |
| REQ-003 | 環境ごと個別管理 | 既存 | 維持 |
| REQ-004 | コンテナ起動時自動適用 | TASK-016 | 新規対応 |
| REQ-005 | ~~iptables~~ -> proxy方式 | TASK-013, TASK-016 | 代替実装 |
| REQ-006 | テンプレート | 既存 | 維持 |
| REQ-007 | モニタリング・テスト | TASK-018 | 新規対応 |
| REQ-008 | Docker Compose対応 | TASK-015 | 新規対応 |
| NFR-SEC | セキュリティ | TASK-015（internal NW）, TASK-016（CapDrop維持） | 新規対応 |
