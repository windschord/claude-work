# Docker環境ネットワークフィルタリング - 技術設計

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報
- [x] フィルタリング方式: ホワイトリスト（デフォルト全ブロック）
- [x] ワイルドカード対応: `*.example.com` パターン
- [x] 粒度: ドメイン/IPアドレス + ポート番号
- [x] 適用範囲: 環境(ExecutionEnvironment)ごとに個別設定
- [x] 実装方式: Docker カスタムネットワーク + iptables
- [x] Docker Compose環境との共存が必要
- [x] 技術スタック: 既存プロジェクト準拠（Next.js, TypeScript, SQLite, Drizzle ORM）
- [x] セキュリティ要件: フェイルセーフ（適用失敗時は起動中止）、バイパス防止

### 不明/要確認の情報

全て確認済み。不明な項目はありません。

---

## アーキテクチャ概要

```text
┌─────────────────────────────────────────────────────────────┐
│                     ClaudeWork Server                        │
│                                                              │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────┐ │
│  │  Settings UI  │  │   API Routes      │  │ DockerAdapter│ │
│  │ (Environment  │──│ /api/environments │──│ (Extended)   │ │
│  │  Filter Tab)  │  │ /[id]/rules       │  │              │ │
│  └──────────────┘  └───────────────────┘  └──────┬───────┘ │
│                              │                     │         │
│                    ┌─────────┴─────────┐          │         │
│                    │NetworkFilterService│──────────┘         │
│                    │ (Rule CRUD + DNS)  │                    │
│                    └─────────┬─────────┘                    │
│                              │                               │
│                    ┌─────────┴─────────┐                    │
│                    │  IptablesManager   │                    │
│                    │ (iptables制御)     │                    │
│                    └─────────┬─────────┘                    │
│                              │                               │
│                    ┌─────────┴─────────┐                    │
│                    │     SQLite DB      │                    │
│                    │ NetworkFilterRule   │                    │
│                    └───────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Docker Engine     │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ Custom Network│  │
                    │  │ (filtered)    │  │
                    │  └───────┬───────┘  │
                    │          │          │
                    │  ┌───────┴───────┐  │
                    │  │  Sandbox      │  │
                    │  │  Container    │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
                               │
                      iptables DOCKER-USER chain
                      (ホワイトリストルール適用)
```

### コンテナ起動時のフロー

```text
DockerAdapter.createSession()
  │
  ├── NetworkFilterService.getFilterConfig(environmentId)
  │     └── DB: NetworkFilterRule テーブルからルール取得
  │
  ├── [フィルタリング有効の場合]
  │     ├── IptablesManager.setupFilterChain(envId, rules)
  │     │     ├── DNS解決（ドメイン → IP変換）
  │     │     ├── iptables chain作成 (CWFILTER-<short-id>)
  │     │     ├── DOCKER-USER chainにジャンプルール追加
  │     │     ├── DNS通信(53番)を許可
  │     │     ├── ホワイトリストIPを許可
  │     │     └── デフォルトDROPルール追加
  │     │
  │     ├── Docker カスタムネットワーク作成/取得
  │     └── コンテナをカスタムネットワークに接続
  │
  ├── コンテナ起動（既存フロー）
  │
  └── [フィルタリング無効の場合]
        └── 従来通りのコンテナ起動（変更なし）
```

## コンポーネント一覧

| コンポーネント名 | 目的 | 詳細リンク |
|-----------------|------|-----------|
| NetworkFilterService | フィルタリングルールの管理・DNS解決・フィルタ適用 | [詳細](components/network-filter-service.md) @components/network-filter-service.md |
| IptablesManager | iptablesルールの生成・適用・クリーンアップ | [詳細](components/iptables-manager.md) @components/iptables-manager.md |
| NetworkFilterUI | 設定画面のフィルタリングセクション | [詳細](components/network-filter-ui.md) @components/network-filter-ui.md |

## API一覧

| エンドポイント | メソッド | 目的 | 詳細リンク |
|---------------|---------|------|-----------|
| /api/environments/[id]/network-rules | GET, POST | ルール一覧取得・追加 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-rules/[ruleId] | PUT, DELETE | ルール更新・削除 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-filter | GET, PUT | フィルタリング設定の取得・更新 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-filter/test | POST | 通信テスト（dry-run） | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-rules/templates | GET | デフォルトテンプレート取得 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-rules/templates/apply | POST | テンプレート適用 | [詳細](api/network-rules.md) @api/network-rules.md |

## データベーススキーマ

| テーブル名 | 概要 | 詳細リンク |
|-----------|------|-----------|
| NetworkFilterRule | フィルタリングルール | [詳細](database/schema.md#networkfilterrule) @database/schema.md |
| NetworkFilterConfig | 環境ごとのフィルタリング設定 | [詳細](database/schema.md#networkfilterconfig) @database/schema.md |

## 技術的決定事項

| ID | 決定内容 | ステータス | 詳細リンク |
|----|---------|-----------|-----------|
| DEC-001 | iptables DOCKER-USER chain方式の採用 | 承認済 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | ドメイン解決方式（起動時DNS解決 + 定期リフレッシュ） | 承認済 | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |

## Docker環境作成時のデフォルトルール自動適用（US-006 / REQ-009）

新規Docker環境作成時に、全テンプレートルール（5カテゴリ、9ルール）をベストエフォートで自動適用する。

```text
POST /api/environments (type: DOCKER)
  │
  ├── 環境レコード作成
  ├── Config Volume作成
  ├── ★ デフォルトルール自動適用 ★
  │     ├── 全テンプレートルール一括適用（重複スキップ）
  │     └── フィルタリング有効化 (enabled: true) ※ルール適用成功後
  └── 201応答
```

- **ベストエフォート**: 初期化失敗時も環境作成は成功
- **対象**: Docker環境のみ（HOST/SSHはスキップ）
- **カスタマイズ可能**: 自動適用後にルールの編集・削除・無効化が可能

詳細: [NetworkFilterService - デフォルトルール自動適用](components/network-filter-service.md#docker環境作成時のデフォルトルール自動適用us-006) @components/network-filter-service.md

## セキュリティ考慮事項

- **デフォルト拒否**: フィルタリング有効時、ホワイトリスト外の全外部通信をDROP
- **フェイルセーフ**: iptablesルール適用失敗時はコンテナ起動を中止（制限なし起動はしない）
- **バイパス防止**: コンテナに`CAP_NET_ADMIN`を付与しない（既存の`CapDrop: ['ALL']`を維持）
- **クリーンアップ保証**: コンテナ停止時・異常終了時・アプリ再起動時にiptablesルールを確実に削除
- **DNS通信の許可**: ドメイン解決のためUDP/TCP 53番ポートは常時許可

## パフォーマンス考慮事項

- **DNS解決のキャッシュ**: ドメインのDNS解決結果をメモリ内にキャッシュし、コンテナ起動のオーバーヘッドを最小化
- **iptablesルールの一括適用**: `iptables-restore`を使用してルールを一括で適用し、個別コマンド実行のオーバーヘッドを回避
- **非同期DNS更新**: 長時間稼働コンテナに対して、バックグラウンドでDNS解決を定期リフレッシュ

## エラー処理戦略

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| IptablesNotAvailable | iptablesコマンドが利用不可 | フィルタリング有効時はコンテナ起動を中止、エラーログ出力 |
| DnsResolutionFailed | ドメインのDNS解決失敗 | 警告ログ出力、該当ルールをスキップしてコンテナ起動継続 |
| NetworkCreationFailed | Dockerネットワーク作成失敗 | エラーログ出力、コンテナ起動を中止 |
| RuleValidationError | 不正なルール形式 | バリデーションエラーをUIに表示、保存を拒否 |
| CleanupFailed | iptablesルールのクリーンアップ失敗 | 警告ログ出力、次回起動時に孤立ルールをクリーンアップ |

## CI/CD設計

### 品質ゲート

| 項目 | 基準値 | 採用ツール |
|------|--------|-----------|
| テストカバレッジ | 80%以上 | vitest |
| Linter | エラー0件 | ESLint |
| 既存テスト | 全パス | vitest |
