# 設計書: Chrome Sidecar MCP環境

## アーキテクチャ概要

Docker環境のセッション起動時に、セッション専用のChromeサイドカーコンテナを自動起動し、Chrome DevTools MCP経由でClaude Codeからブラウザ操作を可能にする。既存のPR#186（単一コンテナ方式: Chromiumを同梱した拡張イメージ）と共存し、環境設定で切り替え可能にする。

```
Session起動フロー (サイドカー有効時):

+-------------------+         +------------------+         +-------------------+
|  ClaudeWork App   |-------->|  Docker Engine   |-------->| cw-net-<sid>      |
|  (DockerAdapter)  |         |  (Dockerode)     |         | (Bridge Network)  |
+-------------------+         +------------------+         +-------------------+
                                      |                           |
                              +-------+-------+           +------+------+
                              |               |           |             |
                        +-----------+   +-----------+    (接続)       (接続)
                        | Chrome    |   | Claude    |     |             |
                        | Container |   | Container |-----+             |
                        | (CDP)     |   | (sandbox) |                   |
                        +-----------+   +-----------+-------------------+
                              |
                         CDP:9222
                         (内部通信)
```

### 既存アーキテクチャとの関係

| 方式 | コンポーネント | 説明 |
|------|--------------|------|
| 単一コンテナ (PR#186) | 拡張Dockerイメージ | Chromiumを同梱、プロセスレベル分離 |
| サイドカー (本設計) | 別コンテナ + ブリッジネットワーク | コンテナレベル分離、独立リソース管理 |

サイドカーが無効（デフォルト）の場合、従来通りPR#186の単一コンテナ方式で動作する。

## コンポーネント一覧

| コンポーネント | 説明 | 詳細リンク |
|---------------|------|------------|
| ChromeSidecarService | サイドカーChrome起動・停止・ヘルスチェック | [詳細](components/chrome-sidecar-service.md) |
| DockerAdapter拡張 | サイドカー連携の統合 | [詳細](components/docker-adapter.md) |
| DBスキーマ拡張 | Sessionテーブル・config JSON拡張 | [詳細](components/db-schema.md) |
| 環境設定UI拡張 | サイドカー設定フォーム | [詳細](components/environment-ui.md) |

## API一覧

| エンドポイント | 説明 | 詳細リンク |
|--------------|------|------------|
| Environment API拡張 | chromeSidecar config バリデーション | [詳細](api/environment-api.md) |
| Session API拡張 | chrome_debug_port レスポンス追加 | [詳細](api/session-api.md) |

## シーケンス図

| シーケンス | 説明 | 詳細リンク |
|-----------|------|------------|
| セッション起動 | サイドカー付きセッション起動フロー | [詳細](sequences/session-startup.md) |
| セッション破棄 | サイドカー付きセッション破棄フロー | [詳細](sequences/session-teardown.md) |
| クリーンアップ | 孤立リソースのクリーンアップ | [詳細](sequences/cleanup.md) |

## 要件トレーサビリティ

| 要件ID | 設計要素 | 対応方法 |
|--------|---------|---------|
| REQ-001-001 | ChromeSidecarService | ネットワーク作成 + Chromeコンテナ起動 |
| REQ-001-002 | ChromeSidecarService + DockerAdapter | Claude Codeコンテナを同一ネットワークに接続 |
| REQ-001-003 | DockerAdapter拡張 | `.mcp.json`へのbrowserUrl注入 |
| REQ-001-004 | ChromeSidecarService | CDPヘルスチェック (最大30秒)、タイムアウト時はサイドカーなしで起動 |
| REQ-002-001 | DockerAdapter拡張 | destroySessionでChrome停止 -> ネットワーク削除 |
| REQ-002-002 | ChromeSidecarService | サーバー起動時の孤立リソースクリーンアップ |
| REQ-002-003 | DBスキーマ拡張 | chrome_container_id, chrome_debug_portカラム追加 |
| REQ-003-001 | 環境設定UI拡張 | Chrome Sidecarトグル |
| REQ-003-002 | 環境設定UI拡張 | Chrome Image/Tagフィールド |
| REQ-003-003 | DockerAdapter拡張 | chromeSidecar未設定時は既存動作維持 |
| REQ-004-001 | ChromeSidecarService | CDP 9222を127.0.0.1:*に動的マッピング |
| REQ-004-002 | Session API拡張 + UI | chrome_debug_portをレスポンスに含める |
| REQ-004-003 | Session API | 表示は全ユーザーに許可（現状認証機能なし） |
| NFR-SEC-001 | ChromeSidecarService | CapDrop ALL, no-new-privileges, HostIp 127.0.0.1 |
| NFR-SEC-002 | ChromeSidecarService | セッション専用ネットワークで隔離 |
| NFR-RES-001 | ChromeSidecarService | メモリ制限512MB |
| NFR-RES-002 | ChromeSidecarService | CDPヘルスチェック30秒タイムアウト |
| NFR-RES-003 | ChromeSidecarService | サイドカー数をログ記録 |

## エラーハンドリング方針

| エラー種別 | 対応方針 | 根拠 |
|-----------|---------|------|
| ネットワーク作成失敗 | セッション作成をエラーとして中止、作成途中のリソースをロールバック | NFR-SEC-002 |
| Chromeコンテナ起動失敗 | ネットワーク削除後、サイドカーなしでClaude Code起動 | REQ-001-004 |
| CDPヘルスチェックタイムアウト | Chromeコンテナ停止、ネットワーク削除後、サイドカーなしで起動 | NFR-RES-002 |
| ポートマッピング失敗 | サイドカーChromeをホストポートなしで起動、chrome_debug_port=NULL | REQ-004-001 |
| .mcp.json注入失敗 | 警告ログ出力、セッション起動は続行 | graceful degradation |
| Chrome停止失敗（破棄時） | force-kill試行、container_id保持で次回クリーンアップ | 既存パターン踏襲 |
| ネットワーク削除失敗（破棄時） | 警告ログ出力、次回クリーンアップで回収 | REQ-002-002 |

## 技術的決定事項

| 決定 | 選択 | 代替案 | 理由 |
|------|------|--------|------|
| サイドカー管理 | 専用サービスクラス (ChromeSidecarService) | DockerAdapterに直接実装 | 責務分離。DockerAdapterは既に大きく、サイドカーロジックを分離することで保守性向上 |
| ネットワーク管理 | セッション単位Dockerブリッジ | 共有ネットワーク | セッション間の完全隔離 (NFR-SEC-002) |
| .mcp.json注入 | Claude Codeコンテナ起動時にEntrypointスクリプトで注入 | Volume経由でホストから注入 | コンテナ内のリポジトリパスに書き込む必要があるため、コンテナ内実行が自然 |
| CDPヘルスチェック | HTTP GET /json/version をポーリング | docker exec でChrome内部チェック | CDPプロトコル準拠、外部からの到達性を確認できる |
| Chromeイメージ | chromium/headless-shell (デフォルト) | browserless/chrome | ライセンス問題なし、軽量、公式イメージ |
