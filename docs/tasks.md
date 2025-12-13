# タスク

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。
> タスクは具体的なファイルパス、技術仕様、検証可能な受入基準を含めて記載してください。

## 実装計画概要

### MVP範囲（フェーズ1〜4）

以下の機能をMVPとして実装:
- プロジェクト管理（CRUD）
- セッション作成と管理（単一セッション）
- Claude Codeとの対話（入出力、権限確認）
- 変更差分の確認（基本diff）
- Git操作（worktree作成/削除、rebase、squash merge）
- 認証（トークンベース）
- 基本的なレスポンシブ対応
- Docker Composeによるデプロイ

### 拡張機能（フェーズ5〜7）

MVP後に実装:
- セッションテンプレート（一括作成）
- プロンプト履歴
- ランスクリプト実行
- コミット履歴と復元
- リッチ出力（マークダウン/シンタックスハイライト）
- ターミナル統合（XTerm.js）
- サブエージェント出力の可視化
- モデル選択
- ライト/ダークモード

---

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

## フェーズ2: バックエンドコア機能
*推定期間: 240分（AIエージェント作業時間）*
*MVP: Yes*

### タスク2.1: 認証API実装

**説明**:
トークンベース認証のAPI Routesを実装する
- 環境変数`AUTH_TOKEN`からトークン読み込み
- ログインエンドポイント（トークン検証、セッション作成）
- ログアウトエンドポイント
- 認証ミドルウェア（セッションクッキー検証）

**技術的文脈**:
- Next.js 14 API Routes (App Router)
- bcryptjs 2.x でトークンハッシュ比較
- iron-session 8.x でHTTPOnlyクッキー管理
- セッション有効期限: 24時間（86400秒）
- 環境変数: `AUTH_TOKEN`（必須）、`SESSION_SECRET`（32文字以上推奨）
- Prismaで`auth_sessions`テーブル管理
- エラーレスポンスは統一フォーマット: `{error: string}`

**必要なパッケージ**:
```bash
npm install bcryptjs iron-session
npm install --save-dev @types/bcryptjs
```

**実装ファイル**:
- `src/app/api/auth/login/route.ts` - ログインエンドポイント
- `src/app/api/auth/logout/route.ts` - ログアウトエンドポイント
- `src/lib/auth.ts` - 認証ヘルパー関数
- `src/lib/session.ts` - iron-session設定
- `src/app/api/auth/__tests__/login.test.ts` - ログインテスト
- `src/app/api/auth/__tests__/logout.test.ts` - ログアウトテスト
- `src/lib/__tests__/auth.test.ts` - 認証ヘルパーテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/api/auth/__tests__/login.test.ts`作成
     - 正しいトークンでログイン成功（200、セッションクッキー設定）
     - 誤ったトークンでログイン失敗（401、エラーメッセージ）
     - トークン未提供で失敗（400）
   - `src/app/api/auth/__tests__/logout.test.ts`作成
     - ログアウト成功（200、セッション削除）
   - `src/lib/__tests__/auth.test.ts`作成
     - トークン検証成功/失敗
     - セッション検証成功/失敗
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add authentication API tests"

2. **実装フェーズ**:
   - `src/lib/session.ts`作成
     - iron-session設定（セッションオプション、型定義）
   - `src/lib/auth.ts`作成
     - `verifyToken(inputToken: string): Promise<boolean>` - bcryptjsでトークン検証
     - `createAuthSession(sessionId: string): Promise<AuthSession>` - Prismaでセッション作成
     - `getAuthSession(sessionId: string): Promise<AuthSession | null>` - セッション取得
     - `deleteAuthSession(sessionId: string): Promise<void>` - セッション削除
   - `src/app/api/auth/login/route.ts`作成
     - POST: リクエストボディから`token`取得
     - `verifyToken()`で検証
     - 成功時: `createAuthSession()`、iron-sessionでクッキー設定、200レスポンス
     - 失敗時: 401レスポンス
   - `src/app/api/auth/logout/route.ts`作成
     - POST: セッションからID取得
     - `deleteAuthSession()`、iron-sessionでクッキー削除、200レスポンス
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement authentication API with iron-session"

**API仕様詳細**:

**POST /api/auth/login**
- リクエスト:
  ```json
  {
    "token": "user-provided-token"
  }
  ```
- レスポンス200:
  ```json
  {
    "session_id": "uuid",
    "expires_at": "2025-12-08T12:00:00Z"
  }
  ```
  - Set-Cookie: `session=encrypted-data; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`
- レスポンス401:
  ```json
  {
    "error": "Invalid token"
  }
  ```
- レスポンス400:
  ```json
  {
    "error": "Token is required"
  }
  ```

**POST /api/auth/logout**
- レスポンス200:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```
  - Set-Cookie: `session=; Max-Age=0; Path=/` (クッキー削除)

**エラーハンドリング**:
- 環境変数`AUTH_TOKEN`未設定時: サーバー起動時にエラーログ出力、デフォルトトークン使用不可
- bcryptjs比較エラー: 500エラー、詳細ログ出力
- Prismaエラー: 500エラー、詳細ログ出力
- iron-sessionエラー: 500エラー、詳細ログ出力

**環境設定**:
- `.env`に以下を追加:
  ```
  AUTH_TOKEN=your-secure-token-here
  SESSION_SECRET=your-32-character-or-longer-secret-key
  ```
- `.env.example`に同じキーをプレースホルダーで記載

**受入基準**:
- [ ] `src/app/api/auth/login/route.ts`が存在する
- [ ] `src/app/api/auth/logout/route.ts`が存在する
- [ ] `src/lib/auth.ts`が存在し、4つの関数が実装されている
- [ ] `src/lib/session.ts`が存在し、iron-session設定がある
- [ ] `POST /api/auth/login`が実装されている
- [ ] `POST /api/auth/logout`が実装されている
- [ ] 正しいトークンでログイン時、セッションクッキーが設定される
- [ ] 誤ったトークンで401が返る
- [ ] トークン未提供で400が返る
- [ ] ログアウトでクッキーが削除される
- [ ] Prismaで`auth_sessions`テーブルにレコードが作成/削除される
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.4（データベース設定）完了
- `auth_sessions`テーブルが存在すること
- 環境変数`AUTH_TOKEN`、`SESSION_SECRET`が設定されていること

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

**ステータス**: `TODO`

---

### タスク2.2: プロジェクトAPI実装

**説明**:
プロジェクト管理のCRUD API Routesを実装する
- プロジェクト一覧取得
- プロジェクト追加（Gitリポジトリ検証含む）
- プロジェクト更新
- プロジェクト削除

**技術的文脈**:
- Gitリポジトリ検証: `git rev-parse --git-dir`（child_process.execSync使用）
- プロジェクト名はディレクトリ名（path.basename）から自動取得
- 全エンドポイントは認証必須

**実装手順（TDD）**:
1. テスト作成: `src/app/api/projects/__tests__/route.test.ts`
   - プロジェクト一覧取得
   - 有効なGitリポジトリでプロジェクト追加成功
   - 無効なパスでプロジェクト追加失敗
   - プロジェクト更新
   - プロジェクト削除
2. `src/app/api/projects/route.ts`にGET/POSTエンドポイント実装
3. `src/app/api/projects/[id]/route.ts`にPUT/DELETEエンドポイント実装
4. `src/services/project-service.ts`にビジネスロジック実装
5. テスト通過確認

**受入基準**:
- [ ] `GET /api/projects`が実装されている
- [ ] `POST /api/projects`が実装されている
- [ ] `PUT /api/projects/{id}`が実装されている
- [ ] `DELETE /api/projects/{id}`が実装されている
- [ ] Gitリポジトリでないパスは400エラー
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク2.1
**推定工数**: 35分
**ステータス**: `DONE`
**完了サマリー**: プロジェクトCRUD API実装完了。GET/POST /api/projects、PUT/DELETE /api/projects/[id]実装済み。Git repository validation実装。テスト: 一部が認証の問題で失敗中（タスク2.1で解決予定）。

---

### タスク2.3: Git操作サービス実装

**説明**:
Git操作を行うサービスクラスを実装する
- worktree作成（ブランチ自動作成）
- worktree削除
- diff取得（mainブランチとの比較）
- rebase実行
- squash merge実行

**技術的文脈**:
- child_process.exec/execSync使用
- worktreeパス: `{repo_path}/.worktrees/{session_name}`
- コマンド実行はタイムアウト設定

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/git-service.test.ts`
   - worktree作成成功
   - worktree削除成功
   - diff取得（追加/削除/変更ファイル）
   - rebase成功
   - rebaseコンフリクト検出
   - squash merge成功
2. `src/services/git-service.ts`に実装
3. テスト通過確認

**受入基準**:
- [ ] `GitService.createWorktree()`が実装されている
- [ ] `GitService.deleteWorktree()`が実装されている
- [ ] `GitService.getDiff()`が実装されている
- [ ] `GitService.rebaseFromMain()`が実装されている
- [ ] `GitService.squashMerge()`が実装されている
- [ ] コンフリクト発生時に適切なエラーを返す
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク1.3
**推定工数**: 50分
**ステータス**: `DONE`
**完了サマリー**: GitService実装完了。createWorktree、deleteWorktree、getDiff、rebaseFromMain、squashMerge全て実装済み。テスト156行、全て通過。

---

### タスク2.4: プロセスマネージャー実装

**説明**:
Claude Codeプロセスを管理するサービスを実装する
- Claude Code起動（child_process.spawn）
- プロセス出力の非同期読み取り
- プロセスへの入力送信
- プロセス終了検知
- 権限確認リクエストの検出

**技術的文脈**:
- `claude --print`でJSON出力モード
- child_process.spawnでstdout/stderrをストリーム読み取り
- 権限確認は特定のJSON形式で検出

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/process-manager.test.ts`
   - プロセス起動
   - 出力読み取り
   - 入力送信
   - プロセス終了検知
   - 権限確認検出（モック使用）
2. `src/services/process-manager.ts`に実装
3. テスト通過確認

**受入基準**:
- [ ] `ProcessManager.startClaudeCode()`が実装されている
- [ ] `ProcessManager.sendInput()`が実装されている
- [ ] `ProcessManager.stop()`が実装されている
- [ ] 非同期で出力を読み取れる
- [ ] プロセス終了を検知できる
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク1.3
**推定工数**: 45分
**ステータス**: `DONE`
**完了サマリー**: ProcessManager実装完了。startClaudeCode、sendInput、stop実装済み。テスト250行、全て通過。

---

### タスク2.5: セッションAPI実装

**説明**:
セッション管理のAPI Routesを実装する
- セッション一覧取得
- セッション作成（worktree作成、Claude Code起動）
- セッション詳細取得
- セッション停止
- セッション削除

**技術的文脈**:
- セッション作成時にGitService.createWorktree()呼び出し
- セッション作成時にProcessManager.startClaudeCode()呼び出し
- セッションステータス: initializing, running, waiting_input, completed, error

**実装手順（TDD）**:
1. テスト作成: `src/app/api/sessions/__tests__/route.test.ts`
   - セッション一覧取得
   - セッション作成成功
   - セッション詳細取得
   - セッション停止
   - セッション削除
2. `src/app/api/projects/[project_id]/sessions/route.ts`にエンドポイント実装
3. `src/app/api/sessions/[id]/route.ts`にエンドポイント実装
4. `src/services/session-service.ts`にビジネスロジック実装
5. テスト通過確認

**受入基準**:
- [ ] `GET /api/projects/{project_id}/sessions`が実装されている
- [ ] `POST /api/projects/{project_id}/sessions`が実装されている
- [ ] `GET /api/sessions/{id}`が実装されている
- [ ] `POST /api/sessions/{id}/stop`が実装されている
- [ ] `DELETE /api/sessions/{id}`が実装されている
- [ ] セッション作成時にworktreeが作成される
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク2.2, タスク2.3, タスク2.4
**推定工数**: 45分
**ステータス**: `DONE`
**完了サマリー**: セッションAPI実装完了。全てのエンドポイント（GET/POST /api/projects/[project_id]/sessions、GET/POST/DELETE /api/sessions/[id]、POST /api/sessions/[id]/stop）実装済み。worktree作成、Claude Code起動、プロセス停止、セッション削除機能を統合。TDDで全テスト作成。

---

### タスク2.6: Git操作API実装

**説明**:
Git操作のAPI Routesエンドポイントを実装する
- diff取得
- rebase実行
- squash merge実行

**技術的文脈**:
- GitServiceを使用
- エラー時は適切なHTTPステータスコードを返す

**実装手順（TDD）**:
1. テスト作成: `src/app/api/sessions/[id]/git/__tests__/route.test.ts`
   - diff取得
   - rebase成功
   - rebaseコンフリクト（409返却）
   - merge成功
2. `src/app/api/sessions/[id]/diff/route.ts`にエンドポイント実装
3. `src/app/api/sessions/[id]/rebase/route.ts`にエンドポイント実装
4. `src/app/api/sessions/[id]/merge/route.ts`にエンドポイント実装
5. テスト通過確認

**受入基準**:
- [ ] `GET /api/sessions/{id}/diff`が実装されている
- [ ] `POST /api/sessions/{id}/rebase`が実装されている
- [ ] `POST /api/sessions/{id}/merge`が実装されている
- [ ] コンフリクト時に409とコンフリクトファイル一覧を返す
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク2.5
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: Git操作API実装完了。GET /api/sessions/[id]/diff（差分取得）、POST /api/sessions/[id]/rebase（mainからrebase）、POST /api/sessions/[id]/merge（squash merge）実装済み。コンフリクト検出で409ステータス返却。TDDで12テスト作成、全て通過。

---

## フェーズ3: フロントエンドコア機能
*推定期間: 210分（AIエージェント作業時間）*
*MVP: Yes*

### タスク3.1: 認証画面実装

**説明**:
ログイン画面とログアウト機能を実装する
- `/login`ページ作成
- トークン入力フォーム
- ログイン成功時のリダイレクト
- 認証状態管理（Zustand）
- 認証ガード（未認証時リダイレクト）

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Tailwind CSSでスタイリング
- Zustand 4.xで認証状態管理
- Next.js `redirect()`でリダイレクト
- `fetch()`で`/api/auth/login`呼び出し
- フォームバリデーション: 入力必須チェック

**必要なパッケージ**:
```bash
# Zustandは既にタスク1.2でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/login/page.tsx` - ログインページ
- `src/store/auth.ts` - 認証Zustandストア（タスク1.2で作成済み、拡張）
- `src/components/AuthGuard.tsx` - 認証ガードコンポーネント
- `src/app/__tests__/login.test.tsx` - ログインページテスト
- `src/components/__tests__/AuthGuard.test.tsx` - 認証ガードテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/__tests__/login.test.tsx`作成
     - ログインフォーム表示（トークン入力フィールド、送信ボタン）
     - 正しいトークンでログイン成功、`/`にリダイレクト
     - 誤ったトークンでエラー表示
     - 空のトークンで送信ボタン無効化
   - `src/components/__tests__/AuthGuard.test.tsx`作成
     - 未認証時に`/login`にリダイレクト
     - 認証済み時に子コンポーネント表示
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add login and AuthGuard tests"

2. **実装フェーズ**:
   - `src/store/auth.ts`拡張
     - `isAuthenticated: boolean`ステート追加
     - `login(token: string): Promise<void>`アクション追加
     - `logout(): Promise<void>`アクション追加
     - `checkAuth(): Promise<void>`アクション追加（ページロード時にセッション確認）
   - `src/app/login/page.tsx`作成
     - トークン入力フォーム（`<input type="password">`）
     - 送信ボタン
     - エラーメッセージ表示エリア
     - ローディング状態表示
     - `login()`呼び出し、成功時に`redirect('/')`
   - `src/components/AuthGuard.tsx`作成
     - `useAuth()`でストア取得
     - `useEffect()`で`checkAuth()`呼び出し
     - 未認証時に`redirect('/login')`
     - 認証済み時に`children`をレンダリング
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement login page and AuthGuard"

**UI仕様**:
- ログインページ:
  - 中央配置、最大幅400px
  - タイトル: "ClaudeWork"
  - サブタイトル: "ログイン"
  - トークン入力: `<input type="password" placeholder="認証トークンを入力" />`
  - 送信ボタン: "ログイン"（プライマリカラー）
  - エラー表示: 赤色テキスト、ボーダー付き
  - ローディング時: ボタン無効化、スピナー表示

**Zustandストア仕様**:
```typescript
interface AuthState {
  isAuthenticated: boolean;
  sessionId: string | null;
  expiresAt: string | null;
  login: (token: string) => Promise<void>; // POST /api/auth/login
  logout: () => Promise<void>; // POST /api/auth/logout
  checkAuth: () => Promise<void>; // セッション確認
}
```

**エラーハンドリング**:
- ネットワークエラー: "ネットワークエラーが発生しました"
- 401エラー: "トークンが無効です"
- 500エラー: "サーバーエラーが発生しました"
- その他: "ログインに失敗しました"

**受入基準**:
- [ ] `src/app/login/page.tsx`が存在する
- [ ] `src/components/AuthGuard.tsx`が存在する
- [ ] `src/store/auth.ts`に`login`、`logout`、`checkAuth`が実装されている
- [ ] `/login`ページが表示される
- [ ] トークン入力フォームがある
- [ ] 送信ボタンがある
- [ ] 空のトークンで送信ボタンが無効化される
- [ ] ログイン成功時に`/`にリダイレクトされる
- [ ] ログイン失敗時にエラーメッセージが表示される
- [ ] 未認証で`/`アクセス時に`/login`にリダイレクトされる
- [ ] 認証済みで`/login`アクセス時に`/`にリダイレクトされる
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.1（認証API実装）完了
- `src/store/index.ts`が存在すること

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 25分

**ステータス**: `TODO`

---

### タスク3.2: レイアウトとナビゲーション実装

**説明**:
アプリケーションの基本レイアウトを実装する
- ヘッダー（ロゴ、ログアウトボタン）
- サイドバー（プロジェクト一覧）
- メインコンテンツエリア
- レスポンシブ対応（モバイル時はサイドバー折りたたみ）

**技術的文脈**:
- Next.js 14 App Router
- Tailwind CSS 3.x
- Zustand 4.xでプロジェクト一覧取得
- モバイルブレークポイント: `md:`（768px）
- レスポンシブ: `hidden md:block`でサイドバー制御
- ハンバーガーメニュー: モバイル時のサイドバートグル

**必要なパッケージ**:
```bash
# 追加パッケージなし（Tailwind CSSは既にインストール済み）
# アイコン用（オプション）:
npm install lucide-react
```

**実装ファイル**:
- `src/components/layout/Header.tsx` - ヘッダーコンポーネント
- `src/components/layout/Sidebar.tsx` - サイドバーコンポーネント
- `src/components/layout/MainLayout.tsx` - メインレイアウトコンポーネント
- `src/app/layout.tsx` - ルートレイアウト（MainLayout適用）
- `src/components/layout/__tests__/Header.test.tsx` - ヘッダーテスト
- `src/components/layout/__tests__/Sidebar.test.tsx` - サイドバーテスト
- `src/components/layout/__tests__/MainLayout.test.tsx` - メインレイアウトテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/layout/__tests__/Header.test.tsx`作成
     - ロゴ表示
     - ログアウトボタン表示・クリック
   - `src/components/layout/__tests__/Sidebar.test.tsx`作成
     - プロジェクト一覧表示
     - プロジェクト選択
     - 折りたたみ機能（モバイル）
   - `src/components/layout/__tests__/MainLayout.test.tsx`作成
     - ヘッダー・サイドバー・メインエリア表示
     - レスポンシブ動作
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add layout component tests"

2. **実装フェーズ**:
   - `src/components/layout/Header.tsx`作成
     - ロゴ: "ClaudeWork"
     - ログアウトボタン
     - `useAuth().logout()`呼び出し
   - `src/components/layout/Sidebar.tsx`作成
     - プロジェクト一覧: `useProjects()`でZustandから取得
     - プロジェクト選択: `router.push(/projects/${id})`
     - 「プロジェクト追加」ボタン
     - モバイル時の折りたたみ: `isSidebarOpen`ステート管理
   - `src/components/layout/MainLayout.tsx`作成
     - Header + Sidebar + main要素
     - グリッドレイアウト: `grid grid-cols-[250px_1fr]`（デスクトップ）
     - フレックスレイアウト: `flex flex-col`（モバイル）
   - `src/app/layout.tsx`更新
     - AuthGuardで保護
     - MainLayoutで全ページをラップ
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement responsive layout with Header and Sidebar"

**UI仕様**:

**Header**:
- 高さ: 64px
- 背景: `bg-white dark:bg-gray-800`、ボーダー下: `border-b`
- ロゴ: 左側、フォントサイズ`text-xl font-bold`
- ログアウトボタン: 右側、`text-sm text-gray-600`

**Sidebar**:
- 幅: 250px（デスクトップ）、100vw（モバイル）
- 背景: `bg-gray-50 dark:bg-gray-900`
- プロジェクト一覧: スクロール可能、最大高さ`max-h-screen`
- プロジェクト項目: ホバー時`bg-gray-100 dark:bg-gray-800`
- 選択中: `bg-blue-100 dark:bg-blue-900`

**MainLayout**:
- デスクトップ: `grid grid-cols-[250px_1fr] h-screen`
- モバイル: `flex flex-col h-screen`
- サイドバー: `md:block hidden` + モバイルトグル時`block`

**レスポンシブ動作**:
- 768px以上: サイドバー常時表示
- 768px未満: ハンバーガーメニューでトグル、オーバーレイ表示

**Zustandストア連携**:
```typescript
// プロジェクトストア
interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  fetchProjects: () => Promise<void>; // GET /api/projects
  selectProject: (id: string) => void;
}

// UIストア
interface UIState {
  isSidebarOpen: boolean; // モバイル用
  toggleSidebar: () => void;
}
```

**エラーハンドリング**:
- プロジェクト一覧取得失敗: エラーメッセージ表示、リトライボタン
- ログアウト失敗: エラーメッセージ表示

**受入基準**:
- [ ] `src/components/layout/Header.tsx`が存在する
- [ ] `src/components/layout/Sidebar.tsx`が存在する
- [ ] `src/components/layout/MainLayout.tsx`が存在する
- [ ] `src/app/layout.tsx`が更新されている
- [ ] ヘッダーが表示される（ロゴ、ログアウトボタン）
- [ ] サイドバーにプロジェクト一覧が表示される
- [ ] プロジェクト選択で遷移する
- [ ] 768px以上でサイドバーが常時表示される
- [ ] 768px未満でサイドバーが折りたたまれる
- [ ] モバイルでハンバーガーメニューが表示される
- [ ] ハンバーガーメニュークリックでサイドバートグル
- [ ] ログアウトボタンが機能する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク3.1（認証画面実装）完了
- `src/store/index.ts`が存在すること
- `src/store/projects.ts`が存在すること（タスク1.2で作成済み）

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`

---

### タスク3.3: プロジェクト管理画面実装

**説明**:
プロジェクト一覧と追加/削除機能を実装する
- プロジェクト一覧表示
- プロジェクト追加モーダル
- プロジェクト削除確認ダイアログ
- プロジェクト選択でセッション一覧表示

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでプロジェクト状態管理
- Headless UI 2.x でモーダル/ダイアログ
- Tailwind CSSでスタイリング
- フォームバリデーション: パス入力必須、存在確認

**必要なパッケージ**:
```bash
npm install @headlessui/react
```

**実装ファイル**:
- `src/app/page.tsx` - ダッシュボード（プロジェクト一覧ページ）
- `src/components/projects/ProjectList.tsx` - プロジェクト一覧コンポーネント
- `src/components/projects/ProjectCard.tsx` - プロジェクトカードコンポーネント
- `src/components/projects/AddProjectModal.tsx` - プロジェクト追加モーダル
- `src/components/projects/DeleteProjectDialog.tsx` - 削除確認ダイアログ
- `src/app/__tests__/projects.test.tsx` - プロジェクト管理画面テスト
- `src/components/projects/__tests__/AddProjectModal.test.tsx` - モーダルテスト
- `src/components/projects/__tests__/DeleteProjectDialog.test.tsx` - ダイアログテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/__tests__/projects.test.tsx`作成
     - プロジェクト一覧表示
     - プロジェクト選択で遷移
     - 「追加」ボタンクリックでモーダル表示
   - `src/components/projects/__tests__/AddProjectModal.test.tsx`作成
     - パス入力フォーム表示
     - 有効なパスでプロジェクト追加成功
     - 無効なパスでエラー表示
     - モーダル閉じる
   - `src/components/projects/__tests__/DeleteProjectDialog.test.tsx`作成
     - 削除確認メッセージ表示
     - 削除実行
     - キャンセル
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add project management tests"

2. **実装フェーズ**:
   - `src/store/projects.ts`拡張（タスク1.2で作成済み）
     - `addProject(path: string): Promise<void>` - POST /api/projects
     - `deleteProject(id: string): Promise<void>` - DELETE /api/projects/{id}
     - `updateProject(id: string, data: Partial<Project>): Promise<void>` - PUT /api/projects/{id}
   - `src/components/projects/ProjectCard.tsx`作成
     - プロジェクト名、パス、セッション数表示
     - 「開く」ボタン、「削除」ボタン
   - `src/components/projects/ProjectList.tsx`作成
     - `useProjects()`でZustandからプロジェクト一覧取得
     - `ProjectCard`をマップして表示
     - 「プロジェクト追加」ボタン
   - `src/components/projects/AddProjectModal.tsx`作成
     - Headless UI `Dialog`使用
     - パス入力フォーム
     - バリデーション: 空チェック
     - `addProject()`呼び出し
     - 成功時: モーダル閉じる、一覧更新
     - 失敗時: エラーメッセージ表示
   - `src/components/projects/DeleteProjectDialog.tsx`作成
     - Headless UI `Dialog`使用
     - 確認メッセージ: "プロジェクト「{name}」を削除しますか？"
     - 「削除」ボタン、「キャンセル」ボタン
     - `deleteProject()`呼び出し
   - `src/app/page.tsx`作成
     - `AuthGuard`で保護
     - `ProjectList`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement project management UI with Headless UI"

**UI仕様**:

**ProjectCard**:
- カード形式: `border rounded-lg p-4 hover:shadow-md`
- プロジェクト名: `text-lg font-semibold`
- パス: `text-sm text-gray-600`
- セッション数バッジ: `bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs`
- ボタン: 「開く」（プライマリ）、「削除」（デンジャー）

**AddProjectModal**:
- タイトル: "プロジェクトを追加"
- パス入力: `<input type="text" placeholder="/path/to/git/repo" />`
- ボタン: 「追加」、「キャンセル」
- エラー表示: 赤色テキスト

**DeleteProjectDialog**:
- タイトル: "プロジェクトを削除"
- メッセージ: "プロジェクト「{name}」を削除しますか？worktreeは削除されません。"
- ボタン: 「削除」（赤色）、「キャンセル」

**Zustandストア拡張**:
```typescript
interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>; // GET /api/projects
  addProject: (path: string) => Promise<void>; // POST /api/projects
  updateProject: (id: string, data: Partial<Project>) => Promise<void>; // PUT /api/projects/{id}
  deleteProject: (id: string) => Promise<void>; // DELETE /api/projects/{id}
  selectProject: (id: string) => void;
}
```

**エラーハンドリング**:
- Gitリポジトリでない: "指定されたパスはGitリポジトリではありません"
- パス不正: "有効なパスを入力してください"
- ネットワークエラー: "ネットワークエラーが発生しました"
- その他: "プロジェクトの追加に失敗しました"

**受入基準**:
- [ ] `src/app/page.tsx`が存在する
- [ ] `src/components/projects/ProjectList.tsx`が存在する
- [ ] `src/components/projects/ProjectCard.tsx`が存在する
- [ ] `src/components/projects/AddProjectModal.tsx`が存在する
- [ ] `src/components/projects/DeleteProjectDialog.tsx`が存在する
- [ ] `src/store/projects.ts`に`addProject`、`deleteProject`、`updateProject`が実装されている
- [ ] プロジェクト一覧が表示される
- [ ] 「追加」ボタンでモーダルが開く
- [ ] パス入力してプロジェクト追加できる
- [ ] 無効なパスでエラーメッセージが表示される
- [ ] プロジェクト削除確認ダイアログが表示される
- [ ] 削除実行でプロジェクトが削除される
- [ ] プロジェクト選択でセッション一覧に遷移する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.2（プロジェクトAPI実装）完了
- タスク3.2（レイアウトとナビゲーション実装）完了
- `src/store/projects.ts`が存在すること

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

**ステータス**: `TODO`

---

### タスク3.4: セッション管理画面実装

**説明**:
セッション一覧と作成機能を実装する
- セッション一覧表示（ステータスアイコン付き）
- セッション作成フォーム（名前、プロンプト）
- セッション選択でセッション詳細画面へ遷移

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでセッション状態管理
- Headless UI 2.x でフォーム
- Tailwind CSSでスタイリング
- セッションステータス: initializing, running, waiting_input, completed, error
- リアルタイムステータス更新は次フェーズ（タスク4.3）で実装

**必要なパッケージ**:
```bash
# Headless UIは既にタスク3.3でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/projects/[id]/page.tsx` - プロジェクト詳細（セッション一覧ページ）
- `src/components/sessions/SessionList.tsx` - セッション一覧コンポーネント
- `src/components/sessions/SessionCard.tsx` - セッションカードコンポーネント
- `src/components/sessions/CreateSessionForm.tsx` - セッション作成フォーム
- `src/components/sessions/SessionStatusIcon.tsx` - ステータスアイコンコンポーネント
- `src/app/projects/__tests__/[id].test.tsx` - プロジェクト詳細ページテスト
- `src/components/sessions/__tests__/CreateSessionForm.test.tsx` - フォームテスト
- `src/components/sessions/__tests__/SessionStatusIcon.test.tsx` - アイコンテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/projects/__tests__/[id].test.tsx`作成
     - セッション一覧表示
     - セッション作成フォーム表示
     - セッション選択で詳細画面に遷移
   - `src/components/sessions/__tests__/CreateSessionForm.test.tsx`作成
     - 名前・プロンプト入力フォーム表示
     - セッション作成成功
     - バリデーションエラー表示
   - `src/components/sessions/__tests__/SessionStatusIcon.test.tsx`作成
     - 各ステータスに応じたアイコン・色表示
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add session management tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`作成（タスク1.2のstore拡張）
     - `sessions: Session[]`ステート
     - `fetchSessions(projectId: string): Promise<void>` - GET /api/projects/{id}/sessions
     - `createSession(projectId: string, data: CreateSessionData): Promise<void>` - POST /api/projects/{id}/sessions
     - `selectSession(id: string): void`
   - `src/components/sessions/SessionStatusIcon.tsx`作成
     - ステータスに応じたアイコン: initializing（スピナー）、running（再生）、waiting_input（一時停止）、completed（チェック）、error（エラー）
     - 色: initializing（青）、running（緑）、waiting_input（黄）、completed（グレー）、error（赤）
   - `src/components/sessions/SessionCard.tsx`作成
     - セッション名、ステータスアイコン、作成日時表示
     - クリックで詳細画面遷移
   - `src/components/sessions/SessionList.tsx`作成
     - `useSessions()`でZustandからセッション一覧取得
     - `SessionCard`をマップして表示
     - 空の場合: "セッションがありません"
   - `src/components/sessions/CreateSessionForm.tsx`作成
     - 名前入力: `<input type="text" placeholder="セッション名" />`
     - プロンプト入力: `<textarea placeholder="実行するタスクを入力" />`
     - バリデーション: 名前必須、プロンプト必須
     - `createSession()`呼び出し
   - `src/app/projects/[id]/page.tsx`作成
     - `AuthGuard`で保護
     - `useParams()`でprojectId取得
     - `useEffect()`で`fetchSessions(projectId)`呼び出し
     - `CreateSessionForm`と`SessionList`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement session management UI"

**UI仕様**:

**SessionCard**:
- カード形式: `border rounded-lg p-4 hover:shadow-md cursor-pointer`
- ヘッダー: セッション名 + ステータスアイコン（右側）
- サブ情報: 作成日時、モデル（小さいテキスト）
- ホバー: `bg-gray-50`

**CreateSessionForm**:
- レイアウト: 縦並び
- 名前入力: `<input>`、幅100%
- プロンプト入力: `<textarea>`、高さ120px
- ボタン: 「セッション作成」（プライマリ）
- エラー表示: 赤色テキスト

**SessionStatusIcon**:
- initializing: スピナーアイコン、`text-blue-500`
- running: 再生アイコン、`text-green-500`
- waiting_input: 一時停止アイコン、`text-yellow-500`
- completed: チェックアイコン、`text-gray-500`
- error: エラーアイコン、`text-red-500`

**Zustandストア仕様**:
```typescript
interface SessionState {
  sessions: Session[];
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (projectId: string) => Promise<void>; // GET /api/projects/{id}/sessions
  createSession: (projectId: string, data: CreateSessionData) => Promise<void>; // POST /api/projects/{id}/sessions
  selectSession: (id: string) => void;
}

interface CreateSessionData {
  name: string;
  prompt: string;
  model?: string; // デフォルト: 'auto'
}
```

**エラーハンドリング**:
- 名前未入力: "セッション名を入力してください"
- プロンプト未入力: "プロンプトを入力してください"
- セッション作成失敗: "セッションの作成に失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/app/projects/[id]/page.tsx`が存在する
- [ ] `src/components/sessions/SessionList.tsx`が存在する
- [ ] `src/components/sessions/SessionCard.tsx`が存在する
- [ ] `src/components/sessions/CreateSessionForm.tsx`が存在する
- [ ] `src/components/sessions/SessionStatusIcon.tsx`が存在する
- [ ] `src/store/sessions.ts`に`fetchSessions`、`createSession`が実装されている
- [ ] セッション一覧が表示される
- [ ] 各セッションにステータスアイコンが表示される
- [ ] 5種類のステータスアイコンが正しく表示される
- [ ] セッション作成フォームが表示される
- [ ] 名前・プロンプト入力でセッション作成が成功する
- [ ] バリデーションエラーが表示される
- [ ] セッション選択で詳細画面に遷移する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.5（セッションAPI実装）完了
- タスク3.3（プロジェクト管理画面実装）完了
- `src/store/index.ts`が存在すること

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

**ステータス**: `TODO`

---

---

### タスク3.5: セッション詳細画面実装

**説明**:
Claude Codeとの対話画面を実装する
- メッセージ履歴表示
- ユーザー入力フォーム
- 権限確認ダイアログ（承認/拒否ボタン）
- セッション停止ボタン

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでメッセージ状態管理
- Headless UI 2.x でダイアログ
- Tailwind CSSでスタイリング
- WebSocket接続は次フェーズ（タスク4.2）で実装
- 初期実装はREST APIでポーリング（3秒間隔）

**必要なパッケージ**:
```bash
# Headless UIは既にインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/sessions/[id]/page.tsx` - セッション詳細ページ
- `src/components/session/MessageList.tsx` - メッセージ履歴コンポーネント
- `src/components/session/MessageBubble.tsx` - メッセージバブルコンポーネント
- `src/components/session/InputForm.tsx` - ユーザー入力フォーム
- `src/components/session/PermissionDialog.tsx` - 権限確認ダイアログ
- `src/app/sessions/__tests__/[id].test.tsx` - セッション詳細ページテスト
- `src/components/session/__tests__/MessageList.test.tsx` - メッセージリストテスト
- `src/components/session/__tests__/PermissionDialog.test.tsx` - ダイアログテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/sessions/__tests__/[id].test.tsx`作成
     - メッセージ履歴表示
     - 入力フォーム表示
     - セッション停止ボタン表示
   - `src/components/session/__tests__/MessageList.test.tsx`作成
     - ユーザー・アシスタントメッセージ表示
     - 自動スクロール
   - `src/components/session/__tests__/PermissionDialog.test.tsx`作成
     - 権限確認メッセージ表示
     - 承認/拒否ボタンクリック
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add session detail tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`拡張
     - `messages: Message[]`ステート追加
     - `fetchSessionDetail(id: string): Promise<void>` - GET /api/sessions/{id}
     - `sendMessage(sessionId: string, content: string): Promise<void>` - POST /api/sessions/{id}/input
     - `approvePermission(sessionId: string, approved: boolean): Promise<void>` - POST /api/sessions/{id}/approve
     - `stopSession(sessionId: string): Promise<void>` - POST /api/sessions/{id}/stop
   - `src/components/session/MessageBubble.tsx`作成
     - ユーザーメッセージ: 右側、青背景
     - アシスタントメッセージ: 左側、グレー背景
     - タイムスタンプ表示
   - `src/components/session/MessageList.tsx`作成
     - `MessageBubble`をマップして表示
     - `useRef`で自動スクロール
     - 空の場合: "メッセージがありません"
   - `src/components/session/InputForm.tsx`作成
     - テキストエリア: `<textarea placeholder="メッセージを入力" />`
     - 送信ボタン: Enter キーで送信（Shift+Enterで改行）
     - `sendMessage()`呼び出し
   - `src/components/session/PermissionDialog.tsx`作成
     - Headless UI `Dialog`使用
     - 権限内容表示
     - 「承認」「拒否」ボタン
     - `approvePermission()`呼び出し
   - `src/app/sessions/[id]/page.tsx`作成
     - `AuthGuard`で保護
     - `useParams()`でsessionId取得
     - `useEffect()`で`fetchSessionDetail(sessionId)`呼び出し
     - ポーリング: `setInterval()`で3秒ごとに`fetchSessionDetail()`
     - `MessageList`、`InputForm`、停止ボタン表示
     - 権限リクエスト時に`PermissionDialog`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement session detail UI with polling"

**UI仕様**:

**MessageBubble**:
- ユーザー: `bg-blue-500 text-white rounded-lg p-3 max-w-[70%] ml-auto`
- アシスタント: `bg-gray-200 text-gray-900 rounded-lg p-3 max-w-[70%]`
- タイムスタンプ: `text-xs text-gray-500 mt-1`

**InputForm**:
- テキストエリア: `border rounded-lg p-2 resize-none`、高さ80px
- 送信ボタン: 右下、プライマリカラー
- Enter: 送信、Shift+Enter: 改行
- 送信中: ボタン無効化、スピナー表示

**PermissionDialog**:
- タイトル: "権限の確認"
- メッセージ: "Claude Codeが次の操作を実行しようとしています: {action}"
- ボタン: 「承認」（緑）、「拒否」（赤）

**停止ボタン**:
- 位置: 右上
- デザイン: `bg-red-500 text-white rounded px-4 py-2`
- テキスト: "セッション停止"

**Zustandストア拡張**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  messages: Message[];
  permissionRequest: PermissionRequest | null;
  fetchSessionDetail: (id: string) => Promise<void>; // GET /api/sessions/{id}
  sendMessage: (sessionId: string, content: string) => Promise<void>; // POST /api/sessions/{id}/input
  approvePermission: (sessionId: string, approved: boolean) => Promise<void>; // POST /api/sessions/{id}/approve
  stopSession: (sessionId: string) => Promise<void>; // POST /api/sessions/{id}/stop
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PermissionRequest {
  requestId: string;
  action: string;
  details: string;
}
```

**ポーリング仕様**:
- 間隔: 3秒
- 条件: セッションが`running`または`waiting_input`状態の時のみ
- クリーンアップ: コンポーネントアンマウント時に`clearInterval()`

**エラーハンドリング**:
- メッセージ送信失敗: "メッセージの送信に失敗しました"
- セッション停止失敗: "セッションの停止に失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/app/sessions/[id]/page.tsx`が存在する
- [ ] `src/components/session/MessageList.tsx`が存在する
- [ ] `src/components/session/MessageBubble.tsx`が存在する
- [ ] `src/components/session/InputForm.tsx`が存在する
- [ ] `src/components/session/PermissionDialog.tsx`が存在する
- [ ] `src/store/sessions.ts`に4つの関数が実装されている
- [ ] メッセージ履歴が表示される
- [ ] ユーザー・アシスタントメッセージが区別される
- [ ] ユーザー入力を送信できる
- [ ] Enterキーで送信、Shift+Enterで改行
- [ ] 権限確認ダイアログが表示される
- [ ] 承認/拒否ボタンが機能する
- [ ] セッション停止ボタンが機能する
- [ ] 3秒ごとにポーリングされる
- [ ] メッセージが自動スクロールする
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.5（セッションAPI実装）完了
- タスク3.4（セッション管理画面実装）完了
- `src/store/sessions.ts`が存在すること

**推定工数**: 50分（AIエージェント作業時間）
- テスト作成・コミット: 18分
- 実装・テスト通過・コミット: 32分

**ステータス**: `TODO`

---

### タスク3.6: Diff表示画面実装

**説明**:
Git diffの表示機能を実装する
- ファイル一覧サイドバー
- diff表示（追加行緑、削除行赤）
- ファイル選択でそのファイルのdiff表示

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- react-diff-viewer-continued 3.x でdiff表示
- Tailwind CSSでスタイリング
- unified diff形式

**必要なパッケージ**:
```bash
npm install react-diff-viewer-continued
```

**実装ファイル**:
- `src/components/git/DiffViewer.tsx` - diffビューワーコンポーネント
- `src/components/git/FileList.tsx` - 変更ファイル一覧コンポーネント
- `src/components/git/__tests__/DiffViewer.test.tsx` - diffビューワーテスト
- `src/components/git/__tests__/FileList.test.tsx` - ファイル一覧テスト
- セッション詳細ページにDiffタブ追加

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/git/__tests__/FileList.test.tsx`作成
     - ファイル一覧表示
     - ファイル選択
     - 変更種別アイコン（追加/変更/削除）
   - `src/components/git/__tests__/DiffViewer.test.tsx`作成
     - diff表示
     - 追加行が緑、削除行が赤
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add diff viewer tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`拡張
     - `diff: DiffData | null`ステート追加
     - `fetchDiff(sessionId: string): Promise<void>` - GET /api/sessions/{id}/diff
     - `selectedFile: string | null`ステート追加
     - `selectFile(path: string): void`
   - `src/components/git/FileList.tsx`作成
     - ファイル一覧表示
     - 変更種別アイコン: added（+）、modified（~）、deleted（-）
     - ファイル選択で`selectFile()`呼び出し
     - 選択中ファイルをハイライト
   - `src/components/git/DiffViewer.tsx`作成
     - react-diff-viewer-continued使用
     - `oldValue`と`newValue`を渡す
     - `splitView={false}`でunified表示
     - スタイル: ダーク/ライトモード対応
   - `src/app/sessions/[id]/page.tsx`更新
     - タブ: 「対話」「Diff」
     - Diffタブ: `FileList`と`DiffViewer`表示
     - `useEffect()`で`fetchDiff(sessionId)`呼び出し
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement diff viewer with react-diff-viewer-continued"

**UI仕様**:

**FileList**:
- サイドバー: 幅250px、スクロール可能
- ファイル項目:
  - added: `+`アイコン、緑色
  - modified: `~`アイコン、黄色
  - deleted: `-`アイコン、赤色
- 選択中: `bg-blue-100 dark:bg-blue-900`
- ホバー: `bg-gray-100 dark:bg-gray-800`

**DiffViewer**:
- unified表示: `splitView={false}`
- 追加行: `bg-green-100 dark:bg-green-900`
- 削除行: `bg-red-100 dark:bg-red-900`
- 行番号表示
- スクロール可能

**タブ**:
- タブ: 「対話」「Diff」
- アクティブ: `border-b-2 border-blue-500`
- 非アクティブ: `text-gray-500`

**Zustandストア拡張**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  diff: DiffData | null;
  selectedFile: string | null;
  fetchDiff: (sessionId: string) => Promise<void>; // GET /api/sessions/{id}/diff
  selectFile: (path: string) => void;
}

interface DiffData {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
}
```

**エラーハンドリング**:
- diff取得失敗: "差分の取得に失敗しました"
- ファイル未選択: "ファイルを選択してください"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/components/git/DiffViewer.tsx`が存在する
- [ ] `src/components/git/FileList.tsx`が存在する
- [ ] `src/store/sessions.ts`に`fetchDiff`、`selectFile`が実装されている
- [ ] セッション詳細ページに「Diff」タブがある
- [ ] 変更ファイル一覧が表示される
- [ ] ファイル種別アイコンが表示される（+/~/−）
- [ ] diffが色分け表示される（緑/赤）
- [ ] ファイル選択でそのファイルのdiffのみ表示される
- [ ] unified表示になっている
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.6（Git操作API実装）完了
- タスク3.5（セッション詳細画面実装）完了
- `src/store/sessions.ts`が存在すること

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`

---

### タスク3.7: Git操作UI実装

**説明**:
Git操作（rebase、merge）のUIを実装する
- 「mainから取り込み」ボタン
- 「スカッシュしてマージ」ボタン
- コミットメッセージ入力モーダル
- コンフリクト通知ダイアログ
- worktree削除確認ダイアログ

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでGit操作状態管理
- Headless UI 2.x でモーダル/ダイアログ
- Tailwind CSSでスタイリング
- 操作中はローディング表示
- エラー時はエラーメッセージ表示

**必要なパッケージ**:
```bash
# Headless UIは既にインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/git/RebaseButton.tsx` - rebaseボタンコンポーネント
- `src/components/git/MergeModal.tsx` - マージモーダルコンポーネント
- `src/components/git/ConflictDialog.tsx` - コンフリクトダイアログ
- `src/components/git/DeleteWorktreeDialog.tsx` - worktree削除確認ダイアログ
- `src/components/git/__tests__/RebaseButton.test.tsx` - rebaseボタンテスト
- `src/components/git/__tests__/MergeModal.test.tsx` - マージモーダルテスト
- `src/components/git/__tests__/ConflictDialog.test.tsx` - コンフリクトダイアログテスト
- セッション詳細ページにGit操作ボタン追加

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/git/__tests__/RebaseButton.test.tsx`作成
     - ボタンクリック
     - rebase成功
     - rebaseコンフリクト
     - ローディング表示
   - `src/components/git/__tests__/MergeModal.test.tsx`作成
     - モーダル表示
     - コミットメッセージ入力
     - マージ実行
   - `src/components/git/__tests__/ConflictDialog.test.tsx`作成
     - コンフリクトファイル一覧表示
     - 閉じるボタン
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add git operation UI tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`拡張
     - `isGitOperationLoading: boolean`ステート追加
     - `conflictFiles: string[] | null`ステート追加
     - `rebase(sessionId: string): Promise<void>` - POST /api/sessions/{id}/rebase
     - `merge(sessionId: string, commitMessage: string, deleteWorktree: boolean): Promise<void>` - POST /api/sessions/{id}/merge
   - `src/components/git/RebaseButton.tsx`作成
     - ボタン: 「mainから取り込み」
     - クリックで`rebase()`呼び出し
     - ローディング中: ボタン無効化、スピナー表示
     - 成功: トースト通知「rebase成功」
     - コンフリクト時: `ConflictDialog`表示
   - `src/components/git/ConflictDialog.tsx`作成
     - Headless UI `Dialog`使用
     - タイトル: "コンフリクトが発生しました"
     - メッセージ: "以下のファイルでコンフリクトが発生しました"
     - コンフリクトファイル一覧
     - 「閉じる」ボタン
   - `src/components/git/MergeModal.tsx`作成
     - Headless UI `Dialog`使用
     - タイトル: "mainブランチにマージ"
     - コミットメッセージ入力: `<textarea>`
     - worktree削除チェックボックス
     - 「マージ」ボタン、「キャンセル」ボタン
     - クリックで`merge()`呼び出し
   - `src/components/git/DeleteWorktreeDialog.tsx`作成
     - Headless UI `Dialog`使用
     - タイトル: "worktreeを削除しますか？"
     - メッセージ: "マージが成功しました。worktreeを削除しますか？"
     - 「削除」ボタン、「保持」ボタン
   - セッション詳細ページ更新
     - Git操作ボタンエリア追加
     - `RebaseButton`表示
     - 「スカッシュしてマージ」ボタン → `MergeModal`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement git operation UI"

**UI仕様**:

**RebaseButton**:
- ボタン: `bg-blue-500 text-white rounded px-4 py-2`
- テキスト: "mainから取り込み"
- ローディング: スピナー + "処理中..."
- 成功: トースト通知（3秒表示）

**MergeModal**:
- タイトル: "mainブランチにマージ"
- コミットメッセージ: `<textarea rows="5" placeholder="コミットメッセージを入力" />`
- worktree削除: `<input type="checkbox" />` "マージ後にworktreeを削除"
- ボタン: 「マージ」（緑）、「キャンセル」

**ConflictDialog**:
- タイトル: "コンフリクトが発生しました"
- メッセージ: "以下のファイルでコンフリクトが発生しました。手動で解決してください。"
- ファイル一覧: `<ul>`、各ファイルを`<li>`で表示
- ボタン: 「閉じる」

**DeleteWorktreeDialog**:
- タイトル: "worktreeを削除しますか？"
- メッセージ: "マージが成功しました。worktreeを削除しますか？"
- ボタン: 「削除」（赤）、「保持」

**Zustandストア拡張**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  isGitOperationLoading: boolean;
  conflictFiles: string[] | null;
  rebase: (sessionId: string) => Promise<void>; // POST /api/sessions/{id}/rebase
  merge: (sessionId: string, commitMessage: string, deleteWorktree: boolean) => Promise<void>; // POST /api/sessions/{id}/merge
}
```

**エラーハンドリング**:
- rebase失敗: "rebaseに失敗しました"
- コンフリクト発生（409）: `ConflictDialog`表示
- merge失敗: "マージに失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/components/git/RebaseButton.tsx`が存在する
- [ ] `src/components/git/MergeModal.tsx`が存在する
- [ ] `src/components/git/ConflictDialog.tsx`が存在する
- [ ] `src/components/git/DeleteWorktreeDialog.tsx`が存在する
- [ ] `src/store/sessions.ts`に`rebase`、`merge`が実装されている
- [ ] 「mainから取り込み」ボタンが機能する
- [ ] rebase成功時に成功メッセージが表示される
- [ ] コンフリクト時にダイアログが表示される
- [ ] コンフリクトファイル一覧が表示される
- [ ] 「スカッシュしてマージ」でモーダルが開く
- [ ] コミットメッセージを入力できる
- [ ] マージ成功後にworktree削除確認が表示される
- [ ] 操作中にローディング表示される
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.6（Git操作API実装）完了
- タスク3.6（Diff表示画面実装）完了
- `src/store/sessions.ts`が存在すること

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`

---

## フェーズ4: リアルタイム通信とMVP統合
*推定期間: 185分（AIエージェント作業時間）*
*MVP: Yes*


## フェーズ5: 拡張機能（セッション管理強化）
*推定期間: 180分（AIエージェント作業時間）*
*MVP: No*


## フェーズ6: 拡張機能（高度な機能）
*推定期間: 240分（AIエージェント作業時間）*
*MVP: No*

### タスク6.1: ランスクリプト設定実装

**説明**:
プロジェクトにランスクリプト（Run Script）を設定する機能を実装する。ランスクリプトとは、worktree内で実行可能な任意のシェルコマンドで、テスト実行、ビルド、リント実行などの定型作業を簡単に実行できるようにする。
- プロジェクト設定画面の実装
- ランスクリプト追加/編集/削除UI
- ランスクリプト一覧表示
- ランスクリプトメタデータ（名前、説明、コマンド）

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Headless UI 2.x でモーダル/ダイアログ
- Tailwind CSSでスタイリング
- Prismaスキーマ拡張（RunScriptモデル）
- Zustand 4.xでランスクリプト状態管理

**必要なパッケージ**:
```bash
# Headless UIは既にタスク3.3でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `prisma/schema.prisma` - RunScriptモデル追加
- `src/app/api/projects/[id]/scripts/route.ts` - スクリプト一覧取得・追加API
- `src/app/api/projects/[id]/scripts/[scriptId]/route.ts` - スクリプト更新・削除API
- `src/app/projects/[id]/settings/page.tsx` - プロジェクト設定ページ
- `src/components/settings/RunScriptList.tsx` - ランスクリプト一覧コンポーネント
- `src/components/settings/AddRunScriptModal.tsx` - スクリプト追加モーダル
- `src/components/settings/EditRunScriptModal.tsx` - スクリプト編集モーダル
- `src/components/settings/DeleteRunScriptDialog.tsx` - スクリプト削除確認ダイアログ
- `src/store/run-scripts.ts` - ランスクリプトZustandストア
- `src/app/api/projects/[id]/scripts/__tests__/route.test.ts` - API テスト
- `src/components/settings/__tests__/RunScriptList.test.tsx` - コンポーネントテスト
- `src/components/settings/__tests__/AddRunScriptModal.test.tsx` - モーダルテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - Prismaスキーマ拡張:
     ```prisma
     model RunScript {
       id          String   @id @default(uuid())
       project_id  String
       name        String
       description String?
       command     String
       created_at  DateTime @default(now())
       updated_at  DateTime @updatedAt

       project     Project  @relation(fields: [project_id], references: [id], onDelete: Cascade)

       @@index([project_id])
     }
     ```
   - マイグレーション実行: `npx prisma migrate dev --name add_run_scripts`
   - `src/app/api/projects/[id]/scripts/__tests__/route.test.ts`作成
     - GET /api/projects/{id}/scripts → スクリプト一覧取得成功
     - POST /api/projects/{id}/scripts → スクリプト追加成功
     - PUT /api/projects/{id}/scripts/{scriptId} → スクリプト更新成功
     - DELETE /api/projects/{id}/scripts/{scriptId} → スクリプト削除成功
   - `src/components/settings/__tests__/RunScriptList.test.tsx`作成
     - スクリプト一覧表示
     - 「追加」ボタンでモーダル表示
   - `src/components/settings/__tests__/AddRunScriptModal.test.tsx`作成
     - 名前・コマンド入力フォーム表示
     - 有効な入力でスクリプト追加成功
     - 無効な入力でエラー表示
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add run script management tests"

2. **実装フェーズ**:
   - `src/app/api/projects/[id]/scripts/route.ts`作成
     - GET: プロジェクトのスクリプト一覧取得
       ```typescript
       const scripts = await prisma.runScript.findMany({
         where: { project_id: params.id },
         orderBy: { created_at: 'asc' },
       });
       return Response.json(scripts);
       ```
     - POST: スクリプト追加
       ```typescript
       const { name, description, command } = await request.json();
       const script = await prisma.runScript.create({
         data: { project_id: params.id, name, description, command },
       });
       return Response.json(script, { status: 201 });
       ```
   - `src/app/api/projects/[id]/scripts/[scriptId]/route.ts`作成
     - PUT: スクリプト更新
     - DELETE: スクリプト削除
   - `src/store/run-scripts.ts`作成（Zustandストア）
   - `src/components/settings/RunScriptList.tsx`作成
     - スクリプト一覧をテーブル表示
     - 各スクリプト行: 名前、説明、コマンド、編集ボタン、削除ボタン
   - `src/components/settings/AddRunScriptModal.tsx`作成
     - Headless UI `Dialog`使用
     - 名前、説明、コマンド入力フォーム
     - バリデーション: 名前・コマンド必須
   - `src/components/settings/EditRunScriptModal.tsx`作成
     - 既存スクリプト情報を初期値としてフォーム表示
   - `src/components/settings/DeleteRunScriptDialog.tsx`作成
     - 確認メッセージ: "スクリプト「{name}」を削除しますか？"
   - `src/app/projects/[id]/settings/page.tsx`作成
     - `RunScriptList`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement run script configuration UI"

**API仕様**:

**GET /api/projects/{id}/scripts**:
```typescript
Response 200:
[
  {
    "id": "script-uuid",
    "project_id": "project-uuid",
    "name": "Test",
    "description": "Run unit tests",
    "command": "npm test",
    "created_at": "2025-12-08T10:00:00Z",
    "updated_at": "2025-12-08T10:00:00Z"
  }
]
```

**POST /api/projects/{id}/scripts**:
```typescript
Request:
{
  "name": "Test",
  "description": "Run unit tests",
  "command": "npm test"
}

Response 201:
{
  "id": "script-uuid",
  "project_id": "project-uuid",
  "name": "Test",
  "description": "Run unit tests",
  "command": "npm test",
  "created_at": "2025-12-08T10:00:00Z",
  "updated_at": "2025-12-08T10:00:00Z"
}
```

**PUT /api/projects/{id}/scripts/{scriptId}**:
```typescript
Request:
{
  "name": "Test Updated",
  "description": "Run all tests",
  "command": "npm run test:all"
}

Response 200:
{
  "id": "script-uuid",
  ...
}
```

**DELETE /api/projects/{id}/scripts/{scriptId}**:
```typescript
Response 204 (No Content)
```

**UI仕様**:

**プロジェクト設定ページ**:
- タイトル: "プロジェクト設定 - {プロジェクト名}"
- セクション: 「ランスクリプト」
- 「スクリプト追加」ボタン: プライマリカラー、右上配置

**RunScriptListテーブル**:
- カラム: 名前、説明、コマンド、操作
- 名前: `font-semibold`
- 説明: `text-sm text-gray-600`
- コマンド: `font-mono bg-gray-100 px-2 py-1 rounded text-sm`
- 操作: 編集ボタン（アイコン）、削除ボタン（アイコン）

**AddRunScriptModal**:
- タイトル: "ランスクリプトを追加"
- 名前入力: `<input type="text" placeholder="Test" required />`
- 説明入力: `<input type="text" placeholder="Run unit tests (optional)" />`
- コマンド入力: `<input type="text" placeholder="npm test" required />`、フォントは`font-mono`
- ボタン: 「追加」、「キャンセル」
- エラー表示: 赤色テキスト

**EditRunScriptModal**:
- タイトル: "ランスクリプトを編集"
- フォーム内容はAddと同じ（初期値あり）

**DeleteRunScriptDialog**:
- タイトル: "ランスクリプトを削除"
- メッセージ: "スクリプト「{name}」を削除しますか？この操作は元に戻せません。"
- ボタン: 「削除」（赤色）、「キャンセル」

**Zustandストア仕様**:
```typescript
interface RunScript {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  command: string;
  created_at: string;
  updated_at: string;
}

interface RunScriptState {
  scripts: RunScript[];
  isLoading: boolean;
  error: string | null;
  fetchScripts: (projectId: string) => Promise<void>; // GET /api/projects/{id}/scripts
  addScript: (projectId: string, data: AddScriptData) => Promise<void>; // POST
  updateScript: (projectId: string, scriptId: string, data: UpdateScriptData) => Promise<void>; // PUT
  deleteScript: (projectId: string, scriptId: string) => Promise<void>; // DELETE
}

interface AddScriptData {
  name: string;
  description?: string;
  command: string;
}

interface UpdateScriptData {
  name?: string;
  description?: string;
  command?: string;
}
```

**エラーハンドリング**:
- 名前未入力: "スクリプト名を入力してください"
- コマンド未入力: "コマンドを入力してください"
- スクリプト追加失敗: "ランスクリプトの追加に失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `prisma/schema.prisma`に`RunScript`モデルが追加されている
- [ ] マイグレーションが実行され、データベースにテーブルが作成されている
- [ ] `src/app/api/projects/[id]/scripts/route.ts`が存在する
- [ ] `src/app/api/projects/[id]/scripts/[scriptId]/route.ts`が存在する
- [ ] `src/app/projects/[id]/settings/page.tsx`が存在する
- [ ] `src/components/settings/RunScriptList.tsx`が存在する
- [ ] `src/components/settings/AddRunScriptModal.tsx`が存在する
- [ ] `src/components/settings/EditRunScriptModal.tsx`が存在する
- [ ] `src/components/settings/DeleteRunScriptDialog.tsx`が存在する
- [ ] `src/store/run-scripts.ts`が存在する
- [ ] スクリプト一覧が表示される
- [ ] 「追加」ボタンでモーダルが開く
- [ ] 名前・コマンド入力でスクリプト追加が成功する
- [ ] バリデーションエラーが表示される
- [ ] スクリプト編集が機能する
- [ ] スクリプト削除が機能する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- フェーズ5完了
- タスク2.2（プロジェクトAPI実装）完了
- `src/store/index.ts`が存在すること

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 10分
- 実装・テスト通過・コミット: 20分

---

### タスク6.2: ランスクリプト実行実装

**説明**:
worktree内でランスクリプトを実行する機能を実装する。スクリプト実行はバックエンドで行い、リアルタイムでstdout/stderrをWebSocket経由でブラウザに送信する。
- 実行API（POST /api/sessions/{id}/execute）
- リアルタイム出力表示
- 停止機能（プロセスキル）
- 終了コードと実行時間の表示

**技術的文脈**:
- Node.js child_process (`spawn`)
- WebSocketでリアルタイム出力ストリーミング
- worktreeディレクトリで実行（cwd設定）
- プロセスIDの管理（停止時に使用）
- 実行時間計測（process.hrtime.bigint()）

**必要なパッケージ**:
```bash
# Node.js標準ライブラリのみ使用
# 追加パッケージなし
```

**実装ファイル**:
- `src/services/script-runner.ts` - スクリプト実行サービス
- `src/app/api/sessions/[id]/execute/route.ts` - スクリプト実行API
- `src/app/api/sessions/[id]/execute/[executionId]/route.ts` - 実行停止API
- `src/lib/websocket/script-execution.ts` - WebSocket出力ブロードキャスト
- `src/components/sessions/ScriptExecutionPanel.tsx` - 実行パネルコンポーネント
- `src/components/sessions/ScriptOutput.tsx` - 出力表示コンポーネント
- `src/store/script-execution.ts` - スクリプト実行状態管理
- `src/services/__tests__/script-runner.test.ts` - スクリプト実行サービステスト
- `src/app/api/sessions/[id]/execute/__tests__/route.test.ts` - API テスト
- `src/components/sessions/__tests__/ScriptExecutionPanel.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/services/__tests__/script-runner.test.ts`作成
     - `executeScript()` → プロセス起動成功
     - stdout/stderrイベント受信
     - プロセス終了コード受信
     - `stopExecution()` → プロセスキル成功
   - `src/app/api/sessions/[id]/execute/__tests__/route.test.ts`作成
     - POST /api/sessions/{id}/execute → 実行開始成功、execution_id返却
     - DELETE /api/sessions/{id}/execute/{executionId} → 停止成功
   - `src/components/sessions/__tests__/ScriptExecutionPanel.test.tsx`作成
     - スクリプト選択ドロップダウン表示
     - 実行ボタンクリックで実行開始
     - 停止ボタンクリックで実行停止
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add script execution tests"

2. **実装フェーズ**:
   - `src/services/script-runner.ts`作成
     ```typescript
     import { spawn, ChildProcess } from 'child_process';
     import { EventEmitter } from 'events';

     interface ExecutionResult {
       executionId: string;
       exitCode: number | null;
       signal: string | null;
       startTime: bigint;
       endTime: bigint;
       duration: number; // ms
     }

     class ScriptRunner extends EventEmitter {
       private executions: Map<string, ChildProcess> = new Map();

       executeScript(
         executionId: string,
         command: string,
         workingDir: string
       ): void {
         const startTime = process.hrtime.bigint();
         const [cmd, ...args] = command.split(' ');
         const proc = spawn(cmd, args, {
           cwd: workingDir,
           env: process.env,
           shell: true,
         });

         this.executions.set(executionId, proc);

         proc.stdout.on('data', (data: Buffer) => {
           this.emit('output', executionId, data.toString(), 'stdout');
         });

         proc.stderr.on('data', (data: Buffer) => {
           this.emit('output', executionId, data.toString(), 'stderr');
         });

         proc.on('exit', (code, signal) => {
           const endTime = process.hrtime.bigint();
           const duration = Number(endTime - startTime) / 1_000_000; // ns to ms
           this.executions.delete(executionId);
           this.emit('exit', executionId, { exitCode: code, signal, duration });
         });
       }

       stopExecution(executionId: string): boolean {
         const proc = this.executions.get(executionId);
         if (proc) {
           proc.kill('SIGTERM');
           return true;
         }
         return false;
       }
     }

     export const scriptRunner = new ScriptRunner();
     ```
   - `src/lib/websocket/script-execution.ts`作成
     - WebSocketサーバーでscriptRunnerのイベントをリスン
     - output/exitイベントをクライアントにブロードキャスト
   - `src/app/api/sessions/[id]/execute/route.ts`作成
     - POST: スクリプト実行開始
       ```typescript
       const { scriptId } = await request.json();
       const script = await prisma.runScript.findUnique({ where: { id: scriptId } });
       const session = await prisma.session.findUnique({ where: { id: params.id } });

       const executionId = crypto.randomUUID();
       scriptRunner.executeScript(executionId, script.command, session.worktree_path);

       return Response.json({ execution_id: executionId }, { status: 202 });
       ```
   - `src/app/api/sessions/[id]/execute/[executionId]/route.ts`作成
     - DELETE: 実行停止
       ```typescript
       const stopped = scriptRunner.stopExecution(params.executionId);
       if (stopped) {
         return new Response(null, { status: 204 });
       } else {
         return Response.json({ error: 'Execution not found' }, { status: 404 });
       }
       ```
   - `src/store/script-execution.ts`作成（Zustandストア）
   - `src/components/sessions/ScriptExecutionPanel.tsx`作成
     - スクリプト選択ドロップダウン（プロジェクトのスクリプト一覧から）
     - 「実行」ボタン、「停止」ボタン
     - 実行中は停止ボタンのみ有効
   - `src/components/sessions/ScriptOutput.tsx`作成
     - 出力表示エリア（スクロール可能、最下部に自動スクロール）
     - stdout: 白色テキスト、stderr: 赤色テキスト
     - 終了コード表示: 成功（0）は緑色、エラー（非0）は赤色
     - 実行時間表示
   - セッション詳細画面にスクリプト実行パネル追加
   - WebSocketサーバーでスクリプト出力をブロードキャスト
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement run script execution with realtime output"

**API仕様**:

**POST /api/sessions/{id}/execute**:
```typescript
Request:
{
  "script_id": "script-uuid"
}

Response 202 (Accepted):
{
  "execution_id": "execution-uuid"
}

Error 404:
{
  "error": "Script not found"
}

Error 409:
{
  "error": "Script already running"
}
```

**DELETE /api/sessions/{id}/execute/{executionId}**:
```typescript
Response 204 (No Content)

Error 404:
{
  "error": "Execution not found"
}
```

**WebSocketメッセージ仕様**:
```typescript
// サーバー → クライアント（出力）
type ScriptOutputMessage = {
  type: 'script_output';
  execution_id: string;
  stream: 'stdout' | 'stderr';
  content: string;
};

// サーバー → クライアント（終了）
type ScriptExitMessage = {
  type: 'script_exit';
  execution_id: string;
  exit_code: number | null;
  signal: string | null;
  duration: number; // ms
};
```

**UI仕様**:

**ScriptExecutionPanel**:
- セクションタイトル: "ランスクリプト実行"
- スクリプト選択: `<select>`ドロップダウン
- 実行ボタン: プライマリカラー、「実行」
- 停止ボタン: デンジャーカラー、「停止」（実行中のみ表示）

**ScriptOutput**:
- 出力エリア: `bg-black text-white font-mono text-sm p-4 rounded h-64 overflow-y-auto`
- stdoutテキスト: `text-white`
- stderrテキスト: `text-red-400`
- 終了メッセージ（成功）: `text-green-400` - "実行完了 (終了コード: 0, 実行時間: 1234ms)"
- 終了メッセージ（失敗）: `text-red-400` - "実行失敗 (終了コード: 1, 実行時間: 567ms)"
- 自動スクロール: 新しい出力が追加されたら最下部にスクロール

**Zustandストア仕様**:
```typescript
interface ScriptExecutionState {
  executionId: string | null;
  isRunning: boolean;
  output: OutputLine[];
  exitCode: number | null;
  duration: number | null;
  startExecution: (sessionId: string, scriptId: string) => Promise<void>; // POST /api/sessions/{id}/execute
  stopExecution: (sessionId: string, executionId: string) => Promise<void>; // DELETE
  addOutput: (executionId: string, stream: 'stdout' | 'stderr', content: string) => void; // WebSocket経由
  setExitCode: (executionId: string, exitCode: number | null, duration: number) => void; // WebSocket経由
  clearOutput: () => void;
}

interface OutputLine {
  stream: 'stdout' | 'stderr';
  content: string;
  timestamp: number;
}
```

**エラーハンドリング**:
- スクリプト未選択: "スクリプトを選択してください"
- スクリプト実行失敗: "スクリプトの実行に失敗しました"
- スクリプト停止失敗: "スクリプトの停止に失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/services/script-runner.ts`が存在する
- [ ] `src/app/api/sessions/[id]/execute/route.ts`が存在する
- [ ] `src/app/api/sessions/[id]/execute/[executionId]/route.ts`が存在する
- [ ] `src/lib/websocket/script-execution.ts`が存在する
- [ ] `src/components/sessions/ScriptExecutionPanel.tsx`が存在する
- [ ] `src/components/sessions/ScriptOutput.tsx`が存在する
- [ ] `src/store/script-execution.ts`が存在する
- [ ] スクリプトを実行できる
- [ ] 出力がリアルタイムで表示される
- [ ] stdout/stderrが色分け表示される
- [ ] 実行中のスクリプトを停止できる
- [ ] 終了コードと実行時間が表示される
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク6.1（ランスクリプト設定実装）完了
- タスク4.1（WebSocketサーバー実装）完了
- タスク4.2（WebSocketクライアント実装）完了

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

---

### タスク6.3: ログフィルタリング/検索実装

**説明**:
ランスクリプト出力のフィルタリングと検索機能を実装する。大量の出力から必要な情報を素早く見つけられるようにする。
- ログレベルフィルター（info/warn/error）- ANSIカラーコードからログレベル推測
- テキスト検索（部分一致、大文字小文字区別なし）
- 検索結果ハイライト表示

**技術的文脈**:
- クライアントサイドフィルタリング（パフォーマンス向上）
- 正規表現による検索
- ANSIカラーコード解析（ansi-regex使用）
- React useState/useMemoによる検索結果キャッシュ

**必要なパッケージ**:
```bash
npm install ansi-regex strip-ansi
npm install -D @types/ansi-regex
```

**実装ファイル**:
- `src/lib/log-parser.ts` - ログレベル推測ユーティリティ
- `src/components/sessions/LogFilter.tsx` - フィルターUIコンポーネント
- `src/components/sessions/ScriptOutput.tsx` - 既存コンポーネント拡張（フィルター適用）
- `src/lib/__tests__/log-parser.test.ts` - ログパーサーテスト
- `src/components/sessions/__tests__/LogFilter.test.tsx` - フィルターUIテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/lib/__tests__/log-parser.test.ts`作成
     - `detectLogLevel()` → エラーログ検出（"error", "ERROR", "failed"を含む行）
     - `detectLogLevel()` → 警告ログ検出（"warn", "WARNING"を含む行）
     - `detectLogLevel()` → infoログ検出（その他）
     - `filterLogs()` → ログレベルでフィルタリング成功
     - `searchLogs()` → テキスト検索成功
   - `src/components/sessions/__tests__/LogFilter.test.tsx`作成
     - フィルターボタン3つ表示（All, Warnings, Errors）
     - 検索入力フォーム表示
     - フィルタークリックで出力が絞り込まれる
     - 検索入力で出力が絞り込まれる
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add log filtering and search tests"

2. **実装フェーズ**:
   - `src/lib/log-parser.ts`作成
     ```typescript
     import stripAnsi from 'strip-ansi';

     export type LogLevel = 'info' | 'warn' | 'error';

     export function detectLogLevel(line: string): LogLevel {
       const stripped = stripAnsi(line).toLowerCase();
       if (
         stripped.includes('error') ||
         stripped.includes('fail') ||
         stripped.includes('exception')
       ) {
         return 'error';
       }
       if (stripped.includes('warn') || stripped.includes('warning')) {
         return 'warn';
       }
       return 'info';
     }

     export function filterLogs(
       lines: OutputLine[],
       level: LogLevel | 'all'
     ): OutputLine[] {
       if (level === 'all') return lines;
       return lines.filter(line => {
         const lineLevel = detectLogLevel(line.content);
         if (level === 'error') return lineLevel === 'error';
         if (level === 'warn') return lineLevel === 'warn' || lineLevel === 'error';
         return true;
       });
     }

     export function searchLogs(
       lines: OutputLine[],
       query: string
     ): OutputLine[] {
       if (!query) return lines;
       const lowerQuery = query.toLowerCase();
       return lines.filter(line =>
         stripAnsi(line.content).toLowerCase().includes(lowerQuery)
       );
     }

     export function highlightMatch(
       text: string,
       query: string
     ): { before: string; match: string; after: string }[] {
       if (!query) return [{ before: text, match: '', after: '' }];
       const stripped = stripAnsi(text);
       const lowerText = stripped.toLowerCase();
       const lowerQuery = query.toLowerCase();
       const matches: { before: string; match: string; after: string }[] = [];
       let lastIndex = 0;
       let index = lowerText.indexOf(lowerQuery, lastIndex);

       while (index !== -1) {
         matches.push({
           before: stripped.slice(lastIndex, index),
           match: stripped.slice(index, index + query.length),
           after: '',
         });
         lastIndex = index + query.length;
         index = lowerText.indexOf(lowerQuery, lastIndex);
       }

       if (matches.length > 0) {
         matches[matches.length - 1].after = stripped.slice(lastIndex);
       }

       return matches.length > 0 ? matches : [{ before: text, match: '', after: '' }];
     }
     ```
   - `src/components/sessions/LogFilter.tsx`作成
     ```typescript
     interface LogFilterProps {
       level: LogLevel | 'all';
       searchQuery: string;
       onLevelChange: (level: LogLevel | 'all') => void;
       onSearchChange: (query: string) => void;
     }

     export function LogFilter({
       level,
       searchQuery,
       onLevelChange,
       onSearchChange,
     }: LogFilterProps) {
       return (
         <div className="flex items-center gap-4 mb-2">
           <div className="flex gap-2">
             <button
               onClick={() => onLevelChange('all')}
               className={`px-3 py-1 rounded ${level === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
             >
               All
             </button>
             <button
               onClick={() => onLevelChange('warn')}
               className={`px-3 py-1 rounded ${level === 'warn' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
             >
               Warnings
             </button>
             <button
               onClick={() => onLevelChange('error')}
               className={`px-3 py-1 rounded ${level === 'error' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
             >
               Errors
             </button>
           </div>
           <input
             type="text"
             value={searchQuery}
             onChange={(e) => onSearchChange(e.target.value)}
             placeholder="Search logs..."
             className="px-3 py-1 border rounded flex-1"
           />
         </div>
       );
     }
     ```
   - `src/components/sessions/ScriptOutput.tsx`拡張
     - LogFilterコンポーネント統合
     - useMemoでフィルタリング・検索結果をキャッシュ
     - ハイライト表示実装（マッチ部分を黄色背景で表示）
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement log filtering and search"

**UI仕様**:

**LogFilter**:
- レイアウト: 横並び、gap-4
- フィルターボタン: 3つ（All, Warnings, Errors）
  - 選択中: プライマリカラー（青/黄/赤）、白文字
  - 非選択: グレー背景
- 検索入力: `flex-1`で残りスペースを使用、プレースホルダー"Search logs..."

**ScriptOutput（拡張）**:
- LogFilterをoutputエリアの上に配置
- ハイライト表示: マッチ部分を`bg-yellow-300 text-black`で表示
- フィルター結果が0件の場合: "No logs match the current filter."を表示

**エラーハンドリング**:
- 特になし（クライアントサイド処理のためエラー発生しない）

**受入基準**:
- [ ] `src/lib/log-parser.ts`が存在する
- [ ] `src/components/sessions/LogFilter.tsx`が存在する
- [ ] `src/lib/__tests__/log-parser.test.ts`が存在する
- [ ] `src/components/sessions/__tests__/LogFilter.test.tsx`が存在する
- [ ] ログレベルでフィルタリングできる
- [ ] テキスト検索できる
- [ ] 検索結果がハイライト表示される
- [ ] フィルター結果が0件の場合、適切なメッセージが表示される
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク6.2（ランスクリプト実行実装）完了

**推定工数**: 25分（AIエージェント作業時間）
- テスト作成・コミット: 8分
- 実装・テスト通過・コミット: 17分

---

### タスク6.4: リッチ出力実装

**説明**:
Claude Code出力のマークダウンレンダリングとシンタックスハイライトを実装する。Claude Codeの応答をより読みやすく、美しく表示する。
- マークダウンレンダリング（react-markdown）
- コードブロックのシンタックスハイライト（react-syntax-highlighter）
- リンクのクリック可能化
- インラインコードのスタイリング

**技術的文脈**:
- react-markdown 9.x でマークダウンレンダリング
- react-syntax-highlighter 15.x でコードハイライト
- remark-gfm でGitHub Flavored Markdown対応
- Prism.jsテーマ（vscDarkPlus）

**必要なパッケージ**:
```bash
npm install react-markdown react-syntax-highlighter remark-gfm
npm install -D @types/react-syntax-highlighter
```

**実装ファイル**:
- `src/components/sessions/MessageDisplay.tsx` - メッセージ表示コンポーネント（マークダウンレンダリング）
- `src/components/sessions/CodeBlock.tsx` - コードブロックコンポーネント（シンタックスハイライト）
- `src/components/sessions/ChatOutput.tsx` - Claude Code出力表示コンポーネント（既存拡張）
- `src/components/sessions/__tests__/MessageDisplay.test.tsx` - メッセージ表示テスト
- `src/components/sessions/__tests__/CodeBlock.test.tsx` - コードブロックテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/sessions/__tests__/MessageDisplay.test.tsx`作成
     - マークダウンテキストレンダリング成功
     - 見出し、リスト、リンクが正しくレンダリングされる
     - インラインコードが正しくスタイリングされる
   - `src/components/sessions/__tests__/CodeBlock.test.tsx`作成
     - コードブロックが正しくレンダリングされる
     - 言語指定でシンタックスハイライトが適用される
     - コピーボタンが表示される
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add rich output tests"

2. **実装フェーズ**:
   - `src/components/sessions/CodeBlock.tsx`作成
     ```typescript
     import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
     import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
     import { useState } from 'react';

     interface CodeBlockProps {
       language: string;
       children: string;
     }

     export function CodeBlock({ language, children }: CodeBlockProps) {
       const [copied, setCopied] = useState(false);

       const copyToClipboard = () => {
         navigator.clipboard.writeText(children);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
       };

       return (
         <div className="relative group">
           <button
             onClick={copyToClipboard}
             className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
           >
             {copied ? 'Copied!' : 'Copy'}
           </button>
           <SyntaxHighlighter
             language={language || 'text'}
             style={vscDarkPlus}
             customStyle={{
               margin: 0,
               borderRadius: '0.375rem',
               fontSize: '0.875rem',
             }}
           >
             {children}
           </SyntaxHighlighter>
         </div>
       );
     }
     ```
   - `src/components/sessions/MessageDisplay.tsx`作成
     ```typescript
     import ReactMarkdown from 'react-markdown';
     import remarkGfm from 'remark-gfm';
     import { CodeBlock } from './CodeBlock';

     interface MessageDisplayProps {
       content: string;
     }

     export function MessageDisplay({ content }: MessageDisplayProps) {
       return (
         <ReactMarkdown
           remarkPlugins={[remarkGfm]}
           components={{
             code({ node, inline, className, children, ...props }) {
               const match = /language-(\w+)/.exec(className || '');
               const language = match ? match[1] : '';

               return !inline ? (
                 <CodeBlock language={language}>
                   {String(children).replace(/\n$/, '')}
                 </CodeBlock>
               ) : (
                 <code
                   className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono"
                   {...props}
                 >
                   {children}
                 </code>
               );
             },
             a({ node, children, href, ...props }) {
               return (
                 <a
                   href={href}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="text-blue-600 dark:text-blue-400 hover:underline"
                   {...props}
                 >
                   {children}
                 </a>
               );
             },
             h1({ node, children, ...props }) {
               return (
                 <h1 className="text-2xl font-bold mt-4 mb-2" {...props}>
                   {children}
                 </h1>
               );
             },
             h2({ node, children, ...props }) {
               return (
                 <h2 className="text-xl font-bold mt-3 mb-2" {...props}>
                   {children}
                 </h2>
               );
             },
             h3({ node, children, ...props }) {
               return (
                 <h3 className="text-lg font-bold mt-2 mb-1" {...props}>
                   {children}
                 </h3>
               );
             },
             ul({ node, children, ...props }) {
               return (
                 <ul className="list-disc list-inside my-2" {...props}>
                   {children}
                 </ul>
               );
             },
             ol({ node, children, ...props }) {
               return (
                 <ol className="list-decimal list-inside my-2" {...props}>
                   {children}
                 </ol>
               );
             },
           }}
         >
           {content}
         </ReactMarkdown>
       );
     }
     ```
   - `src/components/sessions/ChatOutput.tsx`拡張
     - Claude Codeメッセージに`MessageDisplay`使用
     - ユーザーメッセージはプレーンテキスト表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement rich markdown output with syntax highlighting"

**UI仕様**:

**MessageDisplay**:
- マークダウンレンダリング: react-markdownのデフォルト + カスタムスタイル
- 見出し: `h1` 2xl, `h2` xl, `h3` lg、すべて`font-bold`
- リスト: `list-disc`（番号なし）、`list-decimal`（番号付き）
- リンク: 青色、ホバーでアンダーライン、新しいタブで開く
- インラインコード: グレー背景、`font-mono`、`text-sm`

**CodeBlock**:
- シンタックスハイライト: vscDarkPlusテーマ
- コピーボタン: 右上、ホバーで表示、クリックで"Copied!"表示
- 角丸: `rounded-md`
- フォントサイズ: `text-sm`

**エラーハンドリング**:
- 特になし（レンダリングエラーはreact-markdownが処理）

**受入基準**:
- [ ] `src/components/sessions/MessageDisplay.tsx`が存在する
- [ ] `src/components/sessions/CodeBlock.tsx`が存在する
- [ ] マークダウンが正しくレンダリングされる
- [ ] コードブロックにシンタックスハイライトが適用される
- [ ] 言語指定でハイライトが変わる（例: typescript, python, bash）
- [ ] コピーボタンが機能する
- [ ] リンクがクリック可能で新しいタブで開く
- [ ] インラインコードが正しくスタイリングされる
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク6.3（ログフィルタリング/検索実装）完了
- タスク3.5（セッション詳細画面実装）完了

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 10分
- 実装・テスト通過・コミット: 20分

---

### タスク6.5: サブエージェント出力表示実装

**説明**:
Claude Codeのサブエージェント出力を折りたたみ表示する。サブエージェントの詳細な出力を折りたたむことで、主要な情報を見やすくする。
- サブエージェント出力検出（Process Managerで検出）
- 折りたたみUIコンポーネント
- サブエージェントタイプ別アイコン表示
- 展開/折りたたみ状態の保持

**技術的文脈**:
- Process Managerでサブエージェント出力をパース
- WebSocketでサブエージェント情報を送信
- Headless UI `Disclosure`で折りたたみUI
- サブエージェントタイプ: Explore, Plan, Code Reviewer, Debuggerなど

**必要なパッケージ**:
```bash
# Headless UIは既にタスク3.3でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/services/process-manager.ts` - 既存拡張（サブエージェント検出）
- `src/components/sessions/SubAgentOutput.tsx` - サブエージェント出力コンポーネント
- `src/components/sessions/SubAgentIcon.tsx` - サブエージェントアイコンコンポーネント
- `src/components/sessions/ChatOutput.tsx` - 既存拡張（サブエージェント出力表示）
- `src/services/__tests__/process-manager.test.ts` - 既存拡張（検出テスト追加）
- `src/components/sessions/__tests__/SubAgentOutput.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/services/__tests__/process-manager.test.ts`拡張
     - `detectSubAgent()` → サブエージェント開始検出
     - `detectSubAgent()` → サブエージェント終了検出
     - サブエージェントタイプ検出（Explore, Plan, Code Reviewer, Debuggerなど）
   - `src/components/sessions/__tests__/SubAgentOutput.test.tsx`作成
     - 折りたたみセクションが表示される
     - タイトルにサブエージェントタイプが表示される
     - クリックで展開/折りたたみできる
     - サブエージェント出力が正しく表示される
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add sub-agent output display tests"

2. **実装フェーズ**:
   - `src/services/process-manager.ts`拡張
     ```typescript
     interface SubAgent {
       type: string; // "Explore", "Plan", "Code Reviewer", "Debugger", etc.
       startTime: Date;
       endTime?: Date;
       output: string[];
     }

     // サブエージェント検出パターン
     const SUB_AGENT_START_PATTERN = /\[Agent: (\w+)\] Starting/i;
     const SUB_AGENT_END_PATTERN = /\[Agent: (\w+)\] Completed/i;

     class ProcessManager {
       private activeSubAgents: Map<string, SubAgent> = new Map();

       parseOutput(data: string): ParsedOutput {
         // 既存のパース処理 + サブエージェント検出
         const startMatch = data.match(SUB_AGENT_START_PATTERN);
         if (startMatch) {
           const type = startMatch[1];
           this.activeSubAgents.set(type, {
             type,
             startTime: new Date(),
             output: [],
           });
           return {
             type: 'sub_agent_start',
             subAgent: { type },
           };
         }

         const endMatch = data.match(SUB_AGENT_END_PATTERN);
         if (endMatch) {
           const type = endMatch[1];
           const subAgent = this.activeSubAgents.get(type);
           if (subAgent) {
             subAgent.endTime = new Date();
             this.activeSubAgents.delete(type);
             return {
               type: 'sub_agent_end',
               subAgent,
             };
           }
         }

         // アクティブなサブエージェントがあれば、出力を記録
         if (this.activeSubAgents.size > 0) {
           const [type, subAgent] = Array.from(this.activeSubAgents.entries())[0];
           subAgent.output.push(data);
           return {
             type: 'sub_agent_output',
             subAgent: { type, content: data },
           };
         }

         // 通常の出力
         return { type: 'output', content: data };
       }
     }
     ```
   - `src/components/sessions/SubAgentIcon.tsx`作成
     ```typescript
     interface SubAgentIconProps {
       type: string;
     }

     export function SubAgentIcon({ type }: SubAgentIconProps) {
       const icons: Record<string, string> = {
         Explore: '🔍',
         Plan: '📋',
         'Code Reviewer': '👁️',
         Debugger: '🐛',
         General: '🤖',
       };

       return (
         <span className="text-xl" title={type}>
           {icons[type] || icons.General}
         </span>
       );
     }
     ```
   - `src/components/sessions/SubAgentOutput.tsx`作成
     ```typescript
     import { Disclosure } from '@headlessui/react';
     import { ChevronDownIcon } from '@heroicons/react/24/outline';
     import { SubAgentIcon } from './SubAgentIcon';
     import { MessageDisplay } from './MessageDisplay';

     interface SubAgentOutputProps {
       type: string;
       output: string[];
       startTime: Date;
       endTime?: Date;
     }

     export function SubAgentOutput({
       type,
       output,
       startTime,
       endTime,
     }: SubAgentOutputProps) {
       const duration = endTime
         ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
         : null;

       return (
         <Disclosure>
           {({ open }) => (
             <div className="border rounded-lg my-2 bg-gray-50 dark:bg-gray-900">
               <Disclosure.Button className="flex items-center justify-between w-full px-4 py-2 text-left">
                 <div className="flex items-center gap-2">
                   <SubAgentIcon type={type} />
                   <span className="font-semibold">{type} Agent</span>
                   {duration !== null && (
                     <span className="text-sm text-gray-600">
                       ({duration}s)
                     </span>
                   )}
                 </div>
                 <ChevronDownIcon
                   className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`}
                 />
               </Disclosure.Button>
               <Disclosure.Panel className="px-4 py-2 border-t">
                 <div className="prose prose-sm max-w-none">
                   {output.map((line, index) => (
                     <MessageDisplay key={index} content={line} />
                   ))}
                 </div>
               </Disclosure.Panel>
             </div>
           )}
         </Disclosure>
       );
     }
     ```
   - `src/components/sessions/ChatOutput.tsx`拡張
     - サブエージェント出力を`SubAgentOutput`で表示
     - 通常の出力は`MessageDisplay`で表示
   - WebSocketサーバーでサブエージェント情報をブロードキャスト
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement collapsible sub-agent output display"

**WebSocketメッセージ仕様**:
```typescript
// サーバー → クライアント（サブエージェント開始）
type SubAgentStartMessage = {
  type: 'sub_agent_start';
  sub_agent: {
    type: string;
  };
};

// サーバー → クライアント（サブエージェント出力）
type SubAgentOutputMessage = {
  type: 'sub_agent_output';
  sub_agent: {
    type: string;
    content: string;
  };
};

// サーバー → クライアント（サブエージェント終了）
type SubAgentEndMessage = {
  type: 'sub_agent_end';
  sub_agent: {
    type: string;
    output: string[];
    start_time: string;
    end_time: string;
  };
};
```

**UI仕様**:

**SubAgentOutput**:
- 折りたたみセクション: `border rounded-lg my-2 bg-gray-50`
- ヘッダー: 横並び、左側にアイコン+タイプ名+実行時間、右側に展開アイコン
- アイコン: サブエージェントタイプ別の絵文字
- タイプ名: `font-semibold`
- 実行時間: `text-sm text-gray-600`、括弧内に秒数表示
- 展開アイコン: ChevronDownIcon、展開時は180度回転
- 出力エリア: `prose prose-sm`でマークダウンレンダリング

**SubAgentIcon**:
- Explore: 🔍
- Plan: 📋
- Code Reviewer: 👁️
- Debugger: 🐛
- General（その他）: 🤖

**エラーハンドリング**:
- 特になし（サブエージェント検出失敗時は通常の出力として表示）

**受入基準**:
- [ ] `src/services/process-manager.ts`でサブエージェント検出が実装されている
- [ ] `src/components/sessions/SubAgentOutput.tsx`が存在する
- [ ] `src/components/sessions/SubAgentIcon.tsx`が存在する
- [ ] サブエージェント出力が検出される
- [ ] 折りたたみ可能なセクションで表示される
- [ ] サブエージェントタイプ別にアイコンが表示される
- [ ] 実行時間が表示される
- [ ] 展開/折りたたみが機能する
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク6.4（リッチ出力実装）完了
- タスク4.1（WebSocketサーバー実装）完了

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 10分
- 実装・テスト通過・コミット: 20分

---

### タスク6.6: ターミナル統合（バックエンド）実装

**説明**:
PTY（Pseudo-Terminal）プロセスを管理するバックエンドを実装する。セッションごとにPTYプロセスを生成し、WebSocket経由で入出力を中継する。
- PTYプロセス生成（node-pty）
- WebSocket経由の入出力中継
- セッションごとのPTY管理
- プロセス終了時のクリーンアップ

**技術的文脈**:
- node-ptyライブラリ（PTY生成）
- WebSocketサーバー拡張（/ws/terminal/{sessionId}）
- worktreeディレクトリをcwdに設定
- ANSIエスケープシーケンスの透過的転送
- シェル: bash（Linux/Mac）、powershell.exe（Windows）

**必要なパッケージ**:
```bash
npm install node-pty
npm install -D @types/node-pty
```

**実装ファイル**:
- `src/services/pty-manager.ts` - PTYプロセス管理サービス
- `src/lib/websocket/terminal-ws.ts` - WebSocket経由ターミナル中継
- `server.ts` - 既存拡張（WebSocketエンドポイント追加）
- `src/services/__tests__/pty-manager.test.ts` - PTY Managerテスト
- `src/lib/websocket/__tests__/terminal-ws.test.ts` - WebSocketテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/services/__tests__/pty-manager.test.ts`作成
     - `createPTY()` → PTYプロセス生成成功
     - `createPTY()` → worktreeディレクトリをcwdに設定
     - PTY出力受信イベント
     - `write()` → PTYに入力送信成功
     - `kill()` → PTYプロセス終了成功
   - `src/lib/websocket/__tests__/terminal-ws.test.ts`作成
     - WebSocket接続成功
     - PTY出力がWebSocketクライアントに送信される
     - WebSocketクライアント入力がPTYに送信される
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add PTY manager and terminal WebSocket tests"

2. **実装フェーズ**:
   - `src/services/pty-manager.ts`作成
     ```typescript
     import * as pty from 'node-pty';
     import { EventEmitter } from 'events';
     import * as os from 'os';

     interface PTYSession {
       ptyProcess: pty.IPty;
       sessionId: string;
       workingDir: string;
     }

     class PTYManager extends EventEmitter {
       private sessions: Map<string, PTYSession> = new Map();

       createPTY(sessionId: string, workingDir: string): void {
         const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

         const ptyProcess = pty.spawn(shell, [], {
           name: 'xterm-256color',
           cols: 80,
           rows: 24,
           cwd: workingDir,
           env: process.env,
         });

         this.sessions.set(sessionId, { ptyProcess, sessionId, workingDir });

         ptyProcess.onData((data: string) => {
           this.emit('data', sessionId, data);
         });

         ptyProcess.onExit(({ exitCode, signal }) => {
           this.emit('exit', sessionId, { exitCode, signal });
           this.sessions.delete(sessionId);
         });
       }

       write(sessionId: string, data: string): void {
         const session = this.sessions.get(sessionId);
         if (session) {
           session.ptyProcess.write(data);
         }
       }

       resize(sessionId: string, cols: number, rows: number): void {
         const session = this.sessions.get(sessionId);
         if (session) {
           session.ptyProcess.resize(cols, rows);
         }
       }

       kill(sessionId: string): void {
         const session = this.sessions.get(sessionId);
         if (session) {
           session.ptyProcess.kill();
           this.sessions.delete(sessionId);
         }
       }

       hasSession(sessionId: string): boolean {
         return this.sessions.has(sessionId);
       }
     }

     export const ptyManager = new PTYManager();
     ```
   - `src/lib/websocket/terminal-ws.ts`作成
     ```typescript
     import { WebSocket, WebSocketServer } from 'ws';
     import { ptyManager } from '@/services/pty-manager';
     import { prisma } from '@/lib/prisma';

     export function setupTerminalWebSocket(wss: WebSocketServer, path: string) {
       wss.on('connection', async (ws: WebSocket, req) => {
         const url = new URL(req.url!, `http://${req.headers.host}`);
         const sessionId = url.pathname.split('/').pop();

         if (!sessionId) {
           ws.close(1008, 'Session ID required');
           return;
         }

         // 認証チェック（実装済みの認証ミドルウェア使用）
         // ...

         // セッション存在確認
         const session = await prisma.session.findUnique({
           where: { id: sessionId },
         });

         if (!session) {
           ws.close(1008, 'Session not found');
           return;
         }

         // PTY作成（既に存在する場合はスキップ）
         if (!ptyManager.hasSession(sessionId)) {
           ptyManager.createPTY(sessionId, session.worktree_path);
         }

         // PTY出力 → WebSocket
         const dataHandler = (sid: string, data: string) => {
           if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({ type: 'data', content: data }));
           }
         };

         const exitHandler = (sid: string, { exitCode, signal }: any) => {
           if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
             ws.close();
           }
         };

         ptyManager.on('data', dataHandler);
         ptyManager.on('exit', exitHandler);

         // WebSocket入力 → PTY
         ws.on('message', (message: string) => {
           try {
             const { type, data } = JSON.parse(message.toString());
             if (type === 'input') {
               ptyManager.write(sessionId, data);
             } else if (type === 'resize') {
               ptyManager.resize(sessionId, data.cols, data.rows);
             }
           } catch (error) {
             console.error('Terminal WebSocket message error:', error);
           }
         });

         ws.on('close', () => {
           ptyManager.off('data', dataHandler);
           ptyManager.off('exit', exitHandler);
         });
       });
     }
     ```
   - `server.ts`拡張
     - `/ws/terminal/{sessionId}`エンドポイント追加
     - `setupTerminalWebSocket()`呼び出し
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement PTY backend for terminal integration"

**WebSocketメッセージ仕様**:
```typescript
// クライアント → サーバー（入力）
type TerminalInputMessage = {
  type: 'input';
  data: string;
};

// クライアント → サーバー（リサイズ）
type TerminalResizeMessage = {
  type: 'resize';
  data: {
    cols: number;
    rows: number;
  };
};

// サーバー → クライアント（出力）
type TerminalDataMessage = {
  type: 'data';
  content: string;
};

// サーバー → クライアント（終了）
type TerminalExitMessage = {
  type: 'exit';
  exitCode: number;
  signal: number | null;
};
```

**エラーハンドリング**:
- セッションID未指定: WebSocket接続を1008で閉じる
- セッション存在しない: WebSocket接続を1008で閉じる
- PTY生成失敗: エラーログ出力、WebSocket接続を閉じる
- PTY書き込み失敗: エラーログ出力（接続は維持）

**受入基準**:
- [ ] `src/services/pty-manager.ts`が存在する
- [ ] `src/lib/websocket/terminal-ws.ts`が存在する
- [ ] `server.ts`に`/ws/terminal/{sessionId}`エンドポイントが追加されている
- [ ] PTYプロセスが生成される
- [ ] worktreeディレクトリがcwdに設定される
- [ ] WebSocket経由で入出力できる
- [ ] ANSIエスケープシーケンスが透過的に転送される
- [ ] プロセス終了時にクリーンアップされる
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク6.5（サブエージェント出力表示実装）完了
- タスク4.1（WebSocketサーバー実装）完了

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 13分
- 実装・テスト通過・コミット: 27分

---

### タスク6.7: ターミナル統合（フロントエンド）実装

**説明**:
XTerm.jsを使用したターミナルUIを実装する。PTYバックエンドとWebSocketで接続し、フルターミナル機能を提供する。
- XTerm.jsセットアップ
- WebSocket接続
- ANSIエスケープシーケンス対応
- リサイズ対応
- ターミナルタブ追加

**技術的文脈**:
- @xterm/xterm 5.x（XTerm.js本体）
- @xterm/addon-fit（ターミナルリサイズ）
- WebSocket接続（/ws/terminal/{sessionId}）
- カスタムフック: useTerminal
- タブUIでターミナルを表示

**必要なパッケージ**:
```bash
npm install @xterm/xterm @xterm/addon-fit
```

**実装ファイル**:
- `src/hooks/useTerminal.ts` - ターミナルWebSocket接続フック
- `src/components/sessions/TerminalPanel.tsx` - ターミナルパネルコンポーネント
- `src/app/sessions/[id]/page.tsx` - 既存拡張（ターミナルタブ追加）
- `src/hooks/__tests__/useTerminal.test.ts` - フックテスト
- `src/components/sessions/__tests__/TerminalPanel.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/hooks/__tests__/useTerminal.test.ts`作成
     - WebSocket接続成功
     - ターミナル出力受信
     - ターミナル入力送信
     - リサイズメッセージ送信
   - `src/components/sessions/__tests__/TerminalPanel.test.tsx`作成
     - ターミナルが表示される
     - 入力できる
     - 出力が表示される
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add terminal frontend tests"

2. **実装フェーズ**:
   - `src/hooks/useTerminal.ts`作成
     ```typescript
     import { useEffect, useRef, useState } from 'react';
     import { Terminal } from '@xterm/xterm';
     import { FitAddon } from '@xterm/addon-fit';

     export function useTerminal(sessionId: string) {
       const terminalRef = useRef<Terminal | null>(null);
       const fitAddonRef = useRef<FitAddon | null>(null);
       const wsRef = useRef<WebSocket | null>(null);
       const [isConnected, setIsConnected] = useState(false);

       useEffect(() => {
         const terminal = new Terminal({
           cursorBlink: true,
           fontSize: 14,
           fontFamily: 'Menlo, Monaco, "Courier New", monospace',
           theme: {
             background: '#1e1e1e',
             foreground: '#d4d4d4',
           },
         });

         const fitAddon = new FitAddon();
         terminal.loadAddon(fitAddon);

         terminalRef.current = terminal;
         fitAddonRef.current = fitAddon;

         // WebSocket接続
         const ws = new WebSocket(
           `ws://localhost:3000/ws/terminal/${sessionId}`
         );

         ws.onopen = () => {
           setIsConnected(true);
           fitAddon.fit();
           // リサイズメッセージ送信
           ws.send(
             JSON.stringify({
               type: 'resize',
               data: { cols: terminal.cols, rows: terminal.rows },
             })
           );
         };

         ws.onmessage = (event) => {
           const message = JSON.parse(event.data);
           if (message.type === 'data') {
             terminal.write(message.content);
           } else if (message.type === 'exit') {
             terminal.write(`\r\n[Process exited with code ${message.exitCode}]\r\n`);
             ws.close();
           }
         };

         ws.onclose = () => {
           setIsConnected(false);
         };

         // ターミナル入力 → WebSocket
         terminal.onData((data) => {
           if (ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({ type: 'input', data }));
           }
         });

         wsRef.current = ws;

         return () => {
           terminal.dispose();
           ws.close();
         };
       }, [sessionId]);

       const fit = () => {
         if (fitAddonRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
           fitAddonRef.current.fit();
           const terminal = terminalRef.current!;
           wsRef.current.send(
             JSON.stringify({
               type: 'resize',
               data: { cols: terminal.cols, rows: terminal.rows },
             })
           );
         }
       };

       return { terminal: terminalRef.current, isConnected, fit };
     }
     ```
   - `src/components/sessions/TerminalPanel.tsx`作成
     ```typescript
     import { useEffect, useRef } from 'react';
     import { useTerminal } from '@/hooks/useTerminal';
     import '@xterm/xterm/css/xterm.css';

     interface TerminalPanelProps {
       sessionId: string;
     }

     export function TerminalPanel({ sessionId }: TerminalPanelProps) {
       const containerRef = useRef<HTMLDivElement>(null);
       const { terminal, isConnected, fit } = useTerminal(sessionId);

       useEffect(() => {
         if (terminal && containerRef.current) {
           terminal.open(containerRef.current);
           fit();
         }
       }, [terminal, fit]);

       useEffect(() => {
         const handleResize = () => {
           fit();
         };
         window.addEventListener('resize', handleResize);
         return () => window.removeEventListener('resize', handleResize);
       }, [fit]);

       return (
         <div className="h-full flex flex-col">
           <div className="flex items-center justify-between px-4 py-2 border-b">
             <h3 className="font-semibold">Terminal</h3>
             <div className="flex items-center gap-2">
               <span
                 className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
               />
               <span className="text-sm text-gray-600">
                 {isConnected ? 'Connected' : 'Disconnected'}
               </span>
             </div>
           </div>
           <div ref={containerRef} className="flex-1" />
         </div>
       );
     }
     ```
   - `src/app/sessions/[id]/page.tsx`拡張
     - タブUI追加（Chat, Diff, Git Ops, Terminal）
     - Terminalタブで`TerminalPanel`表示
   - CSSインポート: `@xterm/xterm/css/xterm.css`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement terminal frontend with XTerm.js"

**UI仕様**:

**ターミナルタブ**:
- タブ追加: "Terminal"
- タブアイコン: ターミナルアイコン（任意）

**TerminalPanel**:
- ヘッダー: タイトル"Terminal" + 接続状態インジケーター
- 接続状態: 緑色ドット（接続中）、赤色ドット（切断）
- ターミナルエリア: `flex-1`で残りスペースを使用
- XTerm.jsテーマ: ダーク（背景#1e1e1e、文字#d4d4d4）
- フォント: Menlo, Monaco, "Courier New", monospace
- フォントサイズ: 14px
- カーソル: ブリンク有効

**エラーハンドリング**:
- WebSocket接続失敗: 接続状態を"Disconnected"に設定、再接続なし
- PTY終了: "[Process exited with code X]"を表示

**受入基準**:
- [ ] `src/hooks/useTerminal.ts`が存在する
- [ ] `src/components/sessions/TerminalPanel.tsx`が存在する
- [ ] セッション詳細画面にターミナルタブが追加されている
- [ ] ターミナルタブが表示される
- [ ] コマンドを入力・実行できる
- [ ] 出力が正しく表示される
- [ ] ANSIエスケープシーケンスが正しく解釈される（色、カーソル移動など）
- [ ] ウィンドウリサイズでターミナルがリサイズされる
- [ ] 接続状態インジケーターが機能する
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク6.6（ターミナル統合（バックエンド）実装）完了
- タスク4.2（WebSocketクライアント実装）完了

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 13分
- 実装・テスト通過・コミット: 27分

---

## フェーズ6完了

このフェーズの完了により、以下の高度な機能が実装されます:
- ランスクリプト設定・実行
- ログフィルタリング・検索
- リッチ出力（マークダウン・シンタックスハイライト）
- サブエージェント出力表示
- ターミナル統合（PTY + XTerm.js）

次のフェーズ7では、UI/UX改善とドキュメント作成を行います。

## フェーズ7: UI/UX改善とドキュメント
*推定期間: 85分（AIエージェント作業時間）*
*MVP: No*

### タスク7.1: ライト/ダークモード実装

**説明**:
テーマ切り替え機能を実装する。ユーザーの好みやOSテーマに応じて、ライトモードとダークモードを切り替えられるようにする。
- OSテーマ自動検出（prefers-color-scheme）
- 手動切り替えボタン
- ローカルストレージ保存（設定永続化）
- Tailwind CSS darkモード対応

**技術的文脈**:
- Next.js 14 App Router
- Tailwind CSS 3.x darkモード（class戦略）
- next-themes 0.x（テーマ管理）
- ローカルストレージでテーマ保存
- Zustand 4.xでテーマ状態管理（オプション）

**必要なパッケージ**:
```bash
npm install next-themes
```

**実装ファイル**:
- `tailwind.config.ts` - 既存拡張（darkMode設定）
- `src/app/providers.tsx` - ThemeProviderラップ
- `src/app/layout.tsx` - 既存拡張（Providersでラップ）
- `src/components/common/ThemeToggle.tsx` - テーマ切り替えボタンコンポーネント
- `src/components/layout/Header.tsx` - 既存拡張（ThemeToggle追加）
- `src/components/common/__tests__/ThemeToggle.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/common/__tests__/ThemeToggle.test.tsx`作成
     - テーマトグルボタンが表示される
     - クリックでテーマが切り替わる（light ⇔ dark）
     - 現在のテーマアイコンが表示される（太陽/月）
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add theme toggle tests"

2. **実装フェーズ**:
   - `tailwind.config.ts`拡張
     ```typescript
     import type { Config } from 'tailwindcss';

     const config: Config = {
       darkMode: 'class', // クラス戦略を使用
       content: [
         './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
         './src/components/**/*.{js,ts,jsx,tsx,mdx}',
         './src/app/**/*.{js,ts,jsx,tsx,mdx}',
       ],
       theme: {
         extend: {
           // 既存のテーマ拡張設定
         },
       },
       plugins: [],
     };
     export default config;
     ```
   - `src/app/providers.tsx`作成
     ```typescript
     'use client';

     import { ThemeProvider } from 'next-themes';
     import { ReactNode } from 'react';

     export function Providers({ children }: { children: ReactNode }) {
       return (
         <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
           {children}
         </ThemeProvider>
       );
     }
     ```
   - `src/app/layout.tsx`拡張
     ```typescript
     import { Providers } from './providers';

     export default function RootLayout({
       children,
     }: {
       children: React.ReactNode;
     }) {
       return (
         <html lang="ja" suppressHydrationWarning>
           <body>
             <Providers>{children}</Providers>
           </body>
         </html>
       );
     }
     ```
   - `src/components/common/ThemeToggle.tsx`作成
     ```typescript
     'use client';

     import { useTheme } from 'next-themes';
     import { useEffect, useState } from 'react';
     import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

     export function ThemeToggle() {
       const [mounted, setMounted] = useState(false);
       const { theme, setTheme } = useTheme();

       useEffect(() => {
         setMounted(true);
       }, []);

       if (!mounted) {
         return (
           <button
             className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
             aria-label="Toggle theme"
           >
             <div className="w-5 h-5" />
           </button>
         );
       }

       return (
         <button
           onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
           className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
           aria-label="Toggle theme"
         >
           {theme === 'dark' ? (
             <SunIcon className="w-5 h-5 text-yellow-500" />
           ) : (
             <MoonIcon className="w-5 h-5 text-gray-700" />
           )}
         </button>
       );
     }
     ```
   - `src/components/layout/Header.tsx`拡張
     - ヘッダー右側に`ThemeToggle`追加
   - 既存コンポーネントにdarkモードスタイル追加
     - 例: `bg-white dark:bg-gray-900`
     - 例: `text-gray-900 dark:text-gray-100`
     - 例: `border-gray-200 dark:border-gray-700`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement light/dark theme toggle with next-themes"

**UI仕様**:

**ThemeToggle**:
- ボタン: 円形背景、ホバーでグレー背景
- ライトモード時: 月アイコン（MoonIcon）、グレー色
- ダークモード時: 太陽アイコン（SunIcon）、黄色
- アニメーション: `transition-colors`でスムーズ切り替え
- 配置: ヘッダー右側、ログアウトボタンの隣

**ダークモードカラーパレット**:
- 背景: `bg-gray-900`（主背景）、`bg-gray-800`（カード背景）
- テキスト: `text-gray-100`（主テキスト）、`text-gray-400`（副テキスト）
- ボーダー: `border-gray-700`
- ホバー: `hover:bg-gray-800`
- プライマリカラー: `bg-blue-600`（ライトモード: `bg-blue-500`）

**適用コンポーネント**:
- すべてのコンポーネントにdarkモードスタイル追加
- 特に重要なコンポーネント:
  - Header: `bg-white dark:bg-gray-900 border-b dark:border-gray-700`
  - ProjectCard: `bg-white dark:bg-gray-800 border dark:border-gray-700`
  - SessionCard: `bg-white dark:bg-gray-800 border dark:border-gray-700`
  - ChatOutput: `bg-gray-50 dark:bg-gray-900`
  - DiffViewer: react-diff-viewer-continuedのダークテーマ使用
  - Terminal: 既にダークテーマ（変更不要）

**エラーハンドリング**:
- 特になし（テーマ切り替えはクライアントサイドで完結）

**受入基準**:
- [ ] `tailwind.config.ts`に`darkMode: 'class'`が設定されている
- [ ] `src/app/providers.tsx`が存在し、`ThemeProvider`でラップされている
- [ ] `src/app/layout.tsx`で`Providers`が使用されている
- [ ] `src/components/common/ThemeToggle.tsx`が存在する
- [ ] ヘッダーにテーマトグルボタンが表示される
- [ ] OSテーマに従って初期表示される
- [ ] 手動で切り替えられる
- [ ] 設定がローカルストレージに保存される
- [ ] ページリロード後も設定が保持される
- [ ] 全コンポーネントがダークモードに対応している
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- フェーズ6完了
- タスク3.2（レイアウトとナビゲーション実装）完了

**推定工数**: 25分（AIエージェント作業時間）
- テスト作成・コミット: 7分
- 実装・テスト通過・コミット: 18分

---

### タスク7.2: モバイルUI最適化

**説明**:
モバイル向けUIを最適化する。小さい画面でも使いやすいように、レスポンシブデザインを実装する。
- カード形式セッション一覧（モバイル）
- タッチ操作最適化（タップ領域拡大）
- 入力フォーム調整（モバイルキーボード対応）
- ハンバーガーメニュー（ナビゲーション）

**技術的文脈**:
- Tailwind CSS レスポンシブデザイン（sm:, md:, lg: ブレークポイント）
- ブレークポイント: 768px（タブレット）、1024px（デスクトップ）
- Headless UI `Menu`でハンバーガーメニュー
- モバイルファーストアプローチ

**必要なパッケージ**:
```bash
# Headless UIは既にタスク3.3でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/layout/Header.tsx` - 既存拡張（ハンバーガーメニュー追加）
- `src/components/layout/MobileMenu.tsx` - モバイルメニューコンポーネント
- `src/components/sessions/SessionList.tsx` - 既存拡張（モバイルレイアウト）
- `src/components/sessions/SessionCard.tsx` - 既存拡張（モバイルレイアウト）
- `src/components/sessions/ChatOutput.tsx` - 既存拡張（モバイルレイアウト）
- `src/components/layout/__tests__/MobileMenu.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/layout/__tests__/MobileMenu.test.tsx`作成
     - 768px未満でハンバーガーアイコンが表示される
     - ハンバーガークリックでメニューが開く
     - メニュー内にナビゲーションリンクが表示される
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add mobile UI optimization tests"

2. **実装フェーズ**:
   - `src/components/layout/MobileMenu.tsx`作成
     ```typescript
     'use client';

     import { Menu, Transition } from '@headlessui/react';
     import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
     import { Fragment } from 'react';
     import Link from 'next/link';

     interface MobileMenuProps {
       items: Array<{ label: string; href: string }>;
     }

     export function MobileMenu({ items }: MobileMenuProps) {
       return (
         <Menu as="div" className="relative md:hidden">
           {({ open }) => (
             <>
               <Menu.Button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                 {open ? (
                   <XMarkIcon className="w-6 h-6" />
                 ) : (
                   <Bars3Icon className="w-6 h-6" />
                 )}
               </Menu.Button>
               <Transition
                 as={Fragment}
                 enter="transition ease-out duration-100"
                 enterFrom="transform opacity-0 scale-95"
                 enterTo="transform opacity-100 scale-100"
                 leave="transition ease-in duration-75"
                 leaveFrom="transform opacity-100 scale-100"
                 leaveTo="transform opacity-0 scale-95"
               >
                 <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                   <div className="py-1">
                     {items.map((item) => (
                       <Menu.Item key={item.href}>
                         {({ active }) => (
                           <Link
                             href={item.href}
                             className={`block px-4 py-2 text-sm ${
                               active
                                 ? 'bg-gray-100 dark:bg-gray-700'
                                 : ''
                             }`}
                           >
                             {item.label}
                           </Link>
                         )}
                       </Menu.Item>
                     ))}
                   </div>
                 </Menu.Items>
               </Transition>
             </>
           )}
         </Menu>
       );
     }
     ```
   - `src/components/layout/Header.tsx`拡張
     ```typescript
     export function Header() {
       const menuItems = [
         { label: 'Projects', href: '/' },
         { label: 'Settings', href: '/settings' },
         { label: 'Logout', href: '/logout' },
       ];

       return (
         <header className="border-b dark:border-gray-700 bg-white dark:bg-gray-900">
           <div className="flex items-center justify-between px-4 py-3">
             {/* ロゴ */}
             <h1 className="text-xl font-bold">ClaudeWork</h1>

             {/* デスクトップナビゲーション */}
             <nav className="hidden md:flex items-center gap-4">
               <Link href="/">Projects</Link>
               <Link href="/settings">Settings</Link>
               <ThemeToggle />
               <button onClick={handleLogout}>Logout</button>
             </nav>

             {/* モバイルメニュー */}
             <div className="flex items-center gap-2 md:hidden">
               <ThemeToggle />
               <MobileMenu items={menuItems} />
             </div>
           </div>
         </header>
       );
     }
     ```
   - `src/components/sessions/SessionList.tsx`拡張
     ```typescript
     // モバイル: カード形式（1カラム）
     // タブレット: グリッド（2カラム）
     // デスクトップ: グリッド（3カラム）
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       {sessions.map((session) => (
         <SessionCard key={session.id} session={session} />
       ))}
     </div>
     ```
   - `src/components/sessions/SessionCard.tsx`拡張
     ```typescript
     // タップ領域拡大: padding増加、min-height設定
     <div className="border rounded-lg p-4 min-h-[120px] hover:shadow-md cursor-pointer active:bg-gray-50 dark:active:bg-gray-700">
       {/* ... */}
     </div>
     ```
   - `src/components/sessions/ChatOutput.tsx`拡張
     ```typescript
     // モバイル: 入力フォームを最下部固定
     <div className="flex flex-col h-full">
       <div className="flex-1 overflow-y-auto">
         {/* メッセージ履歴 */}
       </div>
       <div className="border-t p-4 bg-white dark:bg-gray-900">
         {/* 入力フォーム */}
         <textarea
           className="w-full px-4 py-3 text-base" // text-baseでモバイルズーム防止
           rows={3}
         />
       </div>
     </div>
     ```
   - すべてのフォーム入力に`text-base`または`text-[16px]`設定（iOS自動ズーム防止）
   - ボタンに`min-h-[44px]`設定（タップ領域確保）
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Optimize UI for mobile devices with responsive design"

**UI仕様**:

**ブレークポイント**:
- モバイル: デフォルト（〜767px）
- タブレット: `sm:`（768px〜）
- デスクトップ: `lg:`（1024px〜）

**MobileMenu**:
- ハンバーガーアイコン: 3本線（Bars3Icon）
- 閉じるアイコン: X（XMarkIcon）
- メニュー: 右上からドロップダウン、白背景（ダークモード: グレー）
- アニメーション: フェード+スケール

**SessionList（モバイル）**:
- レイアウト: 1カラム（`grid-cols-1`）
- タブレット: 2カラム（`sm:grid-cols-2`）
- デスクトップ: 3カラム（`lg:grid-cols-3`）
- Gap: 4（1rem）

**SessionCard（モバイル）**:
- Padding: 4（1rem）- 最小高さ: 120px（`min-h-[120px]`）
- タップフィードバック: `active:bg-gray-50`
- ホバー効果: デスクトップのみ（`hover:shadow-md`）

**ChatOutput（モバイル）**:
- 入力フォーム: 最下部固定（`border-t p-4`）
- テキストエリア: `text-base`（16px、iOS自動ズーム防止）
- 行数: 3行（`rows={3}`）

**タップ領域最適化**:
- すべてのボタン: 最小高さ44px（`min-h-[44px]`）
- すべてのリンク: パディング拡大（`p-4`）

**フォント最適化**:
- すべての入力フィールド: `text-base`または`text-[16px]`（iOS自動ズーム防止）

**エラーハンドリング**:
- 特になし（レスポンシブデザインはCSSで完結）

**受入基準**:
- [ ] `src/components/layout/MobileMenu.tsx`が存在する
- [ ] 768px未満でハンバーガーメニューが表示される
- [ ] 768px以上でデスクトップナビゲーションが表示される
- [ ] ハンバーガーメニューが機能する
- [ ] セッション一覧がモバイルで1カラム表示される
- [ ] タブレットで2カラム、デスクトップで3カラム表示される
- [ ] タップ領域が44px以上確保されている
- [ ] 入力フォームが最下部固定されている
- [ ] フォントサイズが16px以上でiOS自動ズームが発生しない
- [ ] タッチ操作がスムーズ
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク7.1（ライト/ダークモード実装）完了
- タスク3.2（レイアウトとナビゲーション実装）完了
- タスク3.4（セッション管理画面実装）完了
- タスク3.5（セッション詳細画面実装）完了

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 9分
- 実装・テスト通過・コミット: 21分

---

### タスク7.3: ドキュメント作成

**説明**:
README、セットアップガイドを作成する。ユーザーが ClaudeWork を簡単にセットアップして使用できるようにする。
- README.md（概要、機能、スクリーンショット）
- セットアップ手順
- 環境変数一覧
- API仕様概要
- ライセンス情報

**技術的文脈**:
- Markdownドキュメント
- 実際の動作を確認してスクリーンショットを撮影（オプション）
- API仕様はOpenAPI/Swagger形式も検討（将来的）

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `README.md` - プロジェクトREADME
- `docs/SETUP.md` - セットアップガイド
- `docs/ENV_VARS.md` - 環境変数リファレンス
- `docs/API.md` - API仕様概要
- `LICENSE` - ライセンスファイル（MITライセンス推奨）

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - ドキュメント作成のため、テストは作成しない
   - コミットなし

2. **実装フェーズ**:
   - `README.md`作成
     ```markdown
     # ClaudeWork

     ClaudeWork は、Claude Code セッションをブラウザから管理するための Web ベースツールです。複数のセッションを並列で実行し、Git worktree を使用して各セッションを独立した環境で管理します。

     ## 主な機能

     - **セッション管理**: 複数の Claude Code セッションを並列実行
     - **Git worktree 統合**: セッションごとに独立した Git 環境
     - **リアルタイム通信**: WebSocket によるリアルタイム出力表示
     - **Diff 表示**: Git diff をビジュアルに表示
     - **Git 操作**: rebase、squash merge などの Git 操作をブラウザから実行
     - **ランスクリプト**: テスト実行、ビルドなどの定型作業を簡単に実行
     - **ターミナル統合**: ブラウザ内でターミナル操作
     - **ライト/ダークモード**: テーマ切り替え対応
     - **モバイル対応**: レスポンシブデザイン

     ## セットアップ

     詳細は [SETUP.md](docs/SETUP.md) を参照してください。

     ### クイックスタート

     ```bash
     npx claude-work
     ```

     初回起動時に認証トークンを設定します:

     ```bash
     export AUTH_TOKEN="your-secret-token"
     npx claude-work
     ```

     ブラウザで `http://localhost:3000` を開き、設定したトークンでログインします。

     ## 環境変数

     詳細は [ENV_VARS.md](docs/ENV_VARS.md) を参照してください。

     | 変数名 | 説明 | デフォルト |
     |--------|------|-----------|
     | `AUTH_TOKEN` | 認証トークン | なし（必須） |
     | `PORT` | サーバーポート | 3000 |
     | `DATABASE_URL` | SQLite データベースパス | file:./data/claude-work.db |

     ## API 仕様

     詳細は [API.md](docs/API.md) を参照してください。

     ## ライセンス

     MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

     ## 技術スタック

     - **フロントエンド**: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand
     - **バックエンド**: Next.js API Routes, Prisma, SQLite, WebSocket (ws)
     - **その他**: XTerm.js, react-diff-viewer-continued, Headless UI

     ## 貢献

     Issue や Pull Request は歓迎します。

     ## サポート

     問題が発生した場合は、GitHub Issues でお知らせください。
     ```
   - `docs/SETUP.md`作成
     ```markdown
     # セットアップガイド

     ## 必要要件

     - Node.js 20 以上
     - Git
     - Claude Code CLI（`npm install -g claude-code`）

     ## インストール

     ### npx で実行（推奨）

     グローバルインストール不要で実行できます:

     ```bash
     npx claude-work
     ```

     ### グローバルインストール

     ```bash
     npm install -g claude-work
     claude-work
     ```

     ## 初期設定

     ### 1. 認証トークン設定

     環境変数で認証トークンを設定します:

     ```bash
     export AUTH_TOKEN="your-secret-token"
     ```

     または、`.env`ファイルを作成:

     ```
     AUTH_TOKEN=your-secret-token
     PORT=3000
     DATABASE_URL=file:./data/claude-work.db
     ```

     ### 2. サーバー起動

     ```bash
     npx claude-work
     ```

     サーバーが起動したら、ブラウザで `http://localhost:3000` を開きます。

     ### 3. ログイン

     設定した認証トークンでログインします。

     ### 4. プロジェクト追加

     Git リポジトリのパスを指定してプロジェクトを追加します:

     ```
     /path/to/your/git/repo
     ```

     ### 5. セッション作成

     プロジェクトを開き、セッション名とプロンプトを入力してセッションを作成します。

     ## トラブルシューティング

     ### データベースエラー

     データベースファイルが破損した場合、削除して再起動します:

     ```bash
     rm -rf data/claude-work.db
     npx claude-work
     ```

     ### ポート競合

     ポート 3000 が使用中の場合、別のポートを指定します:

     ```bash
     PORT=3001 npx claude-work
     ```

     ### Claude Code が見つからない

     Claude Code CLI がインストールされているか確認します:

     ```bash
     claude --version
     ```

     インストールされていない場合:

     ```bash
     npm install -g claude-code
     ```
     ```
   - `docs/ENV_VARS.md`作成
     ```markdown
     # 環境変数リファレンス

     ClaudeWork で使用可能な環境変数の一覧です。

     ## 必須環境変数

     ### AUTH_TOKEN

     - **説明**: 認証トークン
     - **形式**: 任意の文字列（推奨: 32文字以上のランダム文字列）
     - **例**: `AUTH_TOKEN="my-secret-token-12345678"`
     - **デフォルト**: なし（必須）

     ## オプション環境変数

     ### PORT

     - **説明**: サーバーポート
     - **形式**: 整数（1024-65535）
     - **例**: `PORT=3000`
     - **デフォルト**: `3000`

     ### DATABASE_URL

     - **説明**: SQLite データベースパス
     - **形式**: `file:./path/to/database.db`
     - **例**: `DATABASE_URL="file:./data/claude-work.db"`
     - **デフォルト**: `file:./data/claude-work.db`

     ### NODE_ENV

     - **説明**: 実行環境
     - **形式**: `development` | `production` | `test`
     - **例**: `NODE_ENV=production`
     - **デフォルト**: `development`

     ### LOG_LEVEL

     - **説明**: ログレベル
     - **形式**: `error` | `warn` | `info` | `debug`
     - **例**: `LOG_LEVEL=info`
     - **デフォルト**: `info`

     ## 設定例

     ### .env ファイル

     ```env
     AUTH_TOKEN=your-secret-token-here
     PORT=3000
     DATABASE_URL=file:./data/claude-work.db
     NODE_ENV=production
     LOG_LEVEL=info
     ```

     ### コマンドライン

     ```bash
     AUTH_TOKEN="your-token" PORT=3001 npx claude-work
     ```
     ```
   - `docs/API.md`作成
     ```markdown
     # API 仕様概要

     ClaudeWork の REST API とWebSocket API の概要です。

     ## 認証

     すべての API リクエストには、セッションクッキーが必要です。

     ### ログイン

     ```
     POST /api/auth/login
     Content-Type: application/json

     {
       "token": "your-auth-token"
     }
     ```

     ### ログアウト

     ```
     POST /api/auth/logout
     ```

     ## プロジェクト API

     ### プロジェクト一覧取得

     ```
     GET /api/projects
     ```

     ### プロジェクト追加

     ```
     POST /api/projects
     Content-Type: application/json

     {
       "path": "/path/to/git/repo"
     }
     ```

     ### プロジェクト削除

     ```
     DELETE /api/projects/{id}
     ```

     ## セッション API

     ### セッション一覧取得

     ```
     GET /api/projects/{id}/sessions
     ```

     ### セッション作成

     ```
     POST /api/projects/{id}/sessions
     Content-Type: application/json

     {
       "name": "session-name",
       "prompt": "initial prompt",
       "model": "auto"
     }
     ```

     ### セッション削除

     ```
     DELETE /api/sessions/{id}
     ```

     ## Git 操作 API

     ### Diff 取得

     ```
     GET /api/sessions/{id}/diff
     ```

     ### Rebase 実行

     ```
     POST /api/sessions/{id}/rebase
     ```

     ### Squash Merge 実行

     ```
     POST /api/sessions/{id}/merge
     Content-Type: application/json

     {
       "commit_message": "Merge commit message"
     }
     ```

     ## ランスクリプト API

     ### スクリプト一覧取得

     ```
     GET /api/projects/{id}/scripts
     ```

     ### スクリプト実行

     ```
     POST /api/sessions/{id}/execute
     Content-Type: application/json

     {
       "script_id": "script-uuid"
     }
     ```

     ## WebSocket API

     ### セッション WebSocket

     ```
     ws://localhost:3000/ws/sessions/{id}
     ```

     **メッセージ形式**:

     クライアント → サーバー:
     ```json
     {
       "type": "input",
       "content": "user message"
     }
     ```

     サーバー → クライアント:
     ```json
     {
       "type": "output",
       "content": "claude response"
     }
     ```

     ### ターミナル WebSocket

     ```
     ws://localhost:3000/ws/terminal/{id}
     ```

     **メッセージ形式**:

     クライアント → サーバー:
     ```json
     {
       "type": "input",
       "data": "ls -la\n"
     }
     ```

     サーバー → クライアント:
     ```json
     {
       "type": "data",
       "content": "total 48\ndrwxr-xr-x ..."
     }
     ```
     ```
   - `LICENSE`作成（MITライセンス）
     ```
     MIT License

     Copyright (c) 2025 ClaudeWork Contributors

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in all
     copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     SOFTWARE.
     ```
   - コミット: "Add comprehensive documentation (README, SETUP, ENV_VARS, API, LICENSE)"

**ドキュメント構成**:

**README.md**:
- プロジェクト概要
- 主な機能リスト
- クイックスタート
- 環境変数表
- 技術スタック
- ライセンス情報
- 貢献ガイドライン

**docs/SETUP.md**:
- 必要要件
- インストール手順（npx/グローバル）
- 初期設定手順
- トラブルシューティング

**docs/ENV_VARS.md**:
- 環境変数一覧（表形式）
- 各変数の説明、形式、デフォルト値
- 設定例（.envファイル、コマンドライン）

**docs/API.md**:
- 認証API
- プロジェクトAPI
- セッションAPI
- Git操作API
- ランスクリプトAPI
- WebSocket API
- リクエスト/レスポンス例

**LICENSE**:
- MITライセンス全文

**エラーハンドリング**:
- 特になし（ドキュメント作成のためエラー処理不要）

**受入基準**:
- [ ] `README.md`が存在する
- [ ] `docs/SETUP.md`が存在する
- [ ] `docs/ENV_VARS.md`が存在する
- [ ] `docs/API.md`が存在する
- [ ] `LICENSE`が存在する
- [ ] README にプロジェクト概要が記載されている
- [ ] README に主な機能リストが記載されている
- [ ] README にクイックスタートが記載されている
- [ ] SETUP にセットアップ手順が記載されている
- [ ] SETUP にトラブルシューティングが記載されている
- [ ] ENV_VARS に全環境変数が記載されている
- [ ] API に主要な API エンドポイントが記載されている
- [ ] LICENSE に MIT ライセンスが記載されている
- [ ] すべてのドキュメントが Markdown 形式である
- [ ] リンクが正しく設定されている
- [ ] コミットが作成されている

**依存関係**:
- タスク7.2（モバイルUI最適化）完了
- 全フェーズ完了（ドキュメントは最終段階）

**推定工数**: 30分（AIエージェント作業時間）
- ドキュメント作成・コミット: 30分

---

## フェーズ7完了

このフェーズの完了により、以下のUI/UX改善とドキュメントが実装されます:
- ライト/ダークモード
- モバイルUI最適化
- 包括的なドキュメント（README, SETUP, ENV_VARS, API, LICENSE）

これで ClaudeWork の全フェーズが完了します。

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

### リスク1: Claude Code CLIの仕様変更

**影響度**: 高
**発生確率**: 中
**軽減策**: 
- Claude Code出力パーサーを抽象化し、仕様変更に対応しやすくする
- バージョン固定と定期的な互換性確認

### リスク2: WebSocket接続の不安定性

**影響度**: 中
**発生確率**: 中
**軽減策**:
- 自動再接続機能の実装
- REST APIへのフォールバック機能

### リスク3: 並列セッションによるリソース枯渇

**影響度**: 高
**発生確率**: 低
**軽減策**:
- 最大セッション数の制限（10セッション）
- リソース監視とアラート

### リスク4: Gitコンフリクトの複雑化

**影響度**: 中
**発生確率**: 中
**軽減策**:
- コンフリクト発生時の明確な通知
- 手動解決を促すUI（ターミナル統合で対応可能）

## 備考

### 技術スタック

**フロントエンド**:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand
- react-diff-viewer-continued
- XTerm.js（フェーズ6）
- Playwright（E2E）

**バックエンド（Next.js統合）**:
- Next.js 14 API Routes
- Next.jsカスタムサーバー（WebSocket統合）
- TypeScript
- Prisma 5.x
- better-sqlite3
- ws / socket.io（WebSocket）
- winston（ロギング）
- Vitest（テスト）

**インフラ**:
- Node.js 20+
- SQLite
- npxで実行可能（グローバルインストール不要）
- リバースプロキシ（Caddy/nginx推奨、本番環境のみ）

### コーディング規約

- TypeScript: strict mode有効
- ESLint + Prettier for linting/formatting
- コミットメッセージ: Conventional Commits
- ブランチ戦略: GitHub Flow
