# 設計: Prisma 7 アップグレード

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] 目的: Prisma 5.22.0 → 7.x へのアップグレード
- [x] データベース: SQLite（変更なし）
- [x] 既存機能の互換性維持が必要

### 不明/要確認の情報

なし

---

## アーキテクチャ概要

```text
変更前 (Prisma 5.x):
┌─────────────────────────────────────────────────────────────┐
│  schema.prisma                                               │
│    datasource db {                                           │
│      url = env("DATABASE_URL")  ← ここでURL指定             │
│    }                                                         │
│                     ↓                                        │
│  @prisma/client (node_modules内に生成)                       │
│                     ↓                                        │
│  new PrismaClient() ← オプションなしで初期化                 │
└─────────────────────────────────────────────────────────────┘

変更後 (Prisma 7.x):
┌─────────────────────────────────────────────────────────────┐
│  prisma.config.ts                                            │
│    datasource: { url: env('DATABASE_URL') }  ← URL指定      │
│                                                              │
│  schema.prisma                                               │
│    generator client {                                        │
│      provider = "prisma-client"                              │
│      output   = "./generated/prisma"  ← 生成先指定          │
│    }                                                         │
│                     ↓                                        │
│  prisma/generated/prisma/ (プロジェクト内に生成)             │
│                     ↓                                        │
│  @prisma/adapter-better-sqlite3                              │
│                     ↓                                        │
│  new PrismaClient({ adapter })  ← アダプター必須             │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント

### コンポーネント1: package.json

**目的**: 依存パッケージの更新

**変更内容**:
```json
{
  "dependencies": {
    "@prisma/client": "^7.0.0",
    "@prisma/adapter-better-sqlite3": "^7.0.0"
  },
  "devDependencies": {
    "prisma": "^7.0.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

### コンポーネント2: prisma.config.ts（新規）

**目的**: Prisma 7 の設定ファイル

**配置**: プロジェクトルート

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### コンポーネント3: prisma/schema.prisma

**目的**: ジェネレーター設定の更新

**変更内容**:
```prisma
generator client {
  provider = "prisma-client"
  output   = "./generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // 互換性のため残す（Prisma 7では無視される）
}
```

### コンポーネント4: src/lib/db.ts

**目的**: PrismaClient の初期化をアダプターパターンに変更

**変更内容**:
```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../prisma/generated/prisma';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

### コンポーネント5: インポートパスの更新

**目的**: 生成されたクライアントのパスに変更

**対象ファイル**: `@prisma/client` をインポートしている全ファイル

**変更内容**:
```typescript
// 変更前
import { PrismaClient, Prisma } from '@prisma/client';

// 変更後
import { PrismaClient, Prisma } from '../../prisma/generated/prisma';
```

### コンポーネント6: .gitignore

**目的**: 生成されたクライアントをバージョン管理から除外

**追加内容**:
```
# Prisma generated client
prisma/generated/
```

### コンポーネント7: tsconfig.json

**目的**: 生成されたクライアントのパスエイリアス設定

**追加内容**:
```json
{
  "compilerOptions": {
    "paths": {
      "@/generated/prisma": ["./prisma/generated/prisma"],
      "@/generated/prisma/*": ["./prisma/generated/prisma/*"]
    }
  }
}
```

## 技術的決定事項

### 決定1: better-sqlite3 アダプターの採用

**検討した選択肢**:
1. `@prisma/adapter-better-sqlite3`
   - メリット: 標準的な SQLite アダプター
   - デメリット: better-sqlite3 12.4.1 に固定
2. `@prisma/adapter-libsql`
   - メリット: Turso 対応
   - デメリット: バージョン互換性の問題あり

**決定**: `@prisma/adapter-better-sqlite3`

**根拠**: ローカル SQLite 使用のため標準アダプターで十分

### 決定2: 生成先ディレクトリ

**決定**: `prisma/generated/prisma/`

**根拠**:
- Prisma 公式推奨のパス
- `prisma/` 配下で関連ファイルをまとめられる
- `.gitignore` での管理が容易

### 決定3: CommonJS 互換維持

**決定**: `package.json` に `"type": "module"` を追加しない

**根拠**:
- 既存の Next.js + TypeScript 設定との互換性維持
- 大規模なリファクタリングを回避

## ファイル変更一覧

| ファイル | 変更種別 | 変更内容 |
|----------|----------|----------|
| `package.json` | 更新 | Prisma パッケージを 7.x に更新、アダプター追加 |
| `prisma.config.ts` | 新規 | Prisma 7 設定ファイル |
| `prisma/schema.prisma` | 更新 | generator の provider と output 変更 |
| `src/lib/db.ts` | 更新 | アダプターパターンに変更 |
| `src/lib/db.test.ts` | 更新 | インポートパス変更 |
| `.gitignore` | 更新 | 生成ディレクトリ追加 |
| その他 `@prisma/client` インポート | 更新 | インポートパス変更 |

## テスト戦略

### ユニットテスト

- `src/lib/db.test.ts`: PrismaClient 初期化テスト
- 既存のAPI テストが全て通過すること

### 動作確認

1. `pnpm run dev` で開発サーバー起動
2. `npx claude-work` で本番ビルド・起動
3. セッション作成・削除の動作確認
