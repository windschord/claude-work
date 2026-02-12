# 技術設計書: セッション管理の包括的改善

## 設計概要

本設計書は、ClaudeWorkプロジェクトにおけるセッション管理の包括的改善の技術設計を定義します。要件定義書（[docs/requirements/index.md](../requirements/index.md) @../requirements/index.md）に基づき、以下の4つの主要な改善を実現します：

1. **WebSocket接続管理の統一**: ConnectionManagerを全WebSocketタイプで使用し、接続プールを一元管理
2. **PTYSessionManagerの導入**: PTYセッションとWebSocket接続を統合管理する新しい抽象化層
3. **Docker環境の安定化**: コンテナライフサイクル管理の改善とエラーハンドリングの強化
4. **状態管理の統一**: セッション状態のデータベース永続化とサーバー再起動時の復元

## アーキテクチャ概要

### 現在のアーキテクチャ

```text
[ブラウザ] --WebSocket--> [WebSocketハンドラー] --> [PTYManager/ClaudePTYManager]
                                                              |
                                                              v
                                                         [node-pty]

問題:
- WebSocket接続管理が分散（Session/Claude/Terminal）
- PTYセッション管理も分散（ClaudePTYManager/PTYManager）
- 状態がメモリに分散（activeConnections, destroyTimers等）
- イベントハンドラーが接続ごとに重複登録
```

### 改善後のアーキテクチャ

```text
[ブラウザ] --WebSocket--> [WebSocketハンドラー]
                                  |
                                  v
                          [ConnectionManager]
                                  |
                                  v
                        [PTYSessionManager]
                         /      |      \
                        /       |       \
                       /        |        \
         [HostAdapter] [DockerAdapter] [SSHAdapter]
                       \        |        /
                        \       |       /
                         \      |      /
                          [node-pty]
                              |
                              v
                        [データベース]
                  (セッション状態の永続化)

改善点:
- ConnectionManagerで全WebSocket接続を一元管理
- PTYSessionManagerで全PTYセッションを統合管理
- 状態をデータベースに永続化
- イベントハンドラーはPTYセッション単位で1つのみ
```

### レイヤー構造

| レイヤー | 責務 | 主要コンポーネント |
|---------|------|------------------|
| **プレゼンテーション層** | WebSocket通信、クライアント接続管理 | WebSocketハンドラー (claude-ws, terminal-ws, session-ws) |
| **接続管理層** | 接続プール管理、ブロードキャスト | ConnectionManager |
| **セッション管理層** | PTYセッションライフサイクル管理 | PTYSessionManager |
| **アダプター層** | 環境固有の処理（HOST/DOCKER/SSH） | HostAdapter, DockerAdapter, SSHAdapter |
| **PTY層** | ターミナルセッション実行 | node-pty (IPty) |
| **永続化層** | セッション状態の保存・復元 | Prisma, SQLite |

## 主要コンポーネント

| コンポーネント | ファイルパス | 説明 | リンク |
|--------------|-------------|------|--------|
| ConnectionManager | src/lib/websocket/connection-manager.ts | WebSocket接続プール管理（拡張） | [詳細](components/connection-manager.md) @components/connection-manager.md |
| PTYSessionManager | src/services/pty-session-manager.ts | PTYセッション統合管理（新規） | [詳細](components/pty-session-manager.md) @components/pty-session-manager.md |
| DockerAdapter | src/services/adapters/docker-adapter.ts | Docker環境アダプター（改善） | [詳細](components/docker-adapter.md) @components/docker-adapter.md |
| ClaudeWebSocket | src/lib/websocket/claude-ws.ts | Claude WebSocketハンドラー（修正） | [ソース](../../src/lib/websocket/claude-ws.ts) |
| TerminalWebSocket | src/lib/websocket/terminal-ws.ts | Terminal WebSocketハンドラー（修正） | [ソース](../../src/lib/websocket/terminal-ws.ts) |
| SessionDatabase | prisma/schema.prisma | セッション状態永続化（拡張） | [詳細](database/schema.md) @database/schema.md |

## データフロー

### セッション作成フロー

```text
1. [ユーザー] --POST /api/sessions--> [APIハンドラー]
2. [APIハンドラー] --createSession()--> [PTYSessionManager]
3. [PTYSessionManager] --getAdapter()--> [AdapterFactory]
4. [AdapterFactory] --return--> [HostAdapter or DockerAdapter]
5. [Adapter] --spawn()--> [node-pty]
6. [PTYSessionManager] --create--> [ConnectionManager: 接続プール]
7. [PTYSessionManager] --registerHandler()--> [node-pty: データイベント]
8. [PTYSessionManager] --saveState()--> [データベース]
9. [PTYSessionManager] --return SessionID--> [APIハンドラー]
```

### WebSocket接続フロー

```text
1. [ブラウザ] --WebSocket接続--> [WebSocketハンドラー]
2. [WebSocketハンドラー] --getSession()--> [PTYSessionManager]
3. [PTYSessionManager] --addConnection()--> [ConnectionManager]
4. [ConnectionManager] --sendScrollback()--> [ブラウザ]
5. [node-pty] --data event--> [PTYSessionManager: ハンドラー]
6. [PTYSessionManager] --broadcast()--> [ConnectionManager]
7. [ConnectionManager] --send to all--> [すべてのブラウザ]
```

### セッション破棄フロー

```text
1. [ユーザー] --DELETE /api/sessions/:id--> [APIハンドラー]
2. [APIハンドラー] --destroySession()--> [PTYSessionManager]
3. [PTYSessionManager] --removeAllConnections()--> [ConnectionManager]
4. [PTYSessionManager] --kill()--> [node-pty]
5. [PTYSessionManager] --cleanup()--> [Adapter]
6. [PTYSessionManager] --updateState()--> [データベース]
7. [PTYSessionManager] --deleteWorktree()--> [GitService]
```

## 技術的決定事項

| ID | タイトル | 優先度 | 状態 | リンク |
|----|---------|--------|-----|--------|
| DEC-001 | ConnectionManagerの拡張設計 | 最高 | 承認済 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | PTYSessionManagerのシングルトンパターン | 高 | 承認済 | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |
| DEC-003 | イベントハンドラーの登録戦略 | 最高 | 承認済 | [詳細](decisions/DEC-003.md) @decisions/DEC-003.md |
| DEC-004 | 状態永続化の戦略 | 高 | 承認済 | [詳細](decisions/DEC-004.md) @decisions/DEC-004.md |
| DEC-005 | Docker起動待機メカニズム | 中 | 承認済 | [詳細](decisions/DEC-005.md) @decisions/DEC-005.md |

## データベース設計

データベーススキーマの変更については、[database/schema.md](database/schema.md) @database/schema.md を参照してください。

### 主要な変更
- `Session`モデルへの状態フィールド追加：
  - `active_connections`: アクティブな接続数
  - `destroy_at`: 自動破棄予定時刻
  - `last_active_at`: 最終アクティブ時刻
  - `status`: セッション状態（ACTIVE, IDLE, ERROR, TERMINATED）

## 非機能要件への対応

### パフォーマンス（NFR-PERF）
- **メッセージ配信遅延 < 100ms**: ブロードキャスト実装の最適化
- **セッション作成時間 < 3秒（HOST）**: 非同期処理、並列化
- **メモリ使用量 < 100MB/セッション**: イベントリスナーの確実なクリーンアップ

### 信頼性（NFR-REL）
- **システム稼働率 > 99%**: エラーハンドリング強化、自動復旧
- **データ損失率 < 1%**: 状態の永続化、トランザクション使用
- **復旧時間 < 10秒**: サーバー起動時の状態復元

### 保守性（NFR-MAINT）
- **テストカバレッジ > 80%**: 単体テスト、統合テスト、E2Eテスト
- **複雑度 < 15**: 関数の分割、責務の明確化
- **コメント密度 10-30%**: 複雑なロジックへのコメント

## 実装フェーズ

実装は以下の順序で段階的に行います（依存関係に基づく）：

### Phase 1: WebSocket接続管理の統一（US-001）
**期間**: 3日
**依存**: なし

1. ConnectionManagerの拡張
2. claude-ws.tsの修正
3. terminal-ws.tsの修正
4. テスト作成

**成果物**:
- 接続プールの一元管理
- イベントハンドラーの単一登録
- ブロードキャスト機能

### Phase 2: PTYセッションマネージャーの導入（US-002）
**期間**: 5日
**依存**: US-001完了

1. PTYSessionManagerの作成
2. ClaudePTYManagerのリファクタリング
3. PTYManagerのリファクタリング
4. WebSocketハンドラーの変更
5. テスト作成

**成果物**:
- PTYセッションの統合管理
- ライフサイクル管理の明確化
- モック可能なインターフェース

### Phase 3: Docker環境の安定化（US-003）
**期間**: 3日
**依存**: US-001完了（US-002と並行可能）

1. コンテナ起動待機の実装
2. `docker stop`のPromise化
3. 親コンテナID永続化
4. リサイズ処理改善
5. テスト作成

**成果物**:
- コンテナライフサイクルの改善
- エラーハンドリングの強化
- 孤立コンテナのクリーンアップ

### Phase 4: 状態管理の統一（US-004）
**期間**: 3-4日
**依存**: US-002完了

1. データベーススキーマ拡張
2. 状態永続化ロジック実装
3. サーバー起動時の復元処理
4. 孤立セッションクリーンアップ
5. テスト作成

**成果物**:
- セッション状態の永続化
- サーバー再起動時の復元
- 状態整合性の保証

## テスト戦略

### 単体テスト（Vitest）
- **対象**: 各コンポーネントの個別機能
- **カバレッジ目標**: 85%以上
- **実行時間**: 30秒以内

### 統合テスト（Vitest）
- **対象**: コンポーネント間の連携
- **重点**: WebSocket接続管理、PTYセッション管理
- **実行時間**: 2分以内

### E2Eテスト（Playwright）
- **対象**: ユーザーシナリオの再現
- **重点**: 複数ブラウザでの動作、サーバー再起動
- **実行時間**: 5分以内

### パフォーマンステスト
- **負荷テスト**: 50セッション同時実行
- **長時間稼働テスト**: 24時間稼働
- **メモリリークテスト**: 接続/切断繰り返し

## セキュリティ考慮事項

### WebSocket接続
- **認証**: 既存の認証メカニズムを維持
- **セッション検証**: セッションIDの所有権確認
- **入力検証**: PTYへの入力をサニタイズ

### Docker環境
- **コンテナ隔離**: 各セッションは独立したコンテナで実行
- **リソース制限**: CPU/メモリ制限の設定
- **ネットワーク隔離**: 必要最小限のネットワークアクセス

### データベース
- **SQLインジェクション対策**: Prismaのパラメータ化クエリ使用
- **アクセス制御**: セッション所有者のみがアクセス可能
- **機密情報の保護**: 環境変数、トークンの暗号化

## 運用考慮事項

### モニタリング
- **メトリクス収集**: CPU、メモリ、接続数、エラー率
- **ログ出力**: 構造化ログ（JSON形式）、トレース情報
- **アラート**: エラー率、リソース使用量の閾値監視

### デプロイメント
- **ダウンタイム**: ゼロダウンタイムデプロイ（可能な限り）
- **ロールバック**: 問題発生時の即座のロールバック
- **データベースマイグレーション**: `prisma db push`でスキーマ適用

### バックアップとリカバリ
- **データベースバックアップ**: 日次バックアップ
- **セッションデータ**: Worktreeの定期スナップショット（オプション）
- **復旧手順**: サーバー再起動後の自動復元

## 制約と前提

### 技術的制約
- **Node.js**: 既存のNode.js環境を継続使用
- **node-pty**: 既存のnode-ptyライブラリを継続使用
- **Prisma**: 既存のPrismaスキーマとの互換性維持

### 前提条件
- **開発環境**: Docker Desktopがインストール済み
- **データベース**: SQLiteが利用可能
- **ブラウザ**: モダンブラウザ（Chrome, Firefox, Safari）

## リスクと対策

| リスク | 影響度 | 発生確率 | 対策 | 責任者 |
|-------|--------|---------|------|-------|
| 既存機能の破壊 | 高 | 中 | TDD、段階的リファクタリング | 開発チーム |
| パフォーマンス低下 | 中 | 低 | ベンチマークテスト、最適化 | 開発チーム |
| Docker環境での予期しない挙動 | 中 | 中 | 手動テスト強化、ログ充実 | 開発チーム |
| 実装期間の長期化 | 低 | 中 | 各フェーズを独立したPRで管理 | プロジェクトマネージャー |

## 用語集

| 用語 | 説明 |
|------|------|
| **PTYセッション** | node-ptyによって管理される疑似端末セッション |
| **接続プール** | 1つのPTYセッションに接続された複数のWebSocket接続の集合 |
| **ブロードキャスト** | PTYからの出力を接続プール内の全WebSocket接続に送信すること |
| **スクロールバックバッファ** | 過去の出力を保持し、新規接続時に送信するバッファ |
| **孤立セッション/コンテナ** | PTYプロセスが終了しているが、データベースに記録が残っているセッション/コンテナ |
| **アダプター** | 環境タイプ（HOST/DOCKER/SSH）ごとのPTY管理を抽象化するインターフェース |

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|-----|----------|---------|--------|
| 2026-02-11 | 1.0 | 初版作成 | Claude |

## 参照

- [要件定義書](../requirements/index.md) @../requirements/index.md
- [既存アーキテクチャ](../../CLAUDE.md) @../../CLAUDE.md
- [Prismaスキーマ](../../prisma/schema.prisma) @../../prisma/schema.prisma
