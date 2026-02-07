# 設計書: データディレクトリ永続化

## 1. アーキテクチャ概要

### 変更対象コンポーネント

```text
src/lib/data-dir.ts                  [新規] DATA_DIR解決ユーティリティ
src/services/remote-repo-service.ts  [変更] reposベースディレクトリの外部化
src/app/api/projects/clone/route.ts  [変更] reposベースディレクトリの外部化
src/services/auth-directory-manager.ts [変更] environmentsベースディレクトリの外部化
server.ts                            [変更] 起動時のDATA_DIR検証・ディレクトリ作成
docs/ENV_VARS.md                     [変更] DATA_DIR環境変数の説明追記
docs/SYSTEMD_SETUP.md                [変更] DATA_DIR推奨設定の追記
```

### データフロー

```text
環境変数 DATA_DIR (例: /opt/claude-work/data)
  │
  ├─ getReposDir()  → ${DATA_DIR}/repos/     (リポジトリclone先)
  ├─ getEnvironmentsDir() → ${DATA_DIR}/environments/ (Docker認証情報)
  └─ (参考) DATABASE_URL は既に外部化済み
```

## 2. コンポーネント詳細設計

### 2.1 data-dir.ts（新規）

DATA_DIRの解決ロジックを一元管理するユーティリティモジュール。

```typescript
import path from 'path';
import fs from 'fs';

/**
 * DATA_DIRのベースパスを取得する。
 * - DATA_DIR環境変数が設定されている場合はそのパスを使用
 * - 未設定の場合は process.cwd()/data を使用（後方互換性）
 */
export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR;
  if (dataDir) {
    return path.resolve(dataDir);
  }
  return path.resolve(process.cwd(), 'data');
}

/**
 * リポジトリディレクトリのパスを取得する。
 */
export function getReposDir(): string {
  return path.join(getDataDir(), 'repos');
}

/**
 * 環境ディレクトリのパスを取得する。
 */
export function getEnvironmentsDir(): string {
  return path.join(getDataDir(), 'environments');
}

/**
 * DATA_DIRとサブディレクトリを初期化する。
 * サーバー起動時に呼び出す。
 */
export function ensureDataDirs(): void {
  const dirs = [getDataDir(), getReposDir(), getEnvironmentsDir()];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
```

### 2.2 remote-repo-service.ts の変更

`join(process.cwd(), 'data', 'repos')` を `getReposDir()` に置換。

変更箇所（行167付近）:

```typescript
// 変更前
const base = baseDir || join(process.cwd(), 'data', 'repos');

// 変更後
import { getReposDir } from '@/lib/data-dir';
const base = baseDir || getReposDir();
```

### 2.3 clone/route.ts の変更

同様に `join(process.cwd(), 'data', 'repos')` を `getReposDir()` に置換。

変更箇所（行102付近）:

```typescript
// 変更前
baseDir = join(process.cwd(), 'data', 'repos');

// 変更後
import { getReposDir } from '@/lib/data-dir';
baseDir = getReposDir();
```

### 2.4 auth-directory-manager.ts の変更

コンストラクタのデフォルト値を `getEnvironmentsDir()` に変更。

変更箇所（行18-21）:

```typescript
// 変更前
constructor(baseDir?: string) {
  this.baseDir = baseDir || path.resolve(process.cwd(), 'data', 'environments');
}

// 変更後
import { getEnvironmentsDir } from '@/lib/data-dir';

constructor(baseDir?: string) {
  this.baseDir = baseDir || getEnvironmentsDir();
}
```

### 2.5 server.ts の変更

起動処理に `ensureDataDirs()` を追加。DATA_DIR設定時にログ出力。

```typescript
import { ensureDataDirs, getDataDir } from '@/lib/data-dir';

// 起動時（環境変数検証の直後）
console.log('  DATA_DIR:', process.env.DATA_DIR || 'NOT SET (using default)');

// ディレクトリ初期化
ensureDataDirs();
logger.info('Data directories initialized', { dataDir: getDataDir() });
```

## 3. ファイル変更一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/lib/data-dir.ts` | 新規: DATA_DIR解決ユーティリティ |
| `src/lib/__tests__/data-dir.test.ts` | 新規: data-dirのユニットテスト |
| `src/services/remote-repo-service.ts` | `process.cwd()/data/repos` → `getReposDir()` |
| `src/app/api/projects/clone/route.ts` | `process.cwd()/data/repos` → `getReposDir()` |
| `src/services/auth-directory-manager.ts` | `process.cwd()/data/environments` → `getEnvironmentsDir()` |
| `server.ts` | 起動時のDATA_DIRログ出力とディレクトリ初期化 |
| `docs/ENV_VARS.md` | DATA_DIR環境変数の説明追記 |
| `docs/SYSTEMD_SETUP.md` | DATA_DIR推奨設定の追記 |

## 4. 技術的決定事項

### TD-001: 環境変数名 - DATA_DIR

**選択:** `DATA_DIR`
**理由:** DATABASE_URLと同レベルの抽象度。`REPOS_DIR` + `ENVIRONMENTS_DIR` のように個別にする案もあるが、両方とも `data/` 配下のサブディレクトリであり、一括で管理する方がシンプル。

### TD-002: デフォルト値 - process.cwd()/data

**選択:** DATA_DIR未設定時は `process.cwd()/data` をデフォルトとする
**理由:** 後方互換性を維持する。ローカル開発環境ではprocess.cwd()がプロジェクトルートであるため、既存の動作と同一。

### TD-003: ユーティリティの配置 - src/lib/data-dir.ts

**選択:** `src/lib/data-dir.ts` に一元化
**理由:** 複数のサービス・ルートから参照されるため、共通ユーティリティとして配置。パス解決ロジックの重複を防ぐ。

## 5. セキュリティ考慮事項

### SEC-001: パストラバーサル防止

`getDataDir()` は `path.resolve()` で絶対パスに正規化する。各サービスの既存のパストラバーサル防止ロジック（AuthDirectoryManagerの環境ID検証、GitServiceのworktreeパス検証）はそのまま維持する。

### SEC-002: ディレクトリ権限

`ensureDataDirs()` で作成するディレクトリはデフォルト権限（umaskに従う）。systemd環境では `claude-work` ユーザーの権限で実行されるため、適切な権限が設定される。
