# 設計: 開発ツール設定管理機能

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。
> 各セクションで「明示された情報」と「不明/要確認の情報」を明確に区別してください。
> **不明な情報が1つでもある場合は、実装前に必ず確認を取ってください。**

## 情報の明確性チェック

### ユーザーから明示された情報
- [x] 技術スタック: Next.js 15, TypeScript, Drizzle ORM, React, Zustand
- [x] アーキテクチャパターン: クリーンアーキテクチャ（Service層、Adapter層）
- [x] フレームワーク: Next.js App Router, Tailwind CSS, Headless UI
- [x] データベース: SQLite（Drizzle経由）
- [x] 外部サービス連携: なし
- [x] セキュリティ要件: AES-256-CBC暗号化、パーミッション0600、read-onlyマウント
- [x] パフォーマンス要件: 設定読み込み100ms以内、保存500ms以内

### 不明/要確認の情報

| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| 暗号化ライブラリ | Node.js標準cryptoを使用 | [x] 確認済み（DEC-001で決定） |
| SSH鍵一時保存場所 | data/environments/<env-id>/ssh/ | [x] 確認済み（DEC-002で決定） |
| マスターキー管理 | 環境変数 ENCRYPTION_MASTER_KEY | [x] 確認済み |

### 確認が必要な質問リスト

すべて確認済みのため、実装可能です。

---

## アーキテクチャ概要

開発ツール設定管理機能は、既存のClaudeWorkシステムに統合される形で実装されます。3層アーキテクチャ（UI層、Service層、Data層）に従い、既存コンポーネントとの整合性を保ちます。

```mermaid
graph TB
    subgraph "UI層（フロントエンド）"
        A[DeveloperSettingsPage<br/>/settings/developer]
        B[DeveloperSettingsForm]
        C[SshKeyManager]
    end

    subgraph "API層（Next.js API Routes）"
        D[/api/developer-settings/*]
        E[/api/ssh-keys]
    end

    subgraph "Service層"
        F[DeveloperSettingsService]
        G[EncryptionService]
        H[SshKeyService]
    end

    subgraph "Adapter層"
        I[DockerAdapter<br/>拡張: injectDeveloperSettings]
        J[HostAdapter<br/>拡張: applyGitConfig]
    end

    subgraph "Data層（Drizzle ORM）"
        K[(DeveloperSettings)]
        L[(SshKey)]
        M[(Project)]
        N[(ExecutionEnvironment)]
    end

    A --> B
    A --> C
    B --> D
    C --> E
    D --> F
    E --> H
    H --> G
    F --> K
    H --> L
    I --> F
    I --> H
    I --> G
    F --> M
    I --> N
```

## コンポーネント一覧

| コンポーネント名 | 目的 | 詳細リンク |
|-----------------|------|-----------|
| DeveloperSettingsService | Git設定の保存・読み取り・優先順位解決 | [詳細](components/developer-settings-service.md) @components/developer-settings-service.md |
| EncryptionService | SSH秘密鍵のAES-256暗号化・復号化 | [詳細](components/encryption-service.md) @components/encryption-service.md |
| SshKeyService | SSH鍵の登録・削除・バリデーション | [詳細](components/ssh-key-service.md) @components/ssh-key-service.md |
| DockerAdapter拡張 | Docker環境への設定自動適用ロジック | [詳細](components/docker-adapter-extension.md) @components/docker-adapter-extension.md |
| DeveloperSettingsPage | UI: 設定画面コンポーネント | [詳細](components/developer-settings-page.md) @components/developer-settings-page.md |

## API一覧

| エンドポイント | メソッド | 目的 | 詳細リンク |
|---------------|---------|------|-----------|
| /api/developer-settings/global | GET, PUT | グローバルGit設定の取得・更新 | [詳細](api/developer-settings.md) @api/developer-settings.md |
| /api/developer-settings/project/:projectId | GET, PUT, DELETE | プロジェクト別Git設定の管理 | [詳細](api/developer-settings.md) @api/developer-settings.md |
| /api/ssh-keys | GET, POST | SSH鍵一覧取得・新規登録 | [詳細](api/ssh-keys.md) @api/ssh-keys.md |
| /api/ssh-keys/:id | DELETE | SSH鍵削除 | [詳細](api/ssh-keys.md) @api/ssh-keys.md |

## データベーススキーマ

| テーブル名 | 概要 | 詳細リンク |
|-----------|------|-----------|
| DeveloperSettings | Git設定（グローバル/プロジェクト別） | [詳細](database/schema.md#developersettings) @database/schema.md |
| SshKey | SSH鍵ペア（暗号化秘密鍵） | [詳細](database/schema.md#sshkey) @database/schema.md |

## 技術的決定事項

| ID | 決定内容 | ステータス | 詳細リンク |
|----|---------|-----------|-----------|
| DEC-001 | 暗号化ライブラリにNode.js標準cryptoを採用 | 承認済 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | SSH鍵一時保存場所をdata/environments/<env-id>/ssh/に決定 | 承認済 | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |
| DEC-003 | 階層的設定の優先順位ロジックをServiceで実装 | 承認済 | [詳細](decisions/DEC-003.md) @decisions/DEC-003.md |

## セキュリティ考慮事項

### 暗号化
- **SSH秘密鍵の暗号化**: AES-256-CBC アルゴリズム
- **暗号化マスターキー**: 環境変数 `ENCRYPTION_MASTER_KEY` から取得
- **初期化ベクトル（IV）**: 鍵ごとにランダム生成し、データベースに保存

### アクセス制御
- SSH鍵APIは認証済みユーザーのみアクセス可能（将来的な実装）
- 秘密鍵の内容は画面に表示しない（公開鍵のみ表示）

### ファイルパーミッション
- Docker/HOST環境のSSH秘密鍵ファイル: `0600`（所有者のみ読み書き可能）
- SSH公開鍵ファイル: `0644`（所有者が読み書き、他は読み取りのみ）
- `/root/.ssh` ディレクトリ: `0700`（所有者のみアクセス可能）

### Docker環境のセキュリティ
- SSH鍵はread-onlyでマウント（コンテナ内での改変を防止）
- 一時鍵ファイルはコンテナ停止時に削除

## パフォーマンス考慮事項

### データベースインデックス
- `DeveloperSettings(scope, project_id)`: 複合インデックス（設定検索の高速化）
- `SshKey(name)`: ユニークインデックス（重複チェックの高速化）

### キャッシング戦略
- グローバル設定はメモリキャッシュ（変更頻度が低いため）
- プロジェクト設定はセッション起動時にキャッシュ

### 暗号化処理の最適化
- SSH鍵の暗号化/復号化は非同期で実行
- 大きな鍵ファイルの場合はストリーム処理を検討

### パフォーマンス目標
- 設定読み込み: **100ms以内**（P95）
- 設定保存: **500ms以内**（P95）

## エラー処理戦略

### API エラーレスポンス

```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Git Email の形式が正しくありません",
    "details": {
      "field": "git_email",
      "value": "invalid-email"
    }
  }
}
```

### エラーコード一覧

| コード | 説明 | HTTPステータス |
|-------|------|---------------|
| VALIDATION_ERROR | 入力バリデーションエラー | 400 |
| DUPLICATE_SSH_KEY_NAME | SSH鍵名が既に存在 | 409 |
| ENCRYPTION_ERROR | 暗号化/復号化エラー | 500 |
| INVALID_SSH_KEY | 無効なSSH鍵ファイル | 400 |
| NOT_FOUND | リソースが見つからない | 404 |

### リトライ戦略

- 一時的なファイルI/Oエラー: 3回までリトライ（指数バックオフ）
- Docker API呼び出しエラー: 2回までリトライ
- データベースエラー: リトライなし（トランザクションロールバック）

## CI/CD設計

### 品質ゲート

| 項目 | 基準値 | 採用ツール |
|------|--------|-----------|
| テストカバレッジ | 80%以上 | Vitest（カバレッジレポート） |
| Linter | エラー0件 | ESLint |
| コード複雑性 | 循環的複雑度10以下 | ESLint（complexity rule） |
| 型チェック | エラー0件 | TypeScript Compiler（tsc --noEmit） |

### テスト戦略

1. **単体テスト（Vitest）**:
   - DeveloperSettingsService: 優先順位解決ロジック
   - EncryptionService: 暗号化/復号化ロジック
   - SshKeyService: バリデーションロジック

2. **統合テスト（Vitest）**:
   - API Routes: エンドポイントの動作確認
   - データベース操作: Drizzleクエリの動作確認

3. **E2Eテスト（Playwright）**:
   - 設定画面でのGit設定保存
   - SSH鍵の登録・削除
   - Docker環境での設定適用確認

### デプロイメント

- マイグレーション: `npm run db:push` で自動適用
- 環境変数チェック: `ENCRYPTION_MASTER_KEY` が未設定の場合は警告

---

## リンク形式について

詳細ファイルへのリンクは、マークダウン形式と`@`形式の両方を記載してください：
- **マークダウン形式**: `[詳細](components/component-a.md)` - GitHub等での閲覧用
- **@形式**: `@components/component-a.md` - Claude Codeがファイルを参照する際に使用

---

## ドキュメント構成

```
docs/sdd/design/dev-tool-settings/
├── index.md                            # このファイル（目次）
├── components/
│   ├── developer-settings-service.md   # Git設定管理サービス
│   ├── encryption-service.md           # 暗号化サービス
│   ├── ssh-key-service.md              # SSH鍵管理サービス
│   ├── docker-adapter-extension.md     # DockerAdapter拡張
│   └── developer-settings-page.md      # UI: 設定画面
├── api/
│   ├── developer-settings.md           # Git設定API
│   └── ssh-keys.md                     # SSH鍵API
├── database/
│   └── schema.md                       # データベーススキーマ
└── decisions/
    ├── DEC-001.md                      # 暗号化ライブラリ選択
    ├── DEC-002.md                      # SSH鍵一時保存場所
    └── DEC-003.md                      # 階層的設定ロジック
```
