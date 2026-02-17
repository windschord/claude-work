# 設計書: マイグレーションエラー恒久対策

## 概要

本設計書は、[要件定義](../../requirements/migration-error-prevention/index.md) @../../requirements/migration-error-prevention/index.md に基づき、Systemd起動時のマイグレーションエラーを恒久的に防止するためのアーキテクチャと実装方針を定義します。

## アーキテクチャ概要

### 設計原則

1. **Single Source of Truth**: `src/db/schema.ts`をスキーマ定義の唯一の正とする
2. **Fail Fast**: スキーマ不一致を起動時に即座に検出し、HTTPサーバー起動前に停止
3. **自動化優先**: 手動操作を排除し、`drizzle-kit push`に統一
4. **可観測性**: ヘルスチェックAPIで外部監視ツールとの統合を可能にする

### システム構成図

```text
┌─────────────────────────────────────────────────────────┐
│                  アプリケーション起動                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  ステップ1: スキーマ同期（CLI起動時のみ）                  │
│  - syncSchema() (US-001)                                │
│  - drizzle-kit push を実行                              │
│  - 失敗時は process.exit(1)                             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  ステップ2: スキーマ整合性検証（常時実行）                 │
│  - validateSchemaIntegrity() (US-002)                  │
│  - Drizzleスキーマ vs DB実態を比較                      │
│  - 不一致時は詳細エラーメッセージを表示して exit(1)       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  ステップ3: HTTPサーバー起動                              │
│  - Next.jsカスタムサーバー                               │
│  - /api/health エンドポイント提供（US-003）              │
└─────────────────────────────────────────────────────────┘
```

### データフロー

```text
[src/db/schema.ts]
       │
       ├─→ drizzle-kit push ─→ [SQLite DB]
       │                            ↑
       └─→ validateSchemaIntegrity() ─┘
                    │
                    ├─→ OK: サーバー起動継続
                    └─→ NG: エラー表示 + exit(1)
```

## コンポーネント一覧

| コンポーネント | 責務 | 実装ファイル | 関連ストーリー |
|--------------|------|-------------|--------------|
| スキーマ同期 | drizzle-kit pushの実行 | `src/bin/cli-utils.ts` | [US-001](../../requirements/migration-error-prevention/stories/US-001.md) @../../requirements/migration-error-prevention/stories/US-001.md |
| スキーマ検証 | 整合性チェック | `src/lib/schema-check.ts` | [US-002](../../requirements/migration-error-prevention/stories/US-002.md) @../../requirements/migration-error-prevention/stories/US-002.md |
| ヘルスチェックAPI | 外部監視統合 | `src/app/api/health/route.ts` | [US-003](../../requirements/migration-error-prevention/stories/US-003.md) @../../requirements/migration-error-prevention/stories/US-003.md |

### 詳細設計

- [スキーマ同期コンポーネント](components/schema-sync.md) @components/schema-sync.md
- [スキーマ検証コンポーネント](components/schema-validator.md) @components/schema-validator.md
- [ヘルスチェックAPI](api/health.md) @api/health.md

## 技術スタック

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| ORM | Drizzle ORM | スキーマ定義、型安全なクエリ |
| マイグレーション | drizzle-kit push | スキーマ同期（非破壊的） |
| データベース | better-sqlite3 | SQLite接続、PRAGMA実行 |
| プロセス制御 | child_process.spawnSync | drizzle-kit pushの実行 |
| API | Next.js App Router | /api/health エンドポイント |

## アーキテクチャ決定記録（ADR）

| ID | タイトル | 決定内容 | 詳細リンク |
|----|---------|---------|-----------|
| DEC-001 | マイグレーションツールの選択 | drizzle-kit pushを採用 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | 起動時チェックの実装方針 | server.ts統合 vs CLI分離 | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |

## 非機能要件の実現方針

### 性能要件

| 要件ID | 目標値 | 実現方針 |
|--------|--------|---------|
| NFR-001 | スキーマ同期 30秒以内 | drizzle-kit pushは軽量、タイムアウト監視不要 |
| NFR-003 | スキーマ検証 5秒以内 | PRAGMA table_infoは高速、7テーブル程度なら十分達成可能 |
| NFR-005 | ヘルスチェック 2秒以内 | 検証結果のキャッシュは不要、毎回実行でも達成可能 |

### 保守性要件

| 要件ID | 実現方針 |
|--------|---------|
| NFR-002 | 手動マイグレーション関数をすべて削除、コードレビューで残存確認 |
| NFR-004 | validateSchemaIntegrity()は読み取り専用、ユニットテストで検証 |
| NFR-006 | JSDocコメント必須、ESLint jsdocプラグインで強制 |

## セキュリティ考慮事項

### 脅威モデル

1. **SQLインジェクション**: 該当なし（ユーザー入力を受け付けない）
2. **パストラバーサル**: 該当なし（ファイルパス操作なし）
3. **DoS攻撃**: /api/healthへの大量リクエスト
   - 対策: レート制限は将来検討（現状は内部監視用途のみ）

### 入力検証

- drizzle-kit pushは外部入力なし
- validateSchemaIntegrity()は内部データのみ使用
- /api/healthはGETのみ、クエリパラメータなし

## テスト戦略

### ユニットテスト

- `syncSchema()`: drizzle-kit pushの実行成功/失敗パターン
- `validateSchemaIntegrity()`: スキーマ一致/不一致パターン
- `/api/health`: 正常系/異常系レスポンス

### 統合テスト

- 起動シーケンス全体のテスト（CLI → スキーマ同期 → 検証 → サーバー起動）
- スキーマ不一致時のエラーハンドリング
- Systemd起動時のシミュレーション

### E2Eテスト

- スコープ外（手動テストで代替）

## デプロイ戦略

### 移行手順

1. **Phase 1**: スキーマ検証機能の追加（US-002）
   - 既存機能に影響なし、検証のみ実施
   - 不一致検出時はワーニング表示（exit しない）

2. **Phase 2**: スキーマ同期の置換（US-001）
   - CLI起動時のマイグレーション処理を置換
   - 手動マイグレーション関数を削除

3. **Phase 3**: ヘルスチェックAPIの追加（US-003）
   - 外部監視ツール連携

### ロールバック計画

- Phase 1-2のロールバック: Gitコミット単位で戻す
- Phase 3のロールバック: /api/healthは独立しているため影響なし

## 依存関係

### 外部依存

- drizzle-kit: v0.x系（npx経由で実行、バージョン固定不要）
- better-sqlite3: 既存依存
- Node.js: v18以降（spawnSync使用）

### 内部依存

- `src/db/schema.ts`: スキーマ定義（変更なし）
- `src/lib/db.ts`: データベース接続（変更なし）
- `server.ts`: 起動シーケンスに検証処理を追加

## 制約事項

### 技術的制約

- SQLite単一ファイルデータベース（並行書き込み制限あり）
- drizzle-kit pushは非破壊的（カラム削除は手動確認が必要）
- Systemdタイムアウト90秒以内に起動完了が必要

### ビジネス制約

- 本番環境ダウンタイムは許容しない（スキーマ同期中もサービス継続）
- 既存データの移行は不要（カラム追加のみ）

## 将来の拡張性

### 将来検討事項

- CI/CDパイプラインでのスキーマdrift検出
- マイグレーション履歴の可視化UI
- /api/healthのメトリクス拡張（ディスク使用率、メモリ等）
- レート制限の実装（DoS対策）

### スコープ外（今回実装しない）

- Systemdユニットファイル改善（P2）
- CI/CD統合（P4）
- ロールバック機能
- マイグレーション履歴管理

---

## ドキュメント構成

```text
docs/sdd/design/migration-error-prevention/
├── index.md                    # このファイル（設計概要）
├── components/
│   ├── schema-sync.md         # スキーマ同期コンポーネント
│   └── schema-validator.md    # スキーマ検証コンポーネント
├── api/
│   └── health.md              # ヘルスチェックAPI設計
└── decisions/
    ├── DEC-001.md             # マイグレーションツール選択
    └── DEC-002.md             # 起動時チェック実装方針
```

## 参照

- [要件定義](../../requirements/migration-error-prevention/index.md) @../../requirements/migration-error-prevention/index.md
- [統合レポート](../../../migration-error-fix.md) @../../../migration-error-fix.md
- [恒久対策提案書](../../../proposals/migration-prevention-proposal.md) @../../../proposals/migration-prevention-proposal.md
