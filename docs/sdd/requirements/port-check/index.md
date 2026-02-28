# 要件定義: ポートマッピング設定時のポート使用状況チェック

## 概要

環境のポートマッピング設定時に、HOST側とコンテナ側のポート使用状況をチェックし、競合を事前に検出する機能を提供する。現在のバリデーション（docker-config-validator.ts）は範囲チェックと重複チェックのみであり、ポートが実際に使用中かどうかは検証しない。コンテナ起動時に初めてバインドエラーが発生する問題を解決する。

**変更の目的**:
- 環境作成/編集時にポート競合を事前に検出し、ユーザーに警告する
- コンテナ起動失敗の原因を事前に排除する
- 他のClaudeWork環境で既に使用中のポートとの競合を検出する

**スコープ**:
- HOST側ポートの使用状況チェック（`net.createServer()` によるバインド試行）
- ClaudeWork内の他環境で設定済みホストポートとの競合検出
- コンテナ内ポート使用状況の確認（`docker exec` 経由）
- ポートチェック用APIエンドポイントの追加
- EnvironmentFormでのポート使用状況表示

**スコープ外**:
- ポートの自動割り当て/推薦機能
- リモートホストのポートチェック
- ファイアウォールルールの検証
- ポート使用状況の定期監視/通知

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | リンク |
|----|----------|--------|-----------|--------|
| US-001 | HOST側ポート使用状況チェック | 高 | TODO | [詳細](stories/US-001.md) |
| US-002 | コンテナ側ポート使用状況チェック | 中 | TODO | [詳細](stories/US-002.md) |
| US-003 | ポート使用状況のUI表示 | 高 | TODO | [詳細](stories/US-003.md) |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー |
|--------|------|--------------|
| REQ-001-001 | net.createServer()でHOSTポートバインド試行 | US-001 |
| REQ-001-002 | ClaudeWork内他環境のポート競合検出 | US-001 |
| REQ-001-003 | 複数ポート一括チェック | US-001 |
| REQ-001-004 | 1ポートあたり500msタイムアウト | US-001 |
| REQ-001-005 | エラー時はunknownステータスを返す | US-001 |
| REQ-002-001 | docker execでコンテナ内ポートチェック | US-002 |
| REQ-002-002 | コンテナ未起動時の適切なハンドリング（スキップ） | US-002 |
| REQ-002-003 | コンテナ側チェックはオプション扱い | US-002 |
| REQ-003-001 | ポートチェック用APIエンドポイント（POST /api/environments/check-ports） | US-003 |
| REQ-003-002 | チェック中はローディングアイコンを表示 | US-003 |
| REQ-003-003 | 使用可能ポートは緑のチェックアイコンで表示 | US-003 |
| REQ-003-004 | 使用中ポートは赤のアラートアイコンで表示 | US-003 |
| REQ-003-005 | 未確認ポートはグレーの疑問符アイコンで表示 | US-003 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| 性能要件 | [詳細](nfr/performance.md) | 2件 |
| ユーザビリティ要件 | [詳細](nfr/usability.md) | 2件 |

## 依存関係

### 既存機能
- docker-config-validator.ts: 既存のvalidatePortMappings()（同期版）
- EnvironmentForm.tsx: 環境作成/編集フォーム
- PortMappingList.tsx: ポートマッピングリストUI
- environment-service.ts: 環境CRUD操作
- docker-adapter.ts: DockerAdapterConfig（portMappings含む）

### 影響範囲
- `src/services/port-checker.ts`: 新規作成
- `src/app/api/environments/check-ports/route.ts`: 新規APIエンドポイント
- `src/components/environments/PortMappingList.tsx`: チェック結果のUI表示
- `src/components/environments/EnvironmentForm.tsx`: excludeEnvironmentId props追加
