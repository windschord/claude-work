# Docker環境ネットワークフィルタリング - 技術設計

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報
- [x] フィルタリング方式: ホワイトリスト（デフォルト全ブロック）
- [x] ワイルドカード対応: `*.example.com` パターン
- [x] 粒度: ドメイン/IPアドレス + ポート番号
- [x] 適用範囲: 環境(ExecutionEnvironment)ごとに個別設定
- [x] 実装方式: network-filter-proxy（フォワードプロキシ） + Docker internalネットワーク
- [x] Docker Compose環境との共存が必要
- [x] 技術スタック: 既存プロジェクト準拠（Next.js, TypeScript, SQLite, Drizzle ORM）
- [x] セキュリティ要件: フェイルセーフ（適用失敗時は起動中止）、バイパス防止
- [x] proxyイメージ: ghcr.io/windschord/network-filter-proxy（プレビルド）
- [x] DNS解決: proxy側で実行時に行う。ClaudeWork側のDNS解決機能は削除

### 不明/要確認の情報

なし（全方針確定済み）

---

## アーキテクチャ概要

### Proxy方式アーキテクチャ

network-filter-proxy をDocker Composeサービスとして起動し、ClaudeコンテナをDocker internalネットワークに接続することで、proxy経由以外の外部通信を物理的に防止する。

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        ClaudeWork Server (app)                        │
│                                                                       │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────────┐  │
│  │  Settings UI  │  │   API Routes      │  │    DockerAdapter     │  │
│  │ (Environment  │──│ /api/environments │  │ (フィルタ連携あり)    │  │
│  │  Filter Tab)  │  │ /[id]/rules       │  │ - internal NW 接続   │  │
│  └──────────────┘  └───────────────────┘  │ - HTTP_PROXY 設定    │  │
│                              │             │ - ルール同期          │  │
│                    ┌─────────┴─────────┐  └──────────┬───────────┘  │
│                    │NetworkFilterService│             │               │
│                    │ (Rule CRUD)       │             │               │
│                    └─────────┬─────────┘             │               │
│                              │                       │               │
│                    ┌─────────┴─────────┐  ┌─────────┴───────────┐  │
│                    │     SQLite DB      │  │    ProxyClient      │  │
│                    │ NetworkFilterRule   │  │ (Management API通信) │  │
│                    └───────────────────┘  └─────────┬───────────┘  │
│                                                     │               │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │
                                          default network (API: 8080)
                                                      │
                                          ┌───────────┴───────────┐
                                          │ network-filter-proxy  │
                                          │ :3128 (proxy)         │
                                          │ :8080 (mgmt API)      │
                                          └───────────┬───────────┘
                                                      │
                                     claudework-filter (internal, proxy: 3128)
                                                      │
                                          ┌───────────┴───────────┐
                                          │   Claude Container    │
                                          │ HTTP_PROXY=proxy:3128 │
                                          │ (direct egress不可)   │
                                          └───────────────────────┘
```

### コンテナ起動時のフロー

```text
DockerAdapter.createSession()
  │
  ├── isFilterEnabled(environmentId) → true の場合
  │     │
  │     ├── proxyClient.healthCheck() → proxy稼働確認
  │     │     └── 失敗時: セッション作成エラー（フェイルセーフ）
  │     │
  │     ├── buildContainerOptions()
  │     │     ├── NetworkMode: claudework-filter
  │     │     └── Env: HTTP_PROXY, HTTPS_PROXY
  │     │
  │     ├── docker.createContainer() → container.start()
  │     │
  │     ├── container.inspect() → コンテナIPアドレス取得
  │     │
  │     └── proxyClient.syncRules(containerIP, environmentId)
  │           └── DB→proxy APIにルール同期
  │
  └── isFilterEnabled(environmentId) → false の場合
        └── 現行通りdefaultネットワークでコンテナ起動
```

### コンテナ停止時のフロー

```text
DockerAdapter.stopSession() / container exit
  │
  └── [フィルタリング有効の場合]
        └── proxyClient.deleteRules(containerIP)
              └── proxyからルール削除（コンテナ分のみ）
```

### ルール変更時の同期フロー

```text
UI → API → NetworkFilterService.createRule/updateRule/deleteRule()
  │
  └── [フィルタリング有効 かつ 該当環境にアクティブコンテナがある場合]
        └── proxyClient.syncRules(containerIP, environmentId)
              └── DB全体を再同期（PUT /api/v1/rules/{sourceIP}で丸ごと置換）
```

## コンポーネント一覧

| コンポーネント名 | 目的 | ステータス | 詳細リンク |
|-----------------|------|-----------|-----------|
| NetworkFilterService | フィルタリングルールのCRUD管理 | 稼働中（DNS解決機能は削除済み） | [詳細](components/network-filter-service.md) @components/network-filter-service.md |
| ProxyClient | network-filter-proxy Management APIクライアント | **新規** | [詳細](components/proxy-client.md) @components/proxy-client.md |
| Docker Compose Proxy構成 | proxyサービス・internalネットワーク定義 | **新規** | [詳細](components/docker-compose-proxy.md) @components/docker-compose-proxy.md |
| IptablesManager | iptablesルールの生成・適用・クリーンアップ | **廃止済み**（ファイル削除済み） | [詳細](components/iptables-manager.md) @components/iptables-manager.md |
| NetworkFilterUI | 設定画面のフィルタリングセクション | 稼働中 | [詳細](components/network-filter-ui.md) @components/network-filter-ui.md |

## API一覧

| エンドポイント | メソッド | 目的 | 詳細リンク |
|---------------|---------|------|-----------|
| /api/environments/[id]/network-rules | GET, POST | ルール一覧取得・追加 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-rules/[ruleId] | PUT, DELETE | ルール更新・削除 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-filter | GET, PUT | フィルタリング設定の取得・更新 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-filter/test | POST | 通信テスト（proxy稼働状態付きルールマッチング） | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-rules/templates | GET | デフォルトテンプレート取得 | [詳細](api/network-rules.md) @api/network-rules.md |
| /api/environments/[id]/network-rules/templates/apply | POST | テンプレート適用 | [詳細](api/network-rules.md) @api/network-rules.md |

## データベーススキーマ

| テーブル名 | 概要 | 詳細リンク |
|-----------|------|-----------|
| NetworkFilterRule | フィルタリングルール | [詳細](database/schema.md#networkfilterrule) @database/schema.md |
| NetworkFilterConfig | 環境ごとのフィルタリング設定 | [詳細](database/schema.md#networkfilterconfig) @database/schema.md |

変更なし。既存スキーマをそのまま再利用する。

## 技術的決定事項

| ID | 決定内容 | ステータス | 詳細リンク |
|----|---------|-----------|-----------|
| DEC-001 | iptables DOCKER-USER chain方式の採用 | **廃止**（ホストiptablesへの影響問題） | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | ドメイン解決方式（起動時DNS解決 + 定期リフレッシュ） | **廃止**（proxyがドメインベースで直接フィルタ） | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |
| DEC-003 | network-filter-proxy によるProxy方式の採用 | **承認済** | [詳細](decisions/DEC-003.md) @decisions/DEC-003.md |

## upstream変更要件

network-filter-proxyリポジトリへの変更が必要:

| 項目 | 内容 | Issue |
|------|------|-------|
| API_BIND_ADDR環境変数 | Management APIのバインドアドレスを設定可能にする（デフォルト: 127.0.0.1、設定例: 0.0.0.0） | [#5](https://github.com/windschord/network-filter-proxy/issues/5) |
| healthcheckコマンド | distrolessイメージにwget/curlがないため、ヘルスチェック用サブコマンド対応 | [#6](https://github.com/windschord/network-filter-proxy/issues/6) |

## セキュリティ考慮事項

- **デフォルト拒否**: proxyにルール未登録の送信元IPからの通信は403 Forbiddenで拒否
- **ネットワーク分離（主要な強制力）**: Docker internalネットワークにより、Claudeコンテナからの直接外部通信を物理的に防止
- **権限制限（補助的な防御層）**: `CapDrop: ['ALL']`および`SecurityOpt: ['no-new-privileges']`は維持
- **DNS解決の責務分離**: proxyが接続時にドメイン名で直接フィルタ・DNS解決を実行。ClaudeWork側のDNS解決は不要（削除）
- **Management APIアクセス制御**: proxyのManagement APIはdefaultネットワーク経由でappからのみアクセス。ClaudeコンテナはinternalネットワークのみのためManagement API経由のルール変更リスクは限定的

## エラー処理戦略

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| ProxyConnectionError | proxyに接続できない | コンテナ起動中止（フェイルセーフ）、ログ出力 |
| ProxyValidationError | proxy側でルール形式不正 | 該当ルールをスキップ、ログ出力 |
| RuleValidationError | 不正なルール形式（ClaudeWork側バリデーション） | UIにエラー表示、保存を拒否 |
| NetworkError | proxy APIタイムアウト | リトライ後にエラー伝播 |

## CI/CD設計

### 品質ゲート

| 項目 | 基準値 | 採用ツール |
|------|--------|-----------|
| テストカバレッジ | 80%以上 | vitest |
| Linter | エラー0件 | ESLint |
| 既存テスト | 全パス | vitest |
