# 技術設計: ENCRYPTION_KEY自動生成

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | ENCRYPTION_KEY自動生成・永続化 |
| 関連要件 | [requirements](../../requirements/encryption-key-auto-gen/index.md) |
| 作成日 | 2026-02-26 |
| ステータス | Draft |

## アーキテクチャ概要

```text
サーバー起動 (server.ts)
  │
  ├─ dotenv.config()
  ├─ validateRequiredEnvVars()
  ├─ ensureDataDirs()
  │
  ├─ ensureEncryptionKey()  ← 新規追加
  │   │
  │   ├─ process.env.ENCRYPTION_KEY が設定済み?
  │   │   └─ YES → そのまま使用（ログ出力）
  │   │
  │   ├─ data/encryption.key ファイルが存在?
  │   │   └─ YES → ファイルから読み込み → process.env に設定
  │   │
  │   └─ どちらもない
  │       └─ crypto.randomBytes(32) で生成
  │           → Base64エンコード → ファイルに書き込み(mode: 0o600)
  │           → process.env に設定
  │
  ├─ detectClaudePath()
  └─ ... (以降既存の初期化処理)
```

## コンポーネント設計

### 1. ensureEncryptionKey (`src/lib/encryption-key-init.ts`)

**責務**: ENCRYPTION_KEYの検出・自動生成・永続化

**インターフェース**:

```typescript
/**
 * ENCRYPTION_KEYを確保する
 * 1. 環境変数が設定済みならそのまま使用
 * 2. キーファイルが存在すれば読み込み
 * 3. どちらもなければ新規生成してファイルに保存
 *
 * @returns 'env' | 'file' | 'generated'
 *   - 'env'       : 既存のprocess.env.ENCRYPTION_KEYをそのまま使用した場合
 *   - 'file'      : 既存のキーファイルから読み込み、process.envに設定した場合
 *   - 'generated' : 新規にキーを生成し、キーファイルへ保存してからprocess.envに設定した場合
 * @throws Error キーファイルの読み書きに失敗した場合、またはキーが不正な場合
 */
export function ensureEncryptionKey(): 'env' | 'file' | 'generated'
```

**実装詳細**:

- キーファイルパス: `${getDataDir()}/encryption.key`
- 生成方法: `crypto.randomBytes(32).toString('base64')`
- ファイルパーミッション: `0o600`
- `process.env.ENCRYPTION_KEY` に設定することで、既存の`EncryptionService`は変更不要

**要件対応**: FR-001, FR-002, FR-003, FR-004, NFR-001, NFR-002

### 2. server.ts の変更

**変更内容**: `ensureDataDirs()` の直後に `ensureEncryptionKey()` を呼び出す

**配置理由**:
- `ensureDataDirs()` の後: `data/` ディレクトリが存在することが保証される
- `validateRequiredEnvVars()` の後: 他の環境変数検証と干渉しない
- スキーマチェックの前: DB操作前にキーが利用可能になる

## 技術的決定事項

### 決定1: キーの保存場所

- **検討した選択肢**:
  - A: `data/encryption.key` ファイル
  - B: SQLiteデータベース内
  - C: Docker secrets
- **決定**: A
- **根拠**: `data/` はDocker volumeでマウントされており永続化が保証されている。DBに保存するとDB自体の暗号化と循環依存になる。Docker secretsはDocker Swarm専用で通常のCompose環境では使えない。

### 決定2: 環境変数への設定方法

- **検討した選択肢**:
  - A: `process.env.ENCRYPTION_KEY` に直接設定
  - B: `EncryptionService` を改修してファイルからも読み込み可能にする
- **決定**: A
- **根拠**: 既存の`EncryptionService`は`process.env.ENCRYPTION_KEY`を参照する設計。`process.env`に設定すれば既存コードの変更が不要で、影響範囲が最小限。

## 変更ファイル一覧

| ファイル | 変更種別 | 説明 |
|---------|---------|------|
| `src/lib/encryption-key-init.ts` | 新規 | キー検出・生成・永続化ロジック |
| `server.ts` | 修正 | 起動時に`ensureEncryptionKey()`を呼び出し |
| `src/lib/__tests__/encryption-key-init.test.ts` | 新規 | ユニットテスト |

## 要件との整合性チェック

| 要件ID | 設計要素 | 対応状況 |
|--------|---------|---------|
| FR-001 | `ensureEncryptionKey()` の自動生成パス | 対応済み |
| FR-002 | `data/encryption.key` への書き込み | 対応済み |
| FR-003 | ファイルからの読み込みパス | 対応済み |
| FR-004 | 環境変数チェックの優先判定 | 対応済み |
| NFR-001 | `fs.writeFileSync(path, key, { mode: 0o600 })` | 対応済み |
| NFR-002 | `getDataDir()` 使用（`data/`配下） | 対応済み |
