# Docker環境ネットワークフィルタリング - 技術設計

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報
- [x] フィルタリング方式: ホワイトリスト（デフォルト全ブロック）
- [x] ワイルドカード対応: `*.example.com` パターン
- [x] 粒度: ドメイン/IPアドレス + ポート番号
- [x] 適用範囲: 環境(ExecutionEnvironment)ごとに個別設定
- [x] ~~実装方式: Docker カスタムネットワーク + iptables~~ (廃止 - proxy方式に移行予定)
- [x] Docker Compose環境との共存が必要
- [x] 技術スタック: 既存プロジェクト準拠（Next.js, TypeScript, SQLite, Drizzle ORM）
- [x] セキュリティ要件: フェイルセーフ（適用失敗時は起動中止）、バイパス防止

### 不明/要確認の情報

iptables方式は廃止済み。proxy方式（US-007）の詳細設計は別ブランチで策定中です。

---

## アーキテクチャ概要

> **注意**: iptables方式は廃止されました。現在はproxy方式（US-007）への移行が予定されています。以下のアーキテクチャ図はiptables方式廃止前のものです。

```text
┌─────────────────────────────────────────────────────────────┐
│                     ClaudeWork Server                        │
│                                                              │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────┐ │
│  │  Settings UI  │  │   API Routes      │  │ DockerAdapter│ │
│  │ (Environment  │──│ /api/environments │──│              │ │
│  │  Filter Tab)  │  │ /[id]/rules       │  │              │ │
│  └──────────────┘  └───────────────────┘  └──────┬───────┘ │
│                              │                     │         │
│                    ┌─────────┴─────────┐          │         │
│                    │NetworkFilterService│──────────┘         │
│                    │ (Rule CRUD + DNS)  │                    │
│                    └─────────┬─────────┘                    │
│                              │                               │
│                    ┌─────────┴─────────┐                    │
│                    │     SQLite DB      │                    │
│                    │ NetworkFilterRule   │                    │
│                    └───────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 移行状況

iptables方式（IptablesManager + DockerAdapterによるフィルタ適用）は以下の理由で廃止されました:

- Docker Compose環境でのホストiptablesへのアクセスに `pid: host`, `NET_ADMIN`, `SYS_ADMIN` 等の特権設定が必要で、セキュリティリスクが高い
- コンテナネットワーク名前空間とホストネットワーク名前空間の分離による複雑な設定が必要

proxy方式（US-007）への移行が予定されており、プロキシサーバーを経由してアウトバウンド通信を制御します。仕様は別ブランチで策定中です。

### 現在のコンテナ起動時のフロー

```text
DockerAdapter.createSession()
  │
  ├── コンテナ起動（ネットワークフィルタリングなし）
  │
  └── [フィルタリング有効の場合でも現時点ではフィルタリング適用なし]
        → proxy方式実装後に対応予定
```

## コンポーネント一覧

| コンポーネント名 | 目的 | ステータス | 詳細リンク |
|-----------------|------|-----------|-----------|
| NetworkFilterService | フィルタリングルールの管理・DNS解決 | 稼働中（applyFilter/removeFilter/cleanupOrphanedRules は廃止） | [詳細](components/network-filter-service.md) @components/network-filter-service.md |
| IptablesManager | iptablesルールの生成・適用・クリーンアップ | **廃止済み**（ファイル削除済み） | [詳細](components/iptables-manager.md) @components/iptables-manager.md |
| NetworkFilterUI | 設定画面のフィルタリングセクション | 稼働中 | [詳細](components/network-filter-ui.md) @components/network-filter-ui.md |

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
| DEC-001 | iptables DOCKER-USER chain方式の採用 | **廃止**（特権設定の複雑性によりproxy方式に移行予定） | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | ドメイン解決方式（起動時DNS解決 + 定期リフレッシュ） | 承認済（proxy方式でも継続予定） | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |

## セキュリティ考慮事項

> iptables方式廃止に伴い、以下の項目はproxy方式（US-007）で再設計予定です。

- **デフォルト拒否**: フィルタリング有効時、ホワイトリスト外の全外部通信をDROP（proxy方式で実現予定）
- **バイパス防止**: コンテナに`CAP_NET_ADMIN`を付与しない（既存の`CapDrop: ['ALL']`を維持）
- **DNS解決**: proxy方式ではproxyコンテナがDNS解決を行うため、Claudeコンテナから直接のDNS通信（UDP/TCP 53）は不要。具体的な許可要件はUS-007で確定予定

## エラー処理戦略

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| DnsResolutionFailed | ドメインのDNS解決失敗 | 警告ログ出力、該当ルールをスキップ。proxy方式ではproxyコンテナ側でDNS解決を行うため、ClaudeWork側での発生はルール登録時のプレビュー/検証時に限定される |
| RuleValidationError | 不正なルール形式 | バリデーションエラーをUIに表示、保存を拒否。proxy方式でもUI保存前のクライアント側バリデーションとして継続利用 |

## CI/CD設計

### 品質ゲート

| 項目 | 基準値 | 採用ツール |
|------|--------|-----------|
| テストカバレッジ | 80%以上 | vitest |
| Linter | エラー0件 | ESLint |
| 既存テスト | 全パス | vitest |
