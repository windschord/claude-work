# コンポーネント設計: スキーマ同期

## 概要

**関連要件**: [US-001: スキーママイグレーションの自動化](../../../requirements/migration-error-prevention/stories/US-001.md) @../../../requirements/migration-error-prevention/stories/US-001.md

`syncSchema()`関数は、`npx claude-work`起動時に`drizzle-kit push`を自動実行し、`src/db/schema.ts`の定義に基づいてデータベーススキーマを最新状態に同期します。

## 責務

- CLI起動時のスキーマ同期処理の実行
- drizzle-kit pushコマンドの呼び出しとエラーハンドリング
- 同期成功/失敗のログ出力
- 既存の手動マイグレーション機構の完全置換

## インターフェース

### 関数シグネチャ

```typescript
/**
 * データベーススキーマを最新状態に同期する
 *
 * src/db/schema.ts の定義に基づき、drizzle-kit push を実行して
 * データベースのスキーマを更新する。
 *
 * @param databaseUrl - データベースファイルのパス（環境変数DATABASE_URLから取得）
 * @throws {Error} drizzle-kit push が失敗した場合
 *
 * @example
 * ```typescript
 * try {
 *   syncSchema(process.env.DATABASE_URL!);
 *   console.log('✅ スキーマ同期完了');
 * } catch (error) {
 *   console.error('❌ スキーマ同期失敗:', error);
 *   process.exit(1);
 * }
 * ```
 */
export function syncSchema(databaseUrl: string): void;
```

### 入力

- **databaseUrl**: `string` - データベースファイルのパス（例: `file:../data/claudework.db`）

### 出力

- **戻り値**: `void`
- **副作用**:
  - データベーススキーマの変更（カラム追加、テーブル作成等）
  - 標準出力へのログ出力
  - 失敗時は`Error`をthrow

### エラー

| エラーケース | スローされる例外 | メッセージ例 |
|-------------|----------------|-------------|
| drizzle-kit pushが失敗 | `Error` | `drizzle-kit push failed with exit code 1` |
| DATABASE_URLが未設定 | `Error` | `DATABASE_URL is not set` |
| drizzle-kitが見つからない | `Error` | `drizzle-kit not found. Run: npm install drizzle-kit` |

## 内部設計

### 処理フロー

```text
syncSchema(databaseUrl)
    ↓
1. 環境変数DATABASE_URLの検証
    ↓
2. drizzle-kit pushコマンドの構築
   - コマンド: npx drizzle-kit push
   - 引数: なし（drizzle.config.tsから設定を読み込む）
    ↓
3. spawnSyncでdrizzle-kit pushを実行
   - stdio: 'inherit' (標準出力をリアルタイム表示)
   - cwd: プロジェクトルート
    ↓
4. 終了コードのチェック
   - 0: 成功 → ログ出力して終了
   - 非0: 失敗 → Errorをthrow
```

### 実装詳細

```typescript
import { spawnSync } from 'child_process';
import path from 'path';

export function syncSchema(databaseUrl: string): void {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log('🔄 スキーマ同期中...');
  console.log(`   データベース: ${databaseUrl}`);

  // drizzle-kit push を実行
  const result = spawnSync('npx', ['drizzle-kit', 'push'], {
    stdio: 'inherit', // 標準出力をそのまま表示
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  if (result.error) {
    throw new Error(`Failed to execute drizzle-kit: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`drizzle-kit push failed with exit code ${result.status}`);
  }

  console.log('✅ スキーマ同期完了');
}
```

### drizzle.config.tsの前提

drizzle-kit pushは`drizzle.config.ts`から設定を読み込みます。以下の設定が必要です：

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## 統合ポイント

### CLI起動シーケンスへの組み込み

**ファイル**: `src/bin/cli.ts`

```typescript
import { syncSchema } from './cli-utils';

export async function setupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('📦 データベース初期化中...');

  try {
    // 既存: データベースファイルの作成（存在しない場合）
    ensureDatabaseFile(databaseUrl);

    // 新規: スキーマ同期
    syncSchema(databaseUrl);

    // 削除: migrateDatabase() ← 廃止
    // 削除: createInitialTables() ← 廃止
    // 削除: addClaudeCodeOptionsColumns() ← 廃止

    console.log('✅ データベース準備完了');
  } catch (error) {
    console.error('❌ データベース初期化失敗:', error);
    process.exit(1);
  }
}
```

### 廃止する関数

以下の関数は`syncSchema()`への置換により不要となるため、完全に削除します：

| 関数名 | ファイル | 削除理由 |
|--------|---------|---------|
| `migrateDatabase()` | `src/bin/cli-utils.ts` | バージョン管理ベースの手動マイグレーションは不要 |
| `createInitialTables()` | `src/bin/cli-utils.ts` | drizzle-kit pushが自動実行 |
| `addClaudeCodeOptionsColumns()` | `src/bin/cli-utils.ts` | drizzle-kit pushが自動実行 |
| `createGitHubPATTable()` | `src/bin/cli-utils.ts` | drizzle-kit pushが自動実行 |
| `safeAddColumn()` | `src/bin/cli-utils.ts` | ヘルパー関数、不要 |

### 廃止する定数

```typescript
// 削除対象
const CURRENT_DB_VERSION = 3;
```

## 非機能要件

### 性能要件（NFR-001）

- **目標**: 30秒以内に完了
- **実測値**: drizzle-kit pushは通常5-10秒程度（7テーブル程度の場合）
- **監視**: spawnSyncにタイムアウトは設定しない（Systemdのタイムアウト90秒で十分）

### 保守性要件（NFR-002）

- **Single Source of Truth**: `src/db/schema.ts`のみがスキーマ定義
- **手動SQL排除**: ALTER TABLE等の直接実行を完全廃止
- **JSDocコメント**: 関数シグネチャに詳細な説明を記載

## テスト戦略

### ユニットテスト

**ファイル**: `src/bin/__tests__/cli-utils.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import { syncSchema } from '../cli-utils';

vi.mock('child_process');

describe('syncSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DATABASE_URLが未設定の場合はエラーをthrowする', () => {
    expect(() => syncSchema('')).toThrow('DATABASE_URL is not set');
  });

  it('drizzle-kit pushが成功した場合は正常終了する', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      error: undefined,
    } as any);

    expect(() => syncSchema('file:test.db')).not.toThrow();
    expect(spawnSync).toHaveBeenCalledWith(
      'npx',
      ['drizzle-kit', 'push'],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({
          DATABASE_URL: 'file:test.db',
        }),
      })
    );
  });

  it('drizzle-kit pushが失敗した場合はエラーをthrowする', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      error: undefined,
    } as any);

    expect(() => syncSchema('file:test.db')).toThrow(
      'drizzle-kit push failed with exit code 1'
    );
  });

  it('spawnSyncがエラーを返した場合はエラーをthrowする', () => {
    vi.mocked(spawnSync).mockReturnValue({
      error: new Error('Command not found'),
    } as any);

    expect(() => syncSchema('file:test.db')).toThrow(
      'Failed to execute drizzle-kit'
    );
  });
});
```

### 統合テスト

1. **正常系**: スキーマ変更後の起動
   - schema.tsに新規テーブルを追加
   - `npx claude-work`を実行
   - データベースに新規テーブルが作成されることを確認

2. **異常系**: drizzle-kit pushの失敗
   - drizzle.config.tsを無効化
   - `npx claude-work`を実行
   - エラーメッセージが表示され、起動が中断されることを確認

## 既知の制約

### drizzle-kit pushの制約

- **非破壊的操作のみ**: カラム削除、テーブル削除は手動確認が必要
  - カラム削除時は`drizzle-kit push`が確認プロンプトを表示
  - CI/CD環境では`--yes`フラグで自動承認可能

- **複雑なスキーマ変更**: 一部の変更は手動SQLが必要
  - カラムの型変更（例: TEXT → INTEGER）
  - 制約の変更（例: NOT NULL追加）
  - これらは今回のスコープ外（カラム追加のみ対応）

## セキュリティ考慮事項

### コマンドインジェクション対策

- `spawnSync`に配列形式で引数を渡すため、シェルインジェクションのリスクなし
- `DATABASE_URL`は環境変数経由で渡すため、コマンドライン引数には含まれない

### ファイルシステムアクセス

- データベースファイルの読み書き権限が必要
- パストラバーサル攻撃は該当なし（固定パス使用）

## 監視・ログ

### ログ出力

| ログレベル | メッセージ | タイミング |
|-----------|-----------|-----------|
| INFO | `🔄 スキーマ同期中...` | 開始時 |
| INFO | `   データベース: ${url}` | 開始時 |
| INFO | `✅ スキーマ同期完了` | 成功時 |
| ERROR | `❌ スキーマ同期失敗: ${error}` | 失敗時 |

### Systemdログ統合

```bash
# Systemdログでスキーマ同期を確認
journalctl -u claude-work -f | grep "スキーマ同期"
```

## 参照

- [要件定義 US-001](../../../requirements/migration-error-prevention/stories/US-001.md) @../../../requirements/migration-error-prevention/stories/US-001.md
- [設計概要](../index.md) @../index.md
- [決定事項 DEC-001: マイグレーションツール選択](../decisions/DEC-001.md) @../decisions/DEC-001.md
