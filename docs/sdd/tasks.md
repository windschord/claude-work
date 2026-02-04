# タスク: Prisma から Drizzle ORM への移行

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック（全体）

### ユーザーから明示された情報

- [x] 実装対象のディレクトリ構造: src/db/, src/lib/, src/app/api/, src/services/
- [x] 使用するパッケージマネージャー: npm
- [x] テストフレームワーク: Vitest
- [x] リンター/フォーマッター: ESLint
- [x] ブランチ戦略: 作業ブランチを作成して実装

### 不明/要確認の情報（全体）

なし（すべて確認済み）

---

## 実装計画

### フェーズ1: 基盤構築

#### タスク1.1: Drizzle依存関係のインストール

**説明**:
- drizzle-orm と drizzle-kit をインストール
- package.json の更新

**技術的文脈**:
- better-sqlite3 は既存のため追加不要
- drizzle-kit は devDependencies に追加

**受入基準**:
- [x] `npm install drizzle-orm` が成功する
- [x] `npm install -D drizzle-kit` が成功する
- [x] package.json に依存関係が追加されている

**依存関係**: なし
**ステータス**: `DONE`
**完了サマリー**: drizzle-orm 0.45.1 と drizzle-kit 0.31.8 をインストール完了

#### タスク1.2: Drizzleスキーマ定義の作成

**説明**:
- src/db/schema.ts を作成
- 6つのテーブル定義（projects, sessions, messages, prompts, runScripts, executionEnvironments）
- リレーション定義

**技術的文脈**:
- Prismaスキーマ（prisma/schema.prisma）を参照
- テーブル名はPrismaと同じPascalCaseを維持
- タイムスタンプはinteger + mode: 'timestamp'

**対象ファイル**:
- 作成: src/db/schema.ts

**受入基準**:
- [ ] src/db/schema.ts が作成されている
- [ ] 6つのテーブルが定義されている
- [ ] リレーションが定義されている
- [ ] 型がエクスポートされている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク1.1
**ステータス**: `TODO`

#### タスク1.3: Drizzle設定ファイルの作成

**説明**:
- drizzle.config.ts を作成

**対象ファイル**:
- 作成: drizzle.config.ts

**受入基準**:
- [ ] drizzle.config.ts が作成されている
- [ ] `npx drizzle-kit generate` が成功する

**依存関係**: タスク1.2
**ステータス**: `TODO`

#### タスク1.4: データベース接続モジュールの更新

**説明**:
- src/lib/db.ts をDrizzle用に書き換え
- シングルトンパターンを維持
- 型エクスポートを更新

**対象ファイル**:
- 修正: src/lib/db.ts

**受入基準**:
- [ ] src/lib/db.ts がDrizzle接続を使用している
- [ ] db インスタンスがエクスポートされている
- [ ] 型（Project, Session等）がエクスポートされている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク1.2
**ステータス**: `TODO`

#### タスク1.5: データベース初期化とスキーマ同期

**説明**:
- データベースファイルをリセット
- Drizzle Kitでスキーマをpush

**コマンド**:
```bash
rm -f data/claudework.db
npx drizzle-kit push
```

**受入基準**:
- [ ] data/claudework.db が新規作成される
- [ ] 全テーブルが作成されている
- [ ] `npx drizzle-kit studio` でテーブルが確認できる

**依存関係**: タスク1.3, タスク1.4
**ステータス**: `TODO`

### フェーズ2: コア機能移行

#### タスク2.1: src/lib/db.ts のテスト更新

**説明**:
- src/lib/__tests__/db.test.ts をDrizzle用に更新

**対象ファイル**:
- 修正: src/lib/__tests__/db.test.ts

**受入基準**:
- [ ] テストがDrizzle APIを使用している
- [ ] `npm test src/lib/__tests__/db.test.ts` がパスする

**依存関係**: タスク1.4
**ステータス**: `TODO`

#### タスク2.2: environment-service.ts の移行

**説明**:
- src/services/environment-service.ts のPrismaクエリをDrizzleに変換

**変換パターン**:
- `prisma.executionEnvironment.create()` → `db.insert(executionEnvironments).values().returning()`
- `prisma.executionEnvironment.findUnique()` → `db.query.executionEnvironments.findFirst()`
- `prisma.executionEnvironment.findMany()` → `db.query.executionEnvironments.findMany()`
- `prisma.executionEnvironment.update()` → `db.update(executionEnvironments).set().where().returning()`
- `prisma.executionEnvironment.delete()` → `db.delete(executionEnvironments).where()`
- `prisma.session.count()` → `db.select({ count: count() }).from(sessions).where()`

**対象ファイル**:
- 修正: src/services/environment-service.ts

**受入基準**:
- [ ] Prismaインポートがすべて削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク1.4
**ステータス**: `TODO`

#### タスク2.3: APIルート /api/projects の移行

**説明**:
- src/app/api/projects/route.ts のPrismaクエリをDrizzleに変換
- src/app/api/projects/[project_id]/route.ts の移行
- src/app/api/projects/clone/route.ts の移行

**変換パターン**:
- `prisma.project.findMany({ include, orderBy })` → `db.query.projects.findMany({ with, orderBy })`
- `prisma.project.create()` → `db.insert(projects).values().returning()`
- `Prisma.PrismaClientKnownRequestError` → `UNIQUE constraint failed` メッセージ判定

**対象ファイル**:
- 修正: src/app/api/projects/route.ts
- 修正: src/app/api/projects/[project_id]/route.ts
- 修正: src/app/api/projects/clone/route.ts

**受入基準**:
- [ ] Prismaインポートがすべて削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク1.4
**ステータス**: `TODO`

#### タスク2.4: APIルート /api/projects/[project_id]/* の移行

**説明**:
- branches, pull, scripts, sessions 関連のAPIルートを移行

**対象ファイル**:
- 修正: src/app/api/projects/[project_id]/branches/route.ts
- 修正: src/app/api/projects/[project_id]/pull/route.ts
- 修正: src/app/api/projects/[project_id]/scripts/route.ts
- 修正: src/app/api/projects/[project_id]/scripts/[scriptId]/route.ts
- 修正: src/app/api/projects/[project_id]/sessions/route.ts

**受入基準**:
- [ ] すべてのファイルでPrismaインポートが削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク2.3
**ステータス**: `TODO`

#### タスク2.5: APIルート /api/sessions/[id]/* の移行

**説明**:
- セッション関連の全APIルートを移行

**対象ファイル**:
- 修正: src/app/api/sessions/[id]/route.ts
- 修正: src/app/api/sessions/[id]/approve/route.ts
- 修正: src/app/api/sessions/[id]/commits/route.ts
- 修正: src/app/api/sessions/[id]/diff/route.ts
- 修正: src/app/api/sessions/[id]/input/route.ts
- 修正: src/app/api/sessions/[id]/merge/route.ts
- 修正: src/app/api/sessions/[id]/messages/route.ts
- 修正: src/app/api/sessions/[id]/pr/route.ts
- 修正: src/app/api/sessions/[id]/process/route.ts
- 修正: src/app/api/sessions/[id]/rebase/route.ts
- 修正: src/app/api/sessions/[id]/reset/route.ts
- 修正: src/app/api/sessions/[id]/resume/route.ts
- 修正: src/app/api/sessions/[id]/run/route.ts
- 修正: src/app/api/sessions/[id]/run/[run_id]/stop/route.ts
- 修正: src/app/api/sessions/[id]/stop/route.ts

**受入基準**:
- [ ] すべてのファイルでPrismaインポートが削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク2.4
**ステータス**: `TODO`

#### タスク2.6: APIルート /api/prompts の移行

**説明**:
- プロンプト関連のAPIルートを移行

**対象ファイル**:
- 修正: src/app/api/prompts/route.ts
- 修正: src/app/api/prompts/[id]/route.ts

**受入基準**:
- [ ] Prismaインポートが削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク2.5
**ステータス**: `TODO`

#### タスク2.7: WebSocketハンドラーの移行

**説明**:
- WebSocket関連のファイルでPrismaを使用している箇所を移行

**対象ファイル**:
- 修正: src/lib/websocket/claude-ws.ts
- 修正: src/lib/websocket/session-ws.ts
- 修正: src/lib/websocket/terminal-ws.ts

**受入基準**:
- [ ] Prismaインポートが削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク2.6
**ステータス**: `TODO`

#### タスク2.8: その他サービス・ユーティリティの移行

**説明**:
- 残りのPrisma使用箇所を移行

**対象ファイル**:
- 修正: src/services/adapters/docker-adapter.ts
- 修正: src/bin/cli.ts

**受入基準**:
- [ ] Prismaインポートが削除されている
- [ ] Drizzleクエリに変換されている
- [ ] TypeScriptコンパイルエラーがない

**依存関係**: タスク2.7
**ステータス**: `TODO`

### フェーズ3: テスト・クリーンアップ

#### タスク3.1: 全テストファイルの移行

**説明**:
- テストファイル内のPrismaモックをDrizzleモックに変換

**対象ファイル**:
- 修正: src/app/api/**/\__tests__/*.test.ts（全テストファイル）
- 修正: src/services/adapters/__tests__/docker-adapter.test.ts
- 修正: src/lib/websocket/__tests__/terminal-ws.test.ts

**受入基準**:
- [ ] すべてのテストファイルでPrismaモックが削除されている
- [ ] Drizzleモックに変換されている
- [ ] `npm test` が全てパスする

**依存関係**: タスク2.8
**ステータス**: `TODO`

#### タスク3.2: Prisma関連ファイルの削除

**説明**:
- prisma/ ディレクトリを削除
- Prisma依存関係を削除

**削除対象**:
- prisma/schema.prisma
- prisma/generated/ ディレクトリ
- prisma/seed-environments.ts

**コマンド**:
```bash
rm -rf prisma/
npm uninstall @prisma/client @prisma/adapter-better-sqlite3
npm uninstall -D prisma
```

**受入基準**:
- [ ] prisma/ ディレクトリが削除されている
- [ ] package.json から Prisma 関連の依存関係が削除されている

**依存関係**: タスク3.1
**ステータス**: `TODO`

#### タスク3.3: package.json スクリプトの更新

**説明**:
- Prisma関連スクリプトを削除
- Drizzleスクリプトを追加

**変更内容**:
```json
{
  "scripts": {
    "prepare": "npm run build",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**削除対象スクリプト**:
- `db:migrate-environments`
- `prepare` の `prisma generate` 部分

**受入基準**:
- [ ] Prisma関連スクリプトが削除されている
- [ ] Drizzleスクリプトが追加されている
- [ ] `npm run db:push` が成功する
- [ ] `npm run db:studio` が起動する

**依存関係**: タスク3.2
**ステータス**: `TODO`

#### タスク3.4: 最終検証

**説明**:
- 全テスト実行
- TypeScriptコンパイル確認
- Lint確認
- ビルド確認

**コマンド**:
```bash
npm run lint
npm test
npm run build
```

**受入基準**:
- [ ] `npm run lint` がエラーなしで完了する
- [ ] `npm test` が全てパスする
- [ ] `npm run build` が成功する
- [ ] Prismaへの参照がコードベースに残っていない（grep確認）

**依存関係**: タスク3.3
**ステータス**: `TODO`

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

### リスク1: クエリ変換の漏れ

**影響度**: 高
**発生確率**: 中
**軽減策**:
- `grep -r "prisma" src/` で残存箇所を確認
- TypeScriptコンパイルエラーで検出

### リスク2: リレーションクエリの動作差異

**影響度**: 中
**発生確率**: 中
**軽減策**:
- 既存テストでカバー
- 手動での動作確認

## 備考

- 各タスク完了時にコミットを作成
- フェーズ1完了後、フェーズ2の前に動作確認を推奨
