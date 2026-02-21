# タスク: Prisma 7 アップグレード

> **廃止**: Drizzle ORM移行（PR #132）により、Prismaは完全に削除されました。
> このタスクの未完了項目はすべて不要です。フェーズ1-3はDrizzle移行前の中間成果物として完了済み。
> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 実装計画

### フェーズ1: 依存パッケージの更新

#### タスク1.1: package.json の更新

**説明**:
- `prisma` と `@prisma/client` を 7.x に更新
- `@prisma/adapter-better-sqlite3` を追加
- `@types/better-sqlite3` を追加

**技術的文脈**:
```bash
pnpm add @prisma/client@7 @prisma/adapter-better-sqlite3@7
pnpm add -D prisma@7 @types/better-sqlite3
```

**受入基準**:
- [x] Prisma パッケージが 7.x にアップグレードされている
- [x] アダプターパッケージがインストールされている

**依存関係**: なし
**ステータス**: `DONE`

---

### フェーズ2: Prisma 設定ファイルの更新

#### タスク2.1: prisma.config.ts の作成

**説明**:
- プロジェクトルートに `prisma.config.ts` を作成
- データソースURLの設定を移行

**技術的文脈**:
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

**受入基準**:
- [x] `prisma.config.ts` が作成されている
- [x] `DATABASE_URL` が正しく参照されている

**依存関係**: タスク1.1
**ステータス**: `DONE`

---

#### タスク2.2: schema.prisma の更新

**説明**:
- generator の `provider` を `prisma-client` に変更
- `output` フィールドを追加
- `moduleFormat = "cjs"` を追加（CommonJSプロジェクト向け）

**技術的文脈**:
```prisma
generator client {
  provider     = "prisma-client"
  output       = "./generated/prisma"
  moduleFormat = "cjs"
}
```

**受入基準**:
- [x] provider が `prisma-client` になっている
- [x] output が `./generated/prisma` に設定されている
- [x] moduleFormat が `cjs` に設定されている

**依存関係**: タスク1.1
**ステータス**: `DONE`

---

#### タスク2.3: .gitignore の更新

**説明**:
- 生成されたクライアントディレクトリを除外

**技術的文脈**:
```
# Prisma generated client
prisma/generated/
```

**受入基準**:
- [x] `prisma/generated/` が .gitignore に追加されている

**依存関係**: なし
**ステータス**: `DONE`

---

#### タスク2.4: Prisma クライアント生成の確認

**説明**:
- `prisma generate` を実行してクライアントが正しく生成されることを確認

**受入基準**:
- [x] `prisma generate` がエラーなく完了する
- [x] `prisma/generated/prisma/` にファイルが生成されている

**依存関係**: タスク2.1, タスク2.2
**ステータス**: `DONE`

---

### フェーズ3: アプリケーションコードの更新

#### タスク3.1: src/lib/db.ts の更新

**説明**:
- アダプターパターンに変更
- インポートパスを生成先に変更
- dotenv/config をインポート（早期の環境変数読み込み）

**技術的文脈**:
```typescript
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, Prisma } from '../../prisma/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.trim() === '') {
  throw new Error('DATABASE_URL environment variable is not set...');
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
export const prisma = new PrismaClient({ adapter });
```

**受入基準**:
- [x] `PrismaBetterSqlite3` アダプターを使用している
- [x] インポートパスが `prisma/generated/prisma/client` になっている
- [x] シングルトンパターンが維持されている
- [x] dotenv/config がインポートされている

**依存関係**: タスク2.4
**ステータス**: `DONE`

---

#### タスク3.2: インポートパスの一括更新

**説明**:
- `@prisma/client` からのインポートを `@/lib/db` に変更
- 対象: `Prisma` 名前空間を使用しているファイル

**対象ファイル**:
- `src/services/environment-service.ts`
- `src/services/adapter-factory.ts`
- `prisma/seed-environments.ts`
- API ルートのテストファイル

**受入基準**:
- [x] 全ての `@prisma/client` インポートが更新されている
- [x] TypeScript コンパイルエラーがない

**依存関係**: タスク3.1
**ステータス**: `DONE`

---

#### タスク3.3: テストファイルの更新

**説明**:
- テストファイル内のインポートパスを更新
- モック設定を必要に応じて調整
- vitest.global-setup.ts を Prisma 7 CLI 変更に対応

**受入基準**:
- [x] テストファイルのインポートが更新されている
- [x] モックが正しく動作する
- [x] vitest.global-setup.ts が Prisma 7 に対応している

**依存関係**: タスク3.2
**ステータス**: `DONE`

---

### フェーズ4: CLI の更新

#### タスク4.1: CLI での Prisma 生成コマンド確認

**説明**:
- `src/bin/cli.ts` での `prisma generate` が正しく動作することを確認
- 必要に応じてパスや引数を調整

**受入基準**:
- ~~`npx claude-work` で Prisma クライアント生成が成功する~~ (Drizzle移行により不要)
- ~~データベースセットアップが正常に動作する~~ (Drizzle移行により不要)

**依存関係**: タスク3.2
**ステータス**: `OBSOLETE`

---

### フェーズ5: テストと検証

#### タスク5.1: ユニットテストの実行

**説明**:
- 全てのユニットテストを実行
- 失敗するテストがあれば修正

**結果**: 1249 passed, 22 failed (Prisma 7 とは無関係の既存の失敗)

**受入基準**:
- [x] `pnpm test` が実行される
- [x] Prisma 関連のテストが全て通過する

**依存関係**: タスク4.1
**ステータス**: `DONE`

---

#### タスク5.2: 開発サーバーでの動作確認

**説明**:
- `pnpm run dev` で開発サーバーを起動
- 基本的な操作（セッション作成・削除等）を確認

**受入基準**:
- [x] 開発サーバーが起動する
- ~~セッション作成が動作する~~ (Drizzle移行により不要)
- ~~セッション削除が動作する~~ (Drizzle移行により不要)

**依存関係**: タスク5.1
**ステータス**: `OBSOLETE`

---

#### タスク5.3: 本番ビルドでの動作確認

**説明**:
- `npm run build` でビルド
- `npx claude-work help` で CLI 動作確認

**受入基準**:
- [x] ビルドが成功する
- ~~CLI コマンドが動作する~~ (Drizzle移行により不要)

**依存関係**: タスク5.2
**ステータス**: `OBSOLETE`

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `DONE` - 完了
- `OBSOLETE` - 廃止（別の方法で解決済み）
