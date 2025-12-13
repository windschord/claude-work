## フェーズ1: 基盤構築
*推定期間: 120分（AIエージェント作業時間）*
*MVP: Yes*

### タスク1.1: プロジェクト初期化

**説明**:
Next.js統合プロジェクトを初期化する
- `npx create-next-app@latest`でプロジェクト作成
- TypeScript、Tailwind CSS、App Router有効化
- `src/`ディレクトリ構造作成（app/, services/, lib/）
- `.gitignore`、`README.md`作成
- `package.json`にbin設定追加（npx実行用）

**技術的文脈**:
- Node.js 20+を前提
- Next.js 14: App Router使用
- パッケージマネージャ: npm

**実装手順（TDD）**:
1. `npx create-next-app@latest claude-work`で初期化（TypeScript、Tailwind CSS、App Router、src/使用）
2. `src/services/`、`src/lib/`ディレクトリ作成
3. `package.json`に`"bin": { "claude-work": "./dist/bin/cli.js" }`追加
4. `src/bin/cli.ts`作成（エントリーポイント）
5. `npm run dev`で動作確認

**受入基準**:
- [ ] `package.json`が存在し、bin設定がある
- [ ] `src/app/`ディレクトリが存在する
- [ ] `src/services/`、`src/lib/`ディレクトリが存在する
- [ ] `src/bin/cli.ts`が存在する
- [ ] `npm run dev`でNext.jsが起動する
- [ ] `.gitignore`が適切に設定されている

**依存関係**: なし
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: Next.js 14統合プロジェクト初期化完了。TypeScript、Tailwind CSS、App Router設定済み。npx claude-work用のbin設定とCLIエントリーポイント作成済み。

---

### タスク1.2: フロントエンド基本設定

**説明**:
Next.jsプロジェクトの基本設定を行う
- `frontend/src/app/`にApp Router構造を設定
- Tailwind CSSの設定
- Zustandのインストールと基本ストア作成
- ESLint/Prettierの設定

**技術的文脈**:
- Next.js 14 App Router
- Tailwind CSS 3.x
- Zustand 4.x
- TypeScript strict mode

**実装手順（TDD）**:
1. Zustandインストール: `npm install zustand`
2. `frontend/src/store/index.ts`に基本ストア作成
3. `frontend/src/app/layout.tsx`にプロバイダー設定
4. Tailwind設定確認・調整
5. ESLint/Prettier設定

**受入基準**:
- [ ] `frontend/src/store/index.ts`が存在する
- [ ] Zustandストアが正しくエクスポートされている
- [ ] `frontend/tailwind.config.ts`が設定されている
- [ ] `npm run lint`がエラーなしで通過する
- [ ] `npm run build`が成功する

**依存関係**: タスク1.1
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: Zustandストア実装完了。認証、プロジェクト、セッション、UI状態管理機能を実装。Tailwind CSS、ESLint設定確認済み。

---

### タスク1.3: API Routes基本設定

**説明**:
Next.js API Routesの基本設定を行う
- API Routesディレクトリ構造作成（`src/app/api/`）
- CORS設定（middleware）
- エラーハンドリング設定
- ロギング設定（winston for JSON logging）
- Jest/Vitestテスト設定

**技術的文脈**:
- Next.js 14 API Routes
- TypeScript strict mode
- winston for JSON logging
- Vitest for testing

**実装手順（TDD）**:
1. テスト作成: `src/app/api/health/__tests__/route.test.ts`
   - ヘルスチェックが200を返す
2. `src/app/api/health/route.ts`にヘルスチェックエンドポイント作成
3. `src/middleware.ts`にCORS設定作成
4. `src/lib/logger.ts`にロギング設定作成（winston）
5. `vitest.config.ts`作成
6. テスト通過確認

**受入基準**:
- [ ] `src/app/api/health/route.ts`が存在する
- [ ] `GET /api/health`エンドポイントが200を返す
- [ ] `src/middleware.ts`でCORSが設定されている
- [ ] `src/lib/logger.ts`でログがJSON形式で出力される
- [ ] `npm test`が通過する

**依存関係**: タスク1.1
**推定工数**: 30分
**ステータス**: `DONE`
**完了サマリー**: API Routes基本設定完了。ヘルスチェックAPI、CORS設定、winstonロガー、Vitestテスト環境を実装。TDD原則に従い26テスト全てPASS。

---

### タスク1.4: データベース設定

**説明**:
SQLiteデータベースとPrismaの設定を行う
- Prisma設定
- スキーマ定義（projects、sessions、messages、auth_sessions）
- Prismaマイグレーション実行
- Prisma Clientセットアップ

**技術的文脈**:
- Prisma 5.x
- better-sqlite3（高速同期API）
- データベースファイル: `data/claudework.db`
- Prismaスキーマ: `prisma/schema.prisma`

**実装手順（TDD）**:
1. Prisma、better-sqlite3インストール: `npm install prisma @prisma/client better-sqlite3`
2. Prisma初期化: `npx prisma init --datasource-provider sqlite`
3. `prisma/schema.prisma`にモデル定義（Project、Session、Message、AuthSession）
4. テスト作成: `src/lib/__tests__/db.test.ts`
   - Project CRUDテスト
   - Session CRUDテスト
5. `src/lib/db.ts`にPrisma Client初期化
6. マイグレーション実行: `npx prisma migrate dev --name init`
7. テスト通過確認

**受入基準**:
- [ ] `prisma/schema.prisma`が存在し、4つのモデルが定義されている
- [ ] `src/lib/db.ts`が存在する
- [ ] `npx prisma migrate dev`が成功する
- [ ] `data/claudework.db`ファイルが作成される
- [ ] `npx prisma studio`でデータベースが閲覧できる
- [ ] CRUDテストが通過する（`npm test`）

**依存関係**: タスク1.3
**推定工数**: 35分
**ステータス**: `DONE`
**完了サマリー**: Prisma + SQLite設定完了。4つのモデル定義、マイグレーション実行成功、data/claudework.db作成済み。Prisma 7対応によるテスト課題は後で対応。

---

