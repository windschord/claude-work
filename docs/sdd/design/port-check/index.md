# 設計書: ポートマッピング設定時のポート使用状況チェック

## 概要

Docker環境のポートマッピング設定時に、HOST側ポートの使用状況をリアルタイムにチェックし、ユーザーに警告を表示する機能の技術設計。

## アーキテクチャ概要

```text
[PortMappingList] --fetch--> [POST /api/environments/check-ports] --call--> [PortChecker]
                                                                                  |
                                                              +-------------------+-------------------+
                                                              |                                       |
                                                    [checkHostPort]                     [checkClaudeWorkPorts]
                                                    net.createServer()                   DB query
```

> **Note**: コンテナ内ポートチェック（`docker exec` 経由）は将来の拡張として検討中。現在のスコープではHOST側ポートとClaudeWork環境間の競合検出のみ実装。

### 処理フロー

1. ユーザーがポートマッピングを入力し「チェック」ボタンをクリック
2. フロントエンドが `POST /api/environments/check-ports` にリクエスト送信
3. APIが `PortChecker` サービスを呼び出し
4. PortCheckerが以下を並行実行:
   - HOST側ポートバインド試行（`net.createServer()`、500msタイムアウト付き）
   - ClaudeWork内他環境のポート設定との照合（DB検索）
5. 結果を集約してレスポンス返却
6. フロントエンドが各ポートの状態アイコンを更新

## コンポーネント一覧

| コンポーネント | 種別 | 詳細リンク |
|--------------|------|-----------|
| PortChecker | バックエンドサービス | [詳細](components/port-checker.md) |
| check-ports API | APIエンドポイント | [詳細](api/check-ports.md) |
| PortMappingList拡張 | フロントエンドUI | [詳細](components/port-mapping-list.md) |

## 要件トレーサビリティ

| 要件ID | 設計要素 | 対応コンポーネント |
|--------|---------|-----------------|
| REQ-001-001 | checkHostPort() | PortChecker |
| REQ-001-002 | checkClaudeWorkPorts() | PortChecker |
| REQ-001-003 | checkPorts() 一括チェック | PortChecker |
| REQ-001-004 | タイムアウト設定500ms | PortChecker |
| REQ-001-005 | try-catch + unknown状態 | PortChecker |
| REQ-002-001 | checkContainerPort()（未実装・将来拡張） | PortChecker |
| REQ-002-002 | コンテナ未起動時スキップ（未実装・将来拡張） | PortChecker |
| REQ-002-003 | docker exec失敗時unknown（未実装・将来拡張） | PortChecker |
| REQ-003-001 | POST /api/environments/check-ports | check-ports API |
| REQ-003-002 | isChecking state + Loader2 | PortMappingList |
| REQ-003-003 | CheckCircle2（緑）アイコン | PortMappingList |
| REQ-003-004 | AlertCircle（赤）アイコン | PortMappingList |
| REQ-003-005 | HelpCircle（グレー）アイコン | PortMappingList |
| NFR-PERF-001 | Promise.all並行実行 | PortChecker |
| NFR-PERF-002 | タイムアウト設定500ms | PortChecker |
| NFR-USE-001 | isChecking state | PortMappingList |
| NFR-USE-002 | 色・アイコンによる状態表示 | PortMappingList |

## 依存関係

### 新規ファイル
- `src/services/port-checker.ts`
- `src/app/api/environments/check-ports/route.ts`

### 変更ファイル
- `src/components/environments/PortMappingList.tsx`
- `src/components/environments/EnvironmentForm.tsx`（excludeEnvironmentId props追加のみ）
