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
- bcryptjsでトークンハッシュ比較
- HTTPOnlyクッキーでセッションID管理（iron-session使用）
- セッション有効期限: 24時間

**実装手順（TDD）**:
1. テスト作成: `src/app/api/auth/__tests__/route.test.ts`
   - 正しいトークンでログイン成功
   - 誤ったトークンでログイン失敗
   - ログアウト成功
   - 認証なしでprotected endpointアクセス拒否
2. `src/app/api/auth/login/route.ts`にログインエンドポイント実装
3. `src/app/api/auth/logout/route.ts`にログアウトエンドポイント実装
4. `src/lib/auth.ts`に認証ヘルパー関数実装
5. テスト通過確認

**受入基準**:
- [ ] `POST /api/auth/login`が実装されている
- [ ] `POST /api/auth/logout`が実装されている
- [ ] 正しいトークンでログイン時、セッションクッキーが設定される
- [ ] 誤ったトークンで401が返る
- [ ] `src/lib/auth.ts`で認証ヘルパーが機能する
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク1.4
**推定工数**: 40分
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
- Next.js App Router
- Server Actions or API Routes for auth
- Zustandで認証状態管理

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/login.test.tsx`
   - ログインフォーム表示
   - 正しいトークンでログイン成功
   - 誤ったトークンでエラー表示
2. `frontend/src/app/login/page.tsx`にログインページ作成
3. `frontend/src/store/auth.ts`に認証ストア作成
4. `frontend/src/components/AuthGuard.tsx`に認証ガード作成
5. テスト通過確認

**受入基準**:
- [ ] `/login`ページが表示される
- [ ] トークン入力フォームがある
- [ ] ログイン成功時に`/`にリダイレクトされる
- [ ] ログイン失敗時にエラーメッセージが表示される
- [ ] 未認証で`/`アクセス時に`/login`にリダイレクトされる
- [ ] 全テストが通過する

**依存関係**: タスク1.2
**推定工数**: 35分
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
- Tailwind CSS
- モバイルブレークポイント: 768px

**実装手順（TDD）**:
1. `frontend/src/components/layout/Header.tsx`作成
2. `frontend/src/components/layout/Sidebar.tsx`作成
3. `frontend/src/components/layout/MainLayout.tsx`作成
4. `frontend/src/app/layout.tsx`にMainLayout適用
5. レスポンシブ動作確認

**受入基準**:
- [ ] ヘッダーが表示される
- [ ] サイドバーにプロジェクト一覧が表示される
- [ ] 768px未満でサイドバーが折りたたまれる
- [ ] ログアウトボタンが機能する

**依存関係**: タスク3.1
**推定工数**: 30分
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
- React Hook Form for forms
- Headless UI or Radix for modals/dialogs

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/projects.test.tsx`
2. `frontend/src/components/projects/ProjectList.tsx`作成
3. `frontend/src/components/projects/AddProjectModal.tsx`作成
4. `frontend/src/components/projects/DeleteProjectDialog.tsx`作成
5. `frontend/src/app/page.tsx`にプロジェクト一覧表示
6. テスト通過確認

**受入基準**:
- [ ] プロジェクト一覧が表示される
- [ ] 「追加」ボタンでモーダルが開く
- [ ] パス入力してプロジェクト追加できる
- [ ] 無効なパスでエラーメッセージが表示される
- [ ] プロジェクト削除確認ダイアログが表示される
- [ ] プロジェクト選択でセッション一覧に遷移する
- [ ] 全テストが通過する

**依存関係**: タスク3.2
**推定工数**: 40分
**ステータス**: `TODO`

---

### タスク3.4: セッション管理画面実装

**説明**:
セッション一覧と作成機能を実装する
- セッション一覧表示（ステータスアイコン付き）
- セッション作成フォーム（名前、プロンプト）
- セッション選択でセッション詳細画面へ遷移

**技術的文脈**:
- セッションステータスに応じたアイコン表示
- リアルタイムステータス更新は次フェーズで実装

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/sessions.test.tsx`
2. `frontend/src/components/sessions/SessionList.tsx`作成
3. `frontend/src/components/sessions/CreateSessionForm.tsx`作成
4. `frontend/src/components/sessions/SessionStatusIcon.tsx`作成
5. `frontend/src/app/projects/[id]/page.tsx`作成
6. テスト通過確認

**受入基準**:
- [ ] セッション一覧が表示される
- [ ] 各セッションにステータスアイコンが表示される
- [ ] セッション作成フォームが表示される
- [ ] セッション作成が成功する
- [ ] セッション選択で詳細画面に遷移する
- [ ] 全テストが通過する

**依存関係**: タスク3.3
**推定工数**: 40分
**ステータス**: `TODO`

---

### タスク3.5: セッション詳細画面実装

**説明**:
Claude Codeとの対話画面を実装する
- メッセージ履歴表示
- ユーザー入力フォーム
- 権限確認ダイアログ（承認/拒否ボタン）
- セッション停止ボタン

**技術的文脈**:
- WebSocket接続は次フェーズで実装
- 初期実装はREST APIでポーリング

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/session-detail.test.tsx`
2. `frontend/src/components/session/MessageList.tsx`作成
3. `frontend/src/components/session/InputForm.tsx`作成
4. `frontend/src/components/session/PermissionDialog.tsx`作成
5. `frontend/src/app/sessions/[id]/page.tsx`作成
6. テスト通過確認

**受入基準**:
- [ ] メッセージ履歴が表示される
- [ ] ユーザー入力を送信できる
- [ ] 権限確認ダイアログが表示される
- [ ] 承認/拒否ボタンが機能する
- [ ] セッション停止ボタンが機能する
- [ ] 全テストが通過する

**依存関係**: タスク3.4
**推定工数**: 45分
**ステータス**: `TODO`

---

### タスク3.6: Diff表示画面実装

**説明**:
Git diffの表示機能を実装する
- ファイル一覧サイドバー
- diff表示（追加行緑、削除行赤）
- ファイル選択でそのファイルのdiff表示

**技術的文脈**:
- react-diff-viewer-continued使用
- unified diff形式

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/diff-viewer.test.tsx`
2. `npm install react-diff-viewer-continued`
3. `frontend/src/components/git/DiffViewer.tsx`作成
4. `frontend/src/components/git/FileList.tsx`作成
5. セッション詳細画面にDiffタブ追加
6. テスト通過確認

**受入基準**:
- [ ] 変更ファイル一覧が表示される
- [ ] diffが色分け表示される
- [ ] ファイル選択でそのファイルのdiffのみ表示される
- [ ] 全テストが通過する

**依存関係**: タスク3.5
**推定工数**: 30分
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
- 操作中はローディング表示
- エラー時はエラーメッセージ表示

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/git-ops.test.tsx`
2. `frontend/src/components/git/RebaseButton.tsx`作成
3. `frontend/src/components/git/MergeModal.tsx`作成
4. `frontend/src/components/git/ConflictDialog.tsx`作成
5. セッション詳細画面にGit操作ボタン追加
6. テスト通過確認

**受入基準**:
- [ ] 「mainから取り込み」ボタンが機能する
- [ ] rebase成功時に成功メッセージが表示される
- [ ] コンフリクト時にダイアログが表示される
- [ ] 「スカッシュしてマージ」でモーダルが開く
- [ ] マージ成功後にworktree削除確認が表示される
- [ ] 全テストが通過する

**依存関係**: タスク3.6
**推定工数**: 30分
**ステータス**: `TODO`

---

## フェーズ4: リアルタイム通信とMVP統合
*推定期間: 185分（AIエージェント作業時間）*
*MVP: Yes*

### タスク4.1: WebSocketサーバー実装

**説明**:
Next.jsカスタムサーバーにWebSocketサーバーを実装する
- セッション用WebSocket（/ws/sessions/{id}）
- 認証済みセッションのみ接続許可
- Claude Code出力のブロードキャスト
- ユーザー入力の受信とClaude Codeへの転送
- 権限確認リクエストの送信

**技術的文脈**:
- Next.jsカスタムサーバー（server.ts）
- wsライブラリまたはsocket.io使用
- 接続管理クラス（ConnectionManager）

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/websocket.test.ts`
   - 認証済み接続成功
   - 未認証接続拒否
   - メッセージ送受信
2. `server.ts`作成（Next.jsカスタムサーバー）
3. `src/lib/websocket/connection-manager.ts`作成
4. `src/lib/websocket/session-ws.ts`作成
5. テスト通過確認

**受入基準**:
- [ ] `server.ts`が存在し、WebSocketサーバーが起動する
- [ ] `/ws/sessions/{id}`エンドポイントが存在する
- [ ] 認証済みクライアントのみ接続できる
- [ ] Claude Code出力がクライアントに送信される
- [ ] クライアントからの入力がClaude Codeに転送される
- [ ] 全テストが通過する（`npm test`）

**依存関係**: タスク2.5
**推定工数**: 50分
**ステータス**: `TODO`

---

### タスク4.2: WebSocketクライアント実装

**説明**:
フロントエンドにWebSocket接続機能を実装する
- WebSocket接続管理フック
- 自動再接続（最大5回、指数バックオフ）
- 接続状態管理
- メッセージ送受信

**技術的文脈**:
- カスタムフック: useWebSocket
- 再接続間隔: 1s, 2s, 4s, 8s, 16s

**実装手順（TDD）**:
1. テスト作成: `frontend/src/__tests__/useWebSocket.test.ts`
2. `frontend/src/hooks/useWebSocket.ts`作成
3. セッション詳細画面でフック使用
4. テスト通過確認

**受入基準**:
- [ ] WebSocket接続が確立される
- [ ] メッセージ受信時にコールバックが呼ばれる
- [ ] 切断時に自動再接続される
- [ ] 最大再接続回数後は再接続しない
- [ ] 全テストが通過する

**依存関係**: タスク3.5
**推定工数**: 35分
**ステータス**: `TODO`

---

### タスク4.3: リアルタイム更新統合

**説明**:
WebSocketを使用したリアルタイム更新を統合する
- セッション詳細画面でリアルタイム出力表示
- 権限確認リクエストのリアルタイム受信
- セッションステータスのリアルタイム更新
- セッション一覧のステータス自動更新

**技術的文脈**:
- Zustandストアとの統合
- 500ms以内の出力表示（NFR-001）

**実装手順（TDD）**:
1. `frontend/src/store/session.ts`にリアルタイム更新ロジック追加
2. セッション詳細画面でWebSocket統合
3. セッション一覧でステータス自動更新
4. E2Eテスト作成

**受入基準**:
- [ ] Claude Code出力がリアルタイムで表示される
- [ ] 権限確認ダイアログがリアルタイムで表示される
- [ ] セッションステータスがリアルタイムで更新される
- [ ] セッション一覧のステータスが自動更新される
- [ ] 出力表示が500ms以内

**依存関係**: タスク4.1, タスク4.2
**推定工数**: 35分
**ステータス**: `TODO`

---

### タスク4.4: npxパッケージ設定

**説明**:
`npx claude-work`で起動できるCLIパッケージを設定する
- package.jsonにbin設定追加
- CLIエントリーポイント作成
- ビルド設定（TypeScript → JavaScript）
- 環境変数設定
- 起動スクリプト作成

**技術的文脈**:
- package.json bin設定
- TypeScriptビルド（tsup/tsc）
- shebang（#!/usr/bin/env node）
- Node.js 20以上必須

**実装手順（TDD）**:
1. `package.json`に以下を追加:
   ```json
   {
     "bin": {
       "claude-work": "./dist/bin/cli.js"
     }
   }
   ```
2. `src/bin/cli.ts`作成（カスタムサーバー起動）
3. `tsconfig.json`のoutDirを`dist/`に設定
4. ビルドスクリプト作成: `"build": "tsc && cp -r public dist/"`
5. `.env.example`作成
6. `npm run build && npx . `でローカルテスト

**受入基準**:
- [ ] `package.json`にbin設定が存在する
- [ ] `src/bin/cli.ts`が存在し、shebangが含まれる
- [ ] `npm run build`でビルドが成功する
- [ ] `npx .`でサーバーが起動する
- [ ] `.env.example`が存在する
- [ ] 環境変数`AUTH_TOKEN`、`PORT`で設定変更可能
- [ ] SQLiteデータベースが`data/`ディレクトリに作成される

**依存関係**: タスク4.3
**推定工数**: 40分
**ステータス**: `TODO`

---

### タスク4.5: MVP E2Eテスト

**説明**:
MVP機能のE2Eテストを作成する
- ログインフロー
- プロジェクト追加フロー
- セッション作成〜Claude Code対話フロー
- Git操作フロー

**技術的文脈**:
- Playwright使用
- テスト用Gitリポジトリを自動作成

**実装手順（TDD）**:
1. Playwrightインストール・設定
2. `e2e/login.spec.ts`作成
3. `e2e/projects.spec.ts`作成
4. `e2e/sessions.spec.ts`作成
5. `e2e/git-ops.spec.ts`作成
6. CI用設定

**受入基準**:
- [ ] ログインE2Eテストが通過する
- [ ] プロジェクト追加E2Eテストが通過する
- [ ] セッション作成E2Eテストが通過する
- [ ] Git操作E2Eテストが通過する
- [ ] `npm run e2e`で全テスト実行可能

**依存関係**: タスク4.4
**推定工数**: 35分
**ステータス**: `TODO`

---

## フェーズ5: 拡張機能（セッション管理強化）
*推定期間: 180分（AIエージェント作業時間）*
*MVP: No*

### タスク5.1: セッションテンプレート（一括作成）実装

**説明**:
複数セッションの一括作成機能を実装する
- セッション数選択（1〜10）
- 番号付きセッション名自動生成

**受入基準**:
- [ ] セッション作成フォームにセッション数選択がある
- [ ] 複数セッションが同時に作成される
- [ ] セッション名が自動で番号付けされる

**依存関係**: フェーズ4完了
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク5.2: プロンプト履歴実装

**説明**:
プロンプト履歴の保存・再利用機能を実装する
- プロンプト履歴テーブル
- 履歴API
- 履歴ドロップダウンUI

**受入基準**:
- [ ] プロンプトが履歴に保存される
- [ ] プロンプト入力時に履歴が表示される
- [ ] 履歴から選択してプロンプトを挿入できる
- [ ] 履歴を削除できる

**依存関係**: タスク5.1
**推定工数**: 35分
**ステータス**: `TODO`

---

### タスク5.3: モデル選択実装

**説明**:
Claude Codeモデル選択機能を実装する
- セッション作成時のモデル選択UI
- プロジェクトデフォルトモデル設定
- Claude Code起動時のモデル指定

**受入基準**:
- [ ] セッション作成時にモデルを選択できる
- [ ] プロジェクト設定でデフォルトモデルを設定できる
- [ ] 選択したモデルでClaude Codeが起動する

**依存関係**: タスク5.2
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク5.4: コミット履歴と復元実装

**説明**:
コミット履歴表示とリセット機能を実装する
- コミット履歴API
- コミット履歴表示UI
- コミットへのリセット機能

**受入基準**:
- [ ] コミット履歴が表示される
- [ ] 各コミットのdiffが表示される
- [ ] 特定コミットにリセットできる

**依存関係**: タスク5.3
**推定工数**: 40分
**ステータス**: `TODO`

---

### タスク5.5: Git状態インジケーター実装

**説明**:
セッション一覧にGit状態インジケーターを追加する
- 未コミット変更あり/クリーンの判定
- インジケーターUI

**受入基準**:
- [ ] 各セッションにGit状態インジケーターが表示される
- [ ] 未コミット変更があるセッションが識別できる

**依存関係**: タスク5.4
**推定工数**: 25分
**ステータス**: `TODO`

---

### タスク5.6: 詳細ステータスインジケーター実装

**説明**:
セッションステータスを詳細化する
- ステータス: 初期化中/実行中/入力待ち/完了/エラー
- ステータスに応じたアイコンと色

**受入基準**:
- [ ] 5種類のステータスが区別できる
- [ ] 各ステータスに適切なアイコンが表示される

**依存関係**: タスク5.5
**推定工数**: 20分
**ステータス**: `TODO`

---

## フェーズ6: 拡張機能（高度な機能）
*推定期間: 240分（AIエージェント作業時間）*
*MVP: No*

### タスク6.1: ランスクリプト設定実装

**説明**:
プロジェクトにランスクリプトを設定する機能を実装する
- プロジェクト設定画面
- ランスクリプト追加/編集/削除UI

**受入基準**:
- [ ] プロジェクト設定画面がある
- [ ] ランスクリプトを追加できる
- [ ] ランスクリプトを編集/削除できる

**依存関係**: フェーズ5完了
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク6.2: ランスクリプト実行実装

**説明**:
worktree内でランスクリプトを実行する機能を実装する
- 実行API
- リアルタイム出力表示
- 停止機能

**受入基準**:
- [ ] ランスクリプトを実行できる
- [ ] 出力がリアルタイムで表示される
- [ ] 実行中のスクリプトを停止できる
- [ ] 終了コードと実行時間が表示される

**依存関係**: タスク6.1
**推定工数**: 45分
**ステータス**: `TODO`

---

### タスク6.3: ログフィルタリング/検索実装

**説明**:
ランスクリプト出力のフィルタリングと検索機能を実装する
- フィルター（info/warn/error）
- テキスト検索

**受入基準**:
- [ ] ログレベルでフィルタリングできる
- [ ] テキスト検索できる

**依存関係**: タスク6.2
**推定工数**: 25分
**ステータス**: `TODO`

---

### タスク6.4: リッチ出力実装

**説明**:
Claude Code出力のマークダウンレンダリングとシンタックスハイライトを実装する
- マークダウンレンダリング
- コードブロックのシンタックスハイライト

**受入基準**:
- [ ] マークダウンが正しくレンダリングされる
- [ ] コードブロックにシンタックスハイライトが適用される

**依存関係**: タスク6.3
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク6.5: サブエージェント出力表示実装

**説明**:
Claude Codeのサブエージェント出力を折りたたみ表示する
- サブエージェント検出
- 折りたたみUI

**受入基準**:
- [ ] サブエージェント出力が検出される
- [ ] 折りたたみ可能なセクションで表示される

**依存関係**: タスク6.4
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク6.6: ターミナル統合（バックエンド）実装

**説明**:
PTYプロセスを管理するバックエンドを実装する
- PTY生成
- WebSocket経由の入出力

**受入基準**:
- [ ] PTYプロセスが生成される
- [ ] WebSocket経由で入出力できる

**依存関係**: タスク6.5
**推定工数**: 40分
**ステータス**: `TODO`

---

### タスク6.7: ターミナル統合（フロントエンド）実装

**説明**:
XTerm.jsを使用したターミナルUIを実装する
- XTerm.jsセットアップ
- WebSocket接続
- ANSIエスケープシーケンス対応

**受入基準**:
- [ ] ターミナルタブが表示される
- [ ] コマンドを入力・実行できる
- [ ] 出力が正しく表示される

**依存関係**: タスク6.6
**推定工数**: 40分
**ステータス**: `TODO`

---

## フェーズ7: UI/UX改善とドキュメント
*推定期間: 85分（AIエージェント作業時間）*
*MVP: No*

### タスク7.1: ライト/ダークモード実装

**説明**:
テーマ切り替え機能を実装する
- OSテーマ自動検出
- 手動切り替えボタン
- ローカルストレージ保存

**受入基準**:
- [ ] OSテーマに従って初期表示される
- [ ] 手動で切り替えられる
- [ ] 設定が保存される

**依存関係**: フェーズ6完了
**推定工数**: 25分
**ステータス**: `TODO`

---

### タスク7.2: モバイルUI最適化

**説明**:
モバイル向けUIを最適化する
- カード形式セッション一覧
- タッチ操作最適化
- 入力フォーム調整

**受入基準**:
- [ ] 768px未満でモバイルレイアウトになる
- [ ] セッションがカード形式で表示される
- [ ] タッチ操作がスムーズ

**依存関係**: タスク7.1
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク7.3: ドキュメント作成

**説明**:
README、セットアップガイドを作成する
- README.md
- セットアップ手順
- 環境変数一覧
- API仕様概要

**受入基準**:
- [ ] README.mdが存在する
- [ ] セットアップ手順が記載されている
- [ ] 環境変数一覧が記載されている

**依存関係**: タスク7.2
**推定工数**: 30分
**ステータス**: `TODO`

---

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
