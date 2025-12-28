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

## 完了済みフェーズ一覧

以下のフェーズは完了済みです。詳細は各検証レポートを参照してください。

| フェーズ | 内容 | 検証レポート |
|---------|------|-------------|
| Phase 1-4 | MVP基盤構築（Next.js、認証、WebSocket） | - |
| Phase 5-7 | 拡張機能（セッション管理、ターミナル、UI/UX） | - |
| Phase 8-10 | バグ修正（PR#2対応、マージ後修正） | - |
| Phase 19-20 | Critical Issue修正、SSRエラー修正 | verification-report-phase19.md |
| Phase 21 | UI/UX改善（ロゴナビゲーション） | verification-report-comprehensive-phase21.md |
| Phase 22 | Claude CLI自動検出機能 | - |
| Phase 31 | セッション再起動機能 | verification-report-phase31.md |
| Phase 33 | プロセス再起動・Diff表示修正 | verification-report-phase33.md |
| Phase 35 | 網羅的検証で発見された不具合修正 | verification-report-phase35.md |
| Phase 40 | プロセスライフサイクル管理 | - |

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

---

## セキュリティ・品質改善タスク

以下はCodeRabbitレビュー（#3574391877）で指摘された技術的負債・改善項目です。
優先度に応じて別PRで対応してください。

### タスク: パストラバーサル対策の強化
**優先度**: 高
**ファイル**: `src/app/api/projects/route.ts` (124-145行)

**問題**:
現在は`resolve()`で絶対パス化しているが、許可ベースディレクトリの検証がない。
任意のディレクトリをプロジェクトとして登録できる状態。

**実装内容**:
1. 環境変数`ALLOWED_PROJECT_BASE_DIRS`を追加（カンマ区切り）
2. リクエストされたパスが許可ディレクトリ配下にあることを検証
3. 許可外のパスの場合は403エラーを返す

**受入基準**:
- 許可ディレクトリ外のパスでプロジェクト作成を試みると403エラー
- 許可ディレクトリ内のパスでは正常に作成できる
- テストケースを追加

### タスク: Git操作の非同期化とタイムアウト設定
**優先度**: 中
**ファイル**: `src/app/api/projects/route.ts` (127-136行), `src/services/git-service.ts`

**問題**:
`spawnSync`はイベントループをブロックし、大規模リポジトリで応答が遅延する。

**実装内容**:
1. GitServiceの全メソッドを非同期化（`spawn` + Promise化）
2. タイムアウト設定を追加（デフォルト30秒、環境変数で調整可能）
3. API Routeを`async/await`に対応

**受入基準**:
- 全てのGit操作がノンブロッキングで実行される
- タイムアウト時にエラーが返される
- 既存テストが全て通る

### タスク: プロジェクト所有権チェックの実装
**優先度**: 高
**ファイル**: `src/app/api/projects/[project_id]/route.ts` (53-60, 132-138行)

**問題**:
認証済みユーザーなら誰でも全てのプロジェクトを更新・削除できる。
マルチユーザー環境でセキュリティリスク。

**実装内容**:
1. Prismaスキーマで`Project`モデルに`owner_id`フィールドを追加
2. `AuthSession`と`Project`の関連を定義
3. PUT/DELETEハンドラーで所有権チェックを実装（所有者のみ許可）
4. プロジェクト作成時に`owner_id`を自動設定

**受入基準**:
- 他人のプロジェクトを更新/削除しようとすると403エラー
- 自分のプロジェクトは正常に更新/削除できる
- GET /api/projectsは自分のプロジェクトのみ返す
- テストケースを追加

### タスク: ログ出力の機密情報対策
**優先度**: 低
**ファイル**: `src/app/api/sessions/[id]/merge/route.ts` (103-109行)

**問題**:
`commitMessage`全体をログ出力しており、意図せず機密情報が含まれる可能性。

**実装内容**:
1. ログ出力時にcommitMessageを先頭80文字に制限
2. 全体の文字数も記録（デバッグ用）

**受入基準**:
- ログに出力されるcommitMessageが80文字以内
- 文字数情報が記録される

---

## 未完了フェーズ詳細

## Phase 23: Critical Issues修正（動作検証で発見）

**目的**: 動作検証で発見された2件のCritical不具合を修正し、アプリケーションの基本機能を回復する。

**背景**: 2025-12-21の動作検証で、ログイン機能とセッション認証が完全に動作しない2つのCritical不具合が発見された。これらはアプリケーション全体の使用を阻害するため、最優先で修正が必要。

**検証レポート**: `docs/verification-issues.md`

---

#### タスク23.1: 環境変数ロード問題の調査と修正（Issue #1）

**説明**:
ログイン機能が動作しない問題を修正する。`process.env.CLAUDE_WORK_TOKEN`が正しくロードされていないため、正しいトークンでもログインが失敗する。

**調査内容**:
1. `.env`ファイルには`CLAUDE_WORK_TOKEN=your-secure-token-here`が設定されている
2. `server.ts:1`で`import 'dotenv/config'`が実行されているが、環境変数が読み込まれていない
3. `src/lib/auth.ts:51-56`の`validateToken`関数で`process.env.CLAUDE_WORK_TOKEN`が`undefined`になっている可能性

**実装手順（調査→修正）**:
1. server.ts起動時に環境変数ロード状況をログ出力
2. dotenv/configのロードタイミングを確認
3. 必要に応じてdotenv.config()を明示的に呼び出し
4. ecosystem.config.jsのenv設定との競合を確認
5. 環境変数が正しくロードされることを確認
6. ログインテストを実施（E2Eまたは手動）

**受入基準**:
- [ ] server.ts起動時に`CLAUDE_WORK_TOKEN`がログ出力される（最初の4文字のみ表示）
- [ ] `.env`ファイルの`CLAUDE_WORK_TOKEN`が`process.env.CLAUDE_WORK_TOKEN`として読み込まれる
- [ ] ログインページで正しいトークン`your-secure-token-here`を入力してログイン成功する
- [ ] ログイン成功後、プロジェクト一覧ページにリダイレクトされる
- [ ] サーバーログに`Login attempt with invalid token`が出力されない
- [ ] 環境変数ロード確認のログが追加されている
- [ ] コミットが存在する

**依存関係**: なし（最優先タスク）

**推定工数**: 30分（AIエージェント作業時間）
- 調査・ログ追加: 15分
- 修正・検証: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: server.ts, src/lib/auth.ts
- 環境変数名: CLAUDE_WORK_TOKEN
- .envファイルの設定値: your-secure-token-here
- 既存のインポート: import 'dotenv/config' (server.ts:1)
- エラー現象: validateToken関数でprocess.env.CLAUDE_WORK_TOKENがundefinedになっている

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

#### タスク23.2: Prismaクライアントの再生成とAuthSession取得問題の修正（Issue #2）

**説明**:
セッション認証が機能しない問題を修正する。`prisma.authSession.findUnique()`がnullを返すが、データベースにはデータが存在する。Prismaクライアントとスキーマの不一致が原因と推定。

**調査内容**:
1. データベースに有効なセッションが存在する（ID: `50659c5c-bf82-4b1f-be63-59f5bfd28a93`）
2. `prisma.authSession.findUnique({ where: { id: '...' } })`がnullを返す
3. `prisma/schema.prisma`のAuthSessionモデル定義は正しい
4. Prismaクライアントが古い可能性、またはDATABASE_URLの不一致

**実装手順（修正→検証）**:
1. `npx prisma generate`を実行してPrismaクライアントを再生成
2. `npx prisma db push`でスキーマをデータベースに反映（念のため）
3. DATABASE_URL環境変数が正しいデータベースファイルを指していることを確認
4. サーバーを再起動
5. テストセッションを作成（または既存セッションを使用）
6. `/api/auth/session`エンドポイントにGETリクエスト
7. `{"authenticated": true}`が返されることを確認

**受入基準**:
- [ ] `npx prisma generate`が正常に完了する
- [ ] `prisma.authSession.findUnique()`がデータベースの既存セッションを取得できる
- [ ] 有効なセッションCookieを持つリクエストで`/api/auth/session`が`{"authenticated": true}`を返す
- [ ] AuthGuardコンポーネントが認証済みユーザーをプロジェクト一覧ページに通す
- [ ] ログイン後、プロジェクト一覧ページが正常に表示される
- [ ] サーバーログにPrismaクエリエラーが出力されない
- [ ] DATABASE_URL設定が確認されている
- [ ] コミットが存在する

**依存関係**: タスク23.1（ログイン機能修正）- ログインできないとセッション作成もできないため

**推定工数**: 30分（AIエージェント作業時間）
- Prisma再生成・検証: 15分
- セッション認証テスト: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象モデル: AuthSession (prisma/schema.prisma:51-56)
- データベースファイル: prisma/data/claudework.db
- 既存のセッションID: 50659c5c-bf82-4b1f-be63-59f5bfd28a93
- 問題のAPI: src/app/api/auth/session/route.ts:47
- 問題の関数: src/lib/auth.ts:68-82 (getSession)

**不明/要確認の情報**: なし

---

### Phase 23完了基準

- [ ] タスク23.1が完了している（環境変数ロード修正）
- [ ] タスク23.2が完了している（Prismaクライアント修正）
- [ ] ログインページで正しいトークンを入力してログイン成功する
- [ ] ログイン後、プロジェクト一覧ページが表示される
- [ ] セッションCookieが正しく機能し、認証状態が維持される
- [ ] `/api/auth/session`が認証済みユーザーに対して`{"authenticated": true}`を返す
- [ ] すべてのコミットが作成されている
- [ ] 動作検証チェックリスト（docs/verification-checklist.md）のログイン関連項目がパスする

### 解決される不具合

**docs/verification-issues.md**:
- Issue #1: ログイン機能が動作しない（Critical）- 環境変数ロード問題
- Issue #2: セッション認証が機能しない（Critical）- Prismaクエリ問題

**docs/requirements.md**:
- REQ-055: ユーザーがログインページにアクセスした時、システムは認証トークン入力フォームを表示しなければならない
- REQ-056: ユーザーが正しいトークンを入力した時、システムはセッションを開始しプロジェクト一覧ページにリダイレクトしなければならない
- REQ-057: セッションの有効期限が切れた時、システムはユーザーをログインページにリダイレクトしなければならない

### 技術的な学び

- dotenv環境変数ロードのタイミングとトラブルシューティング
- Prismaクライアント生成とスキーマ同期の重要性
- iron-sessionとCookie認証のデバッグ方法
- PM2環境変数設定との競合解決

---


## Phase 24: High Priority UIコンポーネント実装（動作検証で発見）

**目的**: テストファイルのみ存在し実装が欠落している3つのUIコンポーネントと、ランスクリプトログUIを実装する。

**背景**: 動作検証で、テスト仕様は存在するが実装ファイルが欠落しているコンポーネント（GitStatusBadge、PromptHistoryDropdown、CommitHistory）が発見された。また、ランスクリプトログ表示UIも未実装。これらはユーザー体験に大きく影響するHigh Priority機能。

**検証レポート**: `docs/verification-issues.md`

---

#### タスク24.1: GitStatusBadge.tsxの実装（Issue #3）

**説明**:
TDDで`src/components/sessions/GitStatusBadge.tsx`を実装する。テスト仕様は既に存在する（`src/components/sessions/__tests__/GitStatusBadge.test.tsx`）ため、テストファーストで実装を進める。

**実装手順（TDD）**:
1. テスト確認: `src/components/sessions/__tests__/GitStatusBadge.test.tsx`の内容を確認
2. テスト実行: `npm test -- GitStatusBadge.test.tsx`を実行し、失敗を確認
3. 実装: `src/components/sessions/GitStatusBadge.tsx`を実装
   - Props: `isDirty: boolean`を受け取る
   - isDirty=trueの場合: 「変更あり」バッジ（黄色/オレンジ系）
   - isDirty=falseの場合: 「クリーン」バッジ（緑系）
   - Tailwind CSSでスタイリング
4. テスト通過: すべてのテストが通過するまで実装を調整
5. 統合: SessionCard.tsxにGitStatusBadgeを追加
6. 動作確認: セッション一覧でGit状態が視覚的に表示されることを確認

**受入基準**:
- [ ] `src/components/sessions/GitStatusBadge.tsx`ファイルが作成されている
- [ ] GitStatusBadgeコンポーネントがprops `isDirty: boolean`を受け取る
- [ ] isDirty=trueで「変更あり」バッジが表示される
- [ ] isDirty=falseで「クリーン」バッジが表示される
- [ ] Tailwind CSSでレスポンシブ対応されている
- [ ] `src/components/sessions/__tests__/GitStatusBadge.test.tsx`のすべてのテストが通過する
- [ ] SessionCard.tsxにGitStatusBadgeが統合されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）- UI表示をテストするには認証が必要

**推定工数**: 30分（AIエージェント作業時間）
- テスト確認・実装: 20分
- 統合・動作確認: 10分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/GitStatusBadge.tsx（新規作成）
- テストファイル: src/components/sessions/__tests__/GitStatusBadge.test.tsx（既存）
- 統合先: src/components/sessions/SessionCard.tsx
- スタイリング: Tailwind CSS
- 表示内容: isDirtyに応じて「変更あり」/「クリーン」

**不明/要確認の情報**: なし（テスト仕様から実装詳細を取得）

---

#### タスク24.2: PromptHistoryDropdown.tsxの実装（Issue #4）

**説明**:
TDDで`src/components/sessions/PromptHistoryDropdown.tsx`を実装する。テスト仕様は既に存在し、プロンプト履歴API（`src/app/api/prompts/route.ts`）も実装済み。

**実装手順（TDD）**:
1. テスト確認: `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx`の内容を確認
2. API確認: `/api/prompts` GET エンドポイントの仕様を確認
3. テスト実行: `npm test -- PromptHistoryDropdown.test.tsx`を実行し、失敗を確認
4. 実装: `src/components/sessions/PromptHistoryDropdown.tsx`を実装
   - `/api/prompts`からプロンプト履歴を取得
   - ドロップダウンメニュー表示（Headless UI Menuコンポーネント使用）
   - 履歴選択時、親コンポーネントにプロンプトテキストを渡すコールバック
   - ローディング状態とエラーハンドリング
5. テスト通過: すべてのテストが通過するまで実装を調整
6. 統合: CreateSessionForm.tsxのプロンプト入力欄に統合
7. 動作確認: 新規セッション作成時に履歴ドロップダウンが機能することを確認

**受入基準**:
- [ ] `src/components/sessions/PromptHistoryDropdown.tsx`ファイルが作成されている
- [ ] GET `/api/prompts`からプロンプト履歴を取得する
- [ ] Headless UI Menuコンポーネントでドロップダウンを実装
- [ ] 履歴選択時、onSelect(promptText)コールバックが呼ばれる
- [ ] ローディング状態が表示される
- [ ] エラー発生時、適切なメッセージが表示される
- [ ] `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx`のすべてのテストが通過する
- [ ] CreateSessionForm.tsxに統合されている
- [ ] プロンプト入力欄の近くにドロップダウントリガーボタンが配置されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 40分（AIエージェント作業時間）
- テスト確認・実装: 25分
- 統合・動作確認: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/PromptHistoryDropdown.tsx（新規作成）
- テストファイル: src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx（既存）
- 統合先: src/components/sessions/CreateSessionForm.tsx
- API: GET /api/prompts（実装済み: src/app/api/prompts/route.ts）
- UIライブラリ: Headless UI Menu

**不明/要確認の情報**: なし（テスト仕様とAPI仕様から実装詳細を取得）

---

#### タスク24.3: CommitHistory.tsxの実装（Issue #5）

**説明**:
TDDで`src/components/git/CommitHistory.tsx`を実装する。テスト仕様は既に存在し、コミット取得API（GET `/api/sessions/:id/commits`）とリセットAPI（POST `/api/sessions/:id/reset`）も実装済み。

**実装手順（TDD）**:
1. テスト確認: `src/components/git/__tests__/CommitHistory.test.tsx`の内容を確認
2. API確認: `/api/sessions/:id/commits`と`/api/sessions/:id/reset`の仕様を確認
3. テスト実行: `npm test -- CommitHistory.test.tsx`を実行し、失敗を確認
4. 実装: `src/components/git/CommitHistory.tsx`を実装
   - GET `/api/sessions/:id/commits`からコミット履歴を取得
   - コミット一覧を時系列で表示（ハッシュ、メッセージ、日時、変更ファイル数）
   - コミット選択時、diff表示エリアを更新
   - 「このコミットに戻る」ボタンと確認ダイアログ
   - POST `/api/sessions/:id/reset`でリセット実行
5. テスト通過: すべてのテストが通過するまで実装を調整
6. 統合: セッション詳細ページ（`src/app/sessions/[id]/page.tsx`）に「Commits」タブを追加
7. 動作確認: コミット履歴の閲覧とリセット機能が動作することを確認

**受入基準**:
- [ ] `src/components/git/CommitHistory.tsx`ファイルが作成されている
- [ ] GET `/api/sessions/:id/commits`からコミット履歴を取得する
- [ ] コミット一覧が時系列で表示される（ハッシュ、メッセージ、日時、変更ファイル数）
- [ ] コミット選択時、diff表示エリアが更新される
- [ ] 「このコミットに戻る」ボタンをクリックで確認ダイアログが表示される
- [ ] ダイアログで確認後、POST `/api/sessions/:id/reset`が呼ばれる
- [ ] リセット成功時、コミット履歴が再読み込みされる
- [ ] `src/components/git/__tests__/CommitHistory.test.tsx`のすべてのテストが通過する
- [ ] セッション詳細ページに「Commits」タブが追加されている
- [ ] タブ切り替えでCommitHistoryコンポーネントが表示される
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 50分（AIエージェント作業時間）
- テスト確認・実装: 30分
- 統合・動作確認: 20分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/git/CommitHistory.tsx（新規作成）
- テストファイル: src/components/git/__tests__/CommitHistory.test.tsx（既存）
- 統合先: src/app/sessions/[id]/page.tsx（新タブ追加）
- API: GET /api/sessions/:id/commits, POST /api/sessions/:id/reset（実装済み）
- 表示内容: ハッシュ、メッセージ、日時、変更ファイル数

**不明/要確認の情報**: なし（テスト仕様とAPI仕様から実装詳細を取得）

---

#### タスク24.4: ランスクリプトログ表示UIの実装（Issue #6）

**説明**:
セッション詳細ページに「Scripts」タブを追加し、ランスクリプト実行時のログをリアルタイムで表示するUIを実装する。バックエンド（RunScriptManager）は実装済みのため、WebSocket経由でログイベントを受信する。

**実装手順（実装→テスト）**:
1. WebSocket拡張: SessionWebSocketHandlerにランスクリプトログイベントの転送を追加
   - RunScriptManagerの`log`イベントをリスニング
   - WebSocket経由でクライアントに`run_script_log`メッセージを送信
2. コンポーネント作成: `src/components/scripts/ScriptLogViewer.tsx`を作成
   - ログ一覧表示（時刻、ログレベル、メッセージ）
   - ログレベルフィルター（info/warn/error）- REQ-035
   - テキスト検索機能 - REQ-036
   - 終了コードと実行時間の表示 - REQ-037（Issue #8とも関連）
   - 自動スクロール（最新ログへ）
3. 統合: セッション詳細ページに「Scripts」タブを追加
   - ランスクリプト一覧表示（RunScriptList使用）
   - 実行ボタン、停止ボタン
   - ScriptLogViewerでログ表示
4. テスト作成: `src/components/scripts/__tests__/ScriptLogViewer.test.tsx`
5. 動作確認: ランスクリプト実行時、ログがリアルタイムで表示されることを確認

**受入基準**:
- [ ] SessionWebSocketHandlerがRunScriptManagerのlogイベントを転送する
- [ ] `src/components/scripts/ScriptLogViewer.tsx`ファイルが作成されている
- [ ] ログ一覧が時刻、ログレベル、メッセージを含めて表示される
- [ ] ログレベルフィルター（info/warn/error）が機能する（REQ-035）
- [ ] テキスト検索機能が実装されている（REQ-036）
- [ ] ランスクリプト終了時、終了コードと実行時間が表示される（REQ-037）
- [ ] 自動スクロールで最新ログが常に表示される
- [ ] セッション詳細ページに「Scripts」タブが追加されている
- [ ] ランスクリプト一覧と実行/停止ボタンが表示される
- [ ] ランスクリプト実行中、ログがリアルタイムで表示される
- [ ] `src/components/scripts/__tests__/ScriptLogViewer.test.tsx`が作成され、すべてのテストが通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 60分（AIエージェント作業時間）
- WebSocket拡張: 15分
- ScriptLogViewer実装: 30分
- 統合・テスト・動作確認: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - src/components/scripts/ScriptLogViewer.tsx（新規作成）
  - src/lib/websocket/session-websocket-handler.ts（修正）
  - src/app/sessions/[id]/page.tsx（タブ追加）
- バックエンド: src/services/run-script-manager.ts（実装済み）
- 既存コンポーネント: src/components/settings/RunScriptList.tsx
- WebSocketメッセージタイプ: run_script_log（新規追加）
- 実装機能: ログ表示、フィルター、検索、終了コード/実行時間表示

**不明/要確認の情報**: なし

---

### Phase 24完了基準

- [ ] タスク24.1が完了している（GitStatusBadge実装）
- [ ] タスク24.2が完了している（PromptHistoryDropdown実装）
- [ ] タスク24.3が完了している（CommitHistory実装）
- [ ] タスク24.4が完了している（ランスクリプトログUI実装）
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] セッション一覧でGit状態インジケーターが表示される
- [ ] 新規セッション作成時、プロンプト履歴ドロップダウンが機能する
- [ ] セッション詳細ページ「Commits」タブでコミット履歴が閲覧できる
- [ ] セッション詳細ページ「Scripts」タブでランスクリプトログが表示される
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-issues.md**:
- Issue #3: Git状態インジケーターが未実装（High）
- Issue #4: プロンプト履歴ドロップダウンが未実装（High）
- Issue #5: コミット履歴UIが未実装（High）
- Issue #6: ランスクリプトログ表示UIが未実装（High）

**docs/requirements.md**:
- REQ-016: セッション一覧表示時、システムは各セッションのGit状態インジケーターを表示しなければならない
- REQ-018: プロンプト入力時、システムは過去のプロンプト履歴をドロップダウンで表示しなければならない
- REQ-019: ユーザーが履歴を選択した時、システムはプロンプト入力欄に挿入しなければならない
- REQ-034: ランスクリプト実行中、システムは出力をリアルタイムで専用ログタブに表示しなければならない
- REQ-035: ログタブ表示時、システムはログレベル（info/warn/error）でフィルターできる機能を提供しなければならない
- REQ-036: ログタブ表示時、システムはログをテキスト検索できる機能を提供しなければならない
- REQ-037: ランスクリプト終了時、システムは終了コードと実行時間を表示しなければならない
- REQ-039: セッション詳細ページのCommitsタブで、システムはworktree内のコミット履歴を時系列で表示しなければならない
- REQ-040: コミット履歴表示時、システムは各コミットのハッシュ、メッセージ、日時、変更ファイル数を表示しなければならない
- REQ-041: ユーザーがコミットを選択した時、システムは変更内容（diff）を表示しなければならない
- REQ-042: ユーザーが「このコミットに戻る」をクリックした時、システムは確認ダイアログを表示しなければならない

### 技術的な学び

- TDDでのReactコンポーネント実装
- テスト仕様から実装への変換プロセス
- WebSocketによるリアルタイムログ配信
- Headless UIによるアクセシブルなドロップダウン実装
- ログフィルタリングと検索のUXパターン

---


## Phase 25: Medium Priority機能改善（動作検証で発見）

**目的**: 部分的に実装されているが、UI表示やユーザー体験が不完全な2つの機能を改善する。

**背景**: サブエージェント出力の折りたたみ表示とランスクリプト終了コード表示は、データモデルやイベント発火は実装されているが、UI表示が未確認または不完全。

**検証レポート**: `docs/verification-issues.md`

---

#### タスク25.1: サブエージェント出力の折りたたみ表示確認と実装（Issue #7）

**説明**:
サブエージェント出力が折りたたみ可能なUIで表示されているか確認し、未実装の場合は実装する。データモデル（`src/store/index.ts:85-86`）には`sub_agents`フィールドが存在するため、MessageDisplayコンポーネントでの処理を確認・実装する。

**実装手順（調査→実装）**:
1. 調査: `src/components/sessions/MessageDisplay.tsx`でsub_agentsフィールドの処理を確認
2. テストデータ作成: sub_agentsを含むメッセージデータを用意
3. 表示確認: サブエージェント出力が折りたたみ表示されるか確認
4. 未実装の場合:
   - MessageDisplayにsub_agents表示ロジックを追加
   - Headless UI Disclosureコンポーネントで折りたたみUI実装
   - 各サブエージェントタスクの名前、ステータス、出力を表示
   - 展開/折りたたみアニメーション
5. テスト作成: `src/components/sessions/__tests__/MessageDisplay.test.tsx`にsub_agents表示テストを追加
6. 動作確認: セッション詳細ページでサブエージェント出力が適切に表示されることを確認

**受入基準**:
- [ ] MessageDisplay.tsxでsub_agentsフィールドを処理している
- [ ] サブエージェント出力が折りたたみ可能なUIで表示される
- [ ] 各サブエージェントタスクの名前、ステータス、出力が表示される
- [ ] Headless UI Disclosureで展開/折りたたみが実装されている
- [ ] デフォルトで折りたたまれている状態
- [ ] 展開/折りたたみアニメーションがスムーズ
- [ ] `src/components/sessions/__tests__/MessageDisplay.test.tsx`にテストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 40分（AIエージェント作業時間）
- 調査・確認: 15分
- 実装（必要な場合）: 20分
- テスト・動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/MessageDisplay.tsx
- データモデル: src/store/index.ts:85-86 (sub_agentsフィールド)
- UIライブラリ: Headless UI Disclosure
- 表示内容: サブエージェントタスクの名前、ステータス、出力

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

#### タスク25.2: ランスクリプト終了コードと実行時間の表示確認（Issue #8）

**説明**:
ランスクリプト終了時の終了コードと実行時間がUIに表示されているか確認し、未実装の場合は実装する。RunScriptManager（`src/services/run-script-manager.ts:191-198`）でイベント発火は実装済み。

**実装手順（調査→実装）**:
1. 調査: Phase 24.4で実装するScriptLogViewerでの終了コード/実行時間表示を確認
2. イベント確認: RunScriptManagerの`end`イベントのデータ構造を確認
3. 表示確認: ログUI下部または最終行に終了コード/実行時間が表示されるか確認
4. 未実装の場合:
   - ScriptLogViewerに終了情報表示エリアを追加
   - `run_script_end`イベントで終了コード（exitCode）と実行時間（duration）を取得
   - 成功時（exitCode=0）は緑、失敗時（exitCode≠0）は赤で表示
   - 実行時間をhh:mm:ss形式でフォーマット
5. テスト追加: ScriptLogViewer.test.tsxに終了情報表示テストを追加
6. 動作確認: ランスクリプト実行終了時、終了コードと実行時間が表示されることを確認

**受入基準**:
- [ ] ScriptLogViewerが`run_script_end`イベントを処理する
- [ ] ランスクリプト終了時、終了コードが表示される
- [ ] 終了コード0は緑、0以外は赤で表示される
- [ ] 実行時間がhh:mm:ss形式で表示される
- [ ] ログUI下部または最終行に終了情報エリアが配置されている
- [ ] `src/components/scripts/__tests__/ScriptLogViewer.test.tsx`に終了情報表示テストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク24.4（ランスクリプトログUI実装）- ScriptLogViewerが実装されている必要がある

**推定工数**: 30分（AIエージェント作業時間）
- 調査・確認: 10分
- 実装（必要な場合）: 15分
- テスト・動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/scripts/ScriptLogViewer.tsx（Phase 24.4で作成）
- イベント発火: src/services/run-script-manager.ts:191-198
- WebSocketイベント: run_script_end（新規追加が必要な場合）
- 表示内容: 終了コード（exitCode）、実行時間（duration）
- 表示形式: exitCode=0は緑、≠0は赤

**不明/要確認の情報**: なし

---

### Phase 25完了基準

- [ ] タスク25.1が完了している（サブエージェント表示確認・実装）
- [ ] タスク25.2が完了している（ランスクリプト終了コード表示確認）
- [ ] サブエージェント出力が折りたたみ可能なUIで表示される
- [ ] ランスクリプト終了時、終了コードと実行時間が表示される
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-issues.md**:
- Issue #7: サブエージェント出力の折りたたみ表示が部分実装（Medium）
- Issue #8: ランスクリプト終了コードと実行時間の表示が部分実装（Medium）

**docs/requirements.md**:
- REQ-024: Claude Code出力時、システムはサブエージェントタスクの出力を折りたたみ可能に表示しなければならない
- REQ-037: ランスクリプト終了時、システムは終了コードと実行時間を表示しなければならない（Phase 24.4でも対応）

### 技術的な学び

- データモデルとUI表示の整合性確認
- イベント駆動アーキテクチャでのUI更新
- Headless UI Disclosureによるアクセシブルな折りたたみUI
- 実行結果の視覚的フィードバック（色分け、フォーマット）

---


## Phase 30: E2Eテスト環境変数修正

### 概要

Phase 29の包括的UI検証で発見されたPlaywrightテストの環境変数不一致問題を修正します。

### 背景

検証レポート（docs/verification-report-phase29.md）で以下の問題が発見されました：

1. `playwright.config.ts`で`AUTH_TOKEN`を使用しているが、アプリは`CLAUDE_WORK_TOKEN`を期待
2. `e2e/login.spec.ts`も`AUTH_TOKEN`を参照している
3. これによりE2Eテストのログイン後リダイレクトが失敗する

### タスク一覧

| タスクID | タイトル | 依存関係 | 推定工数 | ステータス |
|----------|----------|----------|----------|------------|
| 30.1 | playwright.config.ts環境変数修正 | なし | 10分 | `TODO` |
| 30.2 | e2eテストファイルのトークン参照修正 | 30.1 | 15分 | `TODO` |

---

#### タスク30.1: playwright.config.ts環境変数修正

**説明**:
`playwright.config.ts`の環境変数設定で`AUTH_TOKEN`を`CLAUDE_WORK_TOKEN`に変更します。

**対象ファイル**: `playwright.config.ts`

**現在の実装**:
```typescript
env: {
  AUTH_TOKEN: process.env.AUTH_TOKEN || 'test-token',
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-key-for-e2e-testing-purposes-only',
  PORT: '3001',
},
```

**修正後**:
```typescript
env: {
  CLAUDE_WORK_TOKEN: process.env.CLAUDE_WORK_TOKEN || 'test-token',
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-key-for-e2e-testing-purposes-only',
  PORT: '3001',
},
```

**受入基準**:
- [ ] `playwright.config.ts`で`AUTH_TOKEN`が`CLAUDE_WORK_TOKEN`に変更されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 10分（AIエージェント作業時間）

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: playwright.config.ts
- 変更内容: AUTH_TOKEN → CLAUDE_WORK_TOKEN
- アプリケーションが期待する環境変数名: CLAUDE_WORK_TOKEN（.env, server.ts参照）

**不明/要確認の情報**: なし

---

#### タスク30.2: e2eテストファイルのトークン参照修正

**説明**:
E2Eテストファイル内の`AUTH_TOKEN`参照を`CLAUDE_WORK_TOKEN`に修正します。

**対象ファイル**:
- `e2e/login.spec.ts`
- その他`AUTH_TOKEN`を参照しているE2Eテストファイル

**現在の実装**（e2e/login.spec.ts）:
```typescript
const token = process.env.AUTH_TOKEN || 'test-token';
```

**修正後**:
```typescript
const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
```

**受入基準**:
- [ ] すべてのE2Eテストファイルで`AUTH_TOKEN`が`CLAUDE_WORK_TOKEN`に変更されている
- [ ] E2Eテストが正常に動作する（`npm run e2e`）
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク30.1（playwright.config.ts修正）が完了していること

**推定工数**: 15分（AIエージェント作業時間）
- ファイル検索: 5分
- 修正: 5分
- テスト実行確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 主要な対象ファイル: e2e/login.spec.ts
- 変更内容: process.env.AUTH_TOKEN → process.env.CLAUDE_WORK_TOKEN
- テスト実行コマンド: npm run e2e

**不明/要確認の情報**: なし

---

### Phase 30完了基準

- [ ] タスク30.1が完了している（playwright.config.ts修正）
- [ ] タスク30.2が完了している（E2Eテストファイル修正）
- [ ] E2Eテストが正常に実行できる
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-report-phase29.md**:
- Issue #1: Playwrightテスト環境変数不一致（Medium）
- Issue #2: e2e/login.spec.tsのトークン取得（Medium）

### 技術的な学び

- 環境変数の命名一貫性の重要性
- E2Eテスト設定とアプリケーション設定の整合性確認

---


## Phase 34: ブラウザ通知システム

**目的**: Claude Codeのイベント発生時にブラウザ通知を送信する機能を実装する

**対応要件**: REQ-084 〜 REQ-093

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- 状態管理: Zustand
- toast通知: react-hot-toast（既存）
- OS通知: Web Notifications API

---

### タスク34.1: 通知サービスの実装

**説明**:
`src/lib/notification-service.ts`にブラウザ通知の基盤を実装する

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/notification-service.test.ts`にテストケースを作成
   - 通知許可リクエストのテスト
   - イベント別通知設定の有効/無効テスト
   - タブのアクティブ/バックグラウンド状態でのルーティングテスト
   - ローカルストレージへの設定保存/読込テスト
2. テスト実行: すべてのテストが失敗することを確認
3. テストコミット: テストのみをコミット
4. 実装: `notification-service.ts`を実装してテストを通過させる
5. 実装コミット: すべてのテストが通過したらコミット

**ファイル構成**:
```text
src/lib/notification-service.ts
src/lib/__tests__/notification-service.test.ts
```

**実装詳細**:
```typescript
// src/lib/notification-service.ts
export type NotificationEventType = 'taskComplete' | 'permissionRequest' | 'error';

export interface NotificationSettings {
  onTaskComplete: boolean;
  onPermissionRequest: boolean;
  onError: boolean;
}

export interface NotificationEvent {
  type: NotificationEventType;
  sessionId: string;
  sessionName: string;
  message?: string;
}

const STORAGE_KEY = 'claudework:notification-settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  onTaskComplete: true,
  onPermissionRequest: true,
  onError: true,
};

export function getSettings(): NotificationSettings;
export function saveSettings(settings: NotificationSettings): void;
export function requestPermission(): Promise<NotificationPermission>;
export function sendNotification(event: NotificationEvent): void;
export function isTabActive(): boolean;

// ヘルパー関数の実装例
function getSettingKey(type: NotificationEventType): keyof NotificationSettings {
  switch (type) {
    case 'taskComplete': return 'onTaskComplete';
    case 'permissionRequest': return 'onPermissionRequest';
    case 'error': return 'onError';
  }
}

function getDefaultMessage(type: NotificationEventType): string {
  switch (type) {
    case 'taskComplete': return 'タスクが完了しました';
    case 'permissionRequest': return '権限確認が必要です';
    case 'error': return 'エラーが発生しました';
  }
}

function getTitle(event: NotificationEvent): string {
  switch (event.type) {
    case 'taskComplete': return `タスク完了: ${event.sessionName}`;
    case 'permissionRequest': return `アクション要求: ${event.sessionName}`;
    case 'error': return `エラー発生: ${event.sessionName}`;
  }
}

// sendNotification の通知ルーティングロジック
function sendNotification(event: NotificationEvent): void {
  const settings = getSettings();
  const settingKey = getSettingKey(event.type);  // 'onTaskComplete' | 'onPermissionRequest' | 'onError'
  if (!settings[settingKey]) return;

  const message = event.message || getDefaultMessage(event.type);
  const fullMessage = `${event.sessionName}: ${message}`;

  if (isTabActive()) {
    // タブがアクティブ → react-hot-toast で表示
    if (event.type === 'error') {
      toast.error(fullMessage);
    } else {
      toast.success(fullMessage);
    }
  } else {
    // タブがバックグラウンド → OS通知（Notification API）
    if (Notification.permission === 'granted') {
      const title = getTitle(event);  // 例: 'タスク完了: session-1'
      const body = event.message || getDefaultMessage(event.type);
      new Notification(title, { body, icon: '/icon.png', tag: `claudework-${event.sessionId}` });
    }
  }
}
```

**受入基準**:
- [ ] テストファイル`src/lib/__tests__/notification-service.test.ts`が存在する
- [ ] テストが8つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `src/lib/notification-service.ts`が実装されている
- [ ] `getSettings()`がローカルストレージから設定を読み込む
- [ ] `saveSettings()`が設定をローカルストレージに保存する
- [ ] `requestPermission()`がNotification.requestPermission()を呼び出す
- [ ] `sendNotification()`がタブ状態に応じてtoast/OS通知を送信する
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 45分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.2: 通知ストアの実装

**説明**:
`src/store/notification.ts`にZustandストアを実装する

**実装手順（TDD）**:
1. テスト作成: `src/store/__tests__/notification.test.ts`にテストケースを作成
2. テスト実行: すべてのテストが失敗することを確認
3. テストコミット: テストのみをコミット
4. 実装: `notification.ts`を実装してテストを通過させる
5. 実装コミット: すべてのテストが通過したらコミット

**ファイル構成**:
```text
src/store/notification.ts
src/store/__tests__/notification.test.ts
```

**実装詳細**:
```typescript
// src/store/notification.ts
import { create } from 'zustand';
import {
  NotificationSettings,
  getSettings,
  saveSettings,
  requestPermission as requestPermissionService,
} from '@/lib/notification-service';

interface NotificationState {
  permission: NotificationPermission;
  settings: NotificationSettings;
  requestPermission: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  initializeFromStorage: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  permission: typeof window !== 'undefined' ? Notification.permission : 'default',
  settings: getSettings(),
  requestPermission: async () => {
    const result = await requestPermissionService();
    set({ permission: result });
  },
  updateSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      saveSettings(updated);
      return { settings: updated };
    });
  },
  initializeFromStorage: () => {
    set({ settings: getSettings() });
  },
}));
```

**注意**: `initializeFromStorage()`の呼び出しについて:
- **呼び出し場所**: `src/components/common/NotificationSettings.tsx`
- **タイミング**: コンポーネントのマウント時に`useEffect`内で1回呼び出す
- **目的**: ローカルストレージから設定を読み込み、UIと同期する
- **補足**: ストアの初期化時（`getSettings()`）にも読み込むため、実際には冗長だが、
  他のタブでの設定変更を反映するためにマウント時にも呼び出す
```typescript
// NotificationSettings.tsx での呼び出し例
const { initializeFromStorage } = useNotificationStore();
useEffect(() => { initializeFromStorage(); }, [initializeFromStorage]);
```

**受入基準**:
- [ ] テストファイル`src/store/__tests__/notification.test.ts`が存在する
- [ ] テストが5つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `src/store/notification.ts`が実装されている
- [ ] `useNotificationStore`がエクスポートされている
- [ ] `requestPermission`アクションが許可状態を更新する
- [ ] `updateSettings`アクションが設定を更新しローカルストレージに保存する
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.1
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.3: WebSocketメッセージハンドラへの通知統合

**説明**:
`src/store/index.ts`の`handleWebSocketMessage`に通知トリガーを追加する

**実装手順**:
1. `src/store/index.ts`を修正
2. `status_change`メッセージで`completed`または`error`の場合に通知を送信
3. `permission_request`メッセージで通知を送信
4. 既存のテストを更新

**実装詳細**:
```typescript
// src/store/index.ts の handleWebSocketMessage 内に追加
import { sendNotification } from '@/lib/notification-service';

// status_change ハンドラ内
if (message.type === 'status_change') {
  if (message.status === 'completed') {
    sendNotification({
      type: 'taskComplete',
      sessionId: currentSession?.id || '',
      sessionName: currentSession?.name || '',
    });
  } else if (message.status === 'error') {
    sendNotification({
      type: 'error',
      sessionId: currentSession?.id || '',
      sessionName: currentSession?.name || '',
      message: 'プロセスがエラーで終了しました',
    });
  }
}

// permission_request ハンドラ内
if (message.type === 'permission_request') {
  sendNotification({
    type: 'permissionRequest',
    sessionId: currentSession?.id || '',
    sessionName: currentSession?.name || '',
    message: message.permission?.action,
  });
}
```

**受入基準**:
- [ ] `handleWebSocketMessage`が`status_change`で`completed`時に通知を送信する
- [ ] `handleWebSocketMessage`が`status_change`で`error`時に通知を送信する
- [ ] `handleWebSocketMessage`が`permission_request`時に通知を送信する
- [ ] 既存のテストが通過する
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.1, タスク34.2
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.4: 通知許可リクエストの自動実行

**説明**:
セッションページ初回アクセス時に通知許可をリクエストする

**実装手順**:
1. `src/app/sessions/[id]/page.tsx`を修正
2. useEffectで初回レンダリング時に許可リクエストを実行
3. 許可状態が`default`の場合のみリクエスト

**実装詳細**:
```typescript
// src/app/sessions/[id]/page.tsx
import { useNotificationStore } from '@/store/notification';

// コンポーネント内
const { permission, requestPermission } = useNotificationStore();

useEffect(() => {
  if (permission === 'default') {
    // 非同期処理だがawaitは不要（結果はストアに保存される）
    requestPermission();
  }
}, [permission, requestPermission]);
// 依存配列の解説:
// - permission: ストアから取得した現在の許可状態。変化を検知してエフェクトを再実行する。
// - requestPermission: Zustandのアクションは安定（毎回同じ参照）なので無限ループにはならない。
//   ESLintのexhaustive-depsルールに従い含める。
// - sessionId: 含めない。通知許可はブラウザ全体で1回のみリクエストすればよく、
//   セッション変更時に再リクエストは不要。
```

**受入基準**:
- [ ] セッションページ初回アクセス時に通知許可ダイアログが表示される
- [ ] 許可/拒否後、再度ダイアログは表示されない
- [ ] 許可状態がZustandストアに保存される
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.2
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.5: 通知設定UIの実装

**説明**:
ヘッダーに通知設定ドロップダウンを追加する

**実装手順（TDD）**:
1. テスト作成: `src/components/common/__tests__/NotificationSettings.test.tsx`
2. テスト実行: すべてのテストが失敗することを確認
3. テストコミット: テストのみをコミット
4. 実装: `src/components/common/NotificationSettings.tsx`を実装
   - useEffect + useRef でドロップダウン外クリック検知を実装
   - isOpen 状態の管理と外側クリック時のクローズ処理
5. ヘッダーコンポーネント（`src/components/layout/Header.tsx`）にNotificationSettingsを追加
   - ThemeToggleの左側に配置
   - `import { NotificationSettings } from '@/components/common/NotificationSettings';`
6. 実装コミット: すべてのテストが通過したらコミット

**レイアウト**:
- 配置: ヘッダー右側、ThemeToggleの左隣
- ドロップダウン: `absolute right-0`で右寄せ、`w-64`（256px）
- レスポンシブ:
  - モバイル（375px以下）: ドロップダウンは`right-0`で右端固定、画面内に収まる
  - 特別な調整は不要（ドロップダウン幅256px < 375px）

**ファイル構成**:
```text
src/components/common/NotificationSettings.tsx
src/components/common/__tests__/NotificationSettings.test.tsx
```

**実装詳細**:
```typescript
// src/components/common/NotificationSettings.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationStore } from '@/store/notification';

export function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { permission, settings, updateSettings } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="通知設定"
      >
        {permission === 'granted' ? (
          <Bell className="w-5 h-5" />
        ) : (
          <BellOff className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-4">
          <h3 className="font-medium mb-3">通知設定</h3>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">タスク完了</span>
            <input
              type="checkbox"
              checked={settings.onTaskComplete}
              onChange={(e) => updateSettings({ onTaskComplete: e.target.checked })}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">権限要求</span>
            <input
              type="checkbox"
              checked={settings.onPermissionRequest}
              onChange={(e) => updateSettings({ onPermissionRequest: e.target.checked })}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">エラー発生</span>
            <input
              type="checkbox"
              checked={settings.onError}
              onChange={(e) => updateSettings({ onError: e.target.checked })}
              className="rounded"
            />
          </label>

          {permission === 'denied' && (
            <p className="text-xs text-red-500 mt-2">
              ブラウザの通知がブロックされています
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

**受入基準**:
- [ ] テストファイル`src/components/common/__tests__/NotificationSettings.test.tsx`が存在する
- [ ] テストが5つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `src/components/common/NotificationSettings.tsx`が実装されている
- [ ] `src/components/layout/Header.tsx`にNotificationSettingsがインポート・配置されている
- [ ] ヘッダーに通知アイコンが表示される（ThemeToggleの左隣）
- [ ] クリックで設定ドロップダウンが開く
- [ ] ドロップダウン外クリックで閉じる
- [ ] チェックボックスで各イベントの通知をオン/オフできる
- [ ] 設定変更が即座にローカルストレージに保存される
- [ ] 通知がブロックされている場合に警告が表示される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.2
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.6: OS通知クリック時のフォーカス処理

**説明**:
OS通知をクリックした時に該当セッションのタブにフォーカスする

**実装手順**:
1. `src/lib/notification-service.ts`の`sendNotification`を修正
2. `Notification`オブジェクトの`onclick`ハンドラを設定
3. `window.focus()`と`location.href`でセッションページに遷移

**実装詳細**:
```typescript
// src/lib/notification-service.ts の sendNotification 内
function showOSNotification(event: NotificationEvent): void {
  const notification = new Notification(getTitle(event), {
    body: event.message || getDefaultBody(event),
    icon: '/icon.png',
    tag: `claudework-${event.sessionId}`,
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = `/sessions/${event.sessionId}`;
    notification.close();
  };
}

function getTitle(event: NotificationEvent): string {
  switch (event.type) {
    case 'taskComplete':
      return `タスク完了: ${event.sessionName}`;
    case 'permissionRequest':
      return `アクション要求: ${event.sessionName}`;
    case 'error':
      return `エラー発生: ${event.sessionName}`;
  }
}
```

**受入基準**:
- [ ] OS通知クリック時にウィンドウがフォーカスされる
- [ ] OS通知クリック時に該当セッションページに遷移する
- [ ] 通知が自動的に閉じる
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.1
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### Phase 34完了基準

- [ ] タスク34.1が完了している（通知サービス）
- [ ] タスク34.2が完了している（通知ストア）
- [ ] タスク34.3が完了している（WebSocketハンドラ統合）
- [ ] タスク34.4が完了している（許可リクエスト自動実行）
- [ ] タスク34.5が完了している（設定UI）
- [ ] タスク34.6が完了している（通知クリックフォーカス）
- [ ] タスク完了時にOS通知が送信される
- [ ] 権限要求時にOS通知が送信される
- [ ] エラー発生時にOS通知が送信される
- [ ] タブがアクティブな場合はtoast通知が表示される
- [ ] 通知設定UIで各イベントのオン/オフが可能
- [ ] 設定がローカルストレージに永続化される
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される要件

**docs/requirements.md**:
- REQ-084: 初回アクセス時の通知許可要求
- REQ-085: タスク完了時のOS通知
- REQ-086: 権限要求時のOS通知
- REQ-087: エラー発生時のOS通知
- REQ-088: アクティブタブでのtoast通知
- REQ-089: バックグラウンドタブでのOS通知
- REQ-090: 通知クリック時のフォーカス
- REQ-091: 通知設定のローカルストレージ保存
- REQ-092: 設定変更の即時適用
- REQ-093: イベント別オン/オフ設定

---


## Phase 38: 包括的UI検証で発見された不具合修正

**目的**: Phase 37の包括的UI検証で発見された5つの不具合を修正する
**検証レポート**: `docs/verification-report-comprehensive-phase37.md`

### 概要

| タスク | 重要度 | 関連REQ | 概要 |
|--------|--------|---------|------|
| 38.1 | Critical | REQ-058-062 | Terminalタブでクラッシュ |
| 38.2 | High | REQ-014 | セッション一覧からセッション詳細への遷移不可 |
| 38.3 | Medium | REQ-006,007 | プロジェクト設定UI未実装 |
| 38.4 | Medium | REQ-015 | セッションステータスアイコン未実装 |
| 38.5 | Low | REQ-002 | エラーメッセージの修正 |

---

### タスク38.1: Terminalタブのクラッシュ修正 (BUG-005)

**説明**:
セッション詳細画面でTerminalタブをクリックするとアプリケーションがクラッシュする問題を修正する。

**関連要件**: REQ-058, REQ-059, REQ-060, REQ-061, REQ-062
**重要度**: Critical

**再現手順**:
1. セッション詳細ページを開く（`/sessions/{sessionId}`）
2. Terminalタブをクリック
3. エラー画面が表示される

**エラーメッセージ**:
```
Application error: a client-side exception has occurred while loading localhost
(see the browser console for more information)
```

**調査ファイル**:
- `src/app/sessions/[id]/page.tsx` - セッション詳細ページ
- `src/components/Terminal.tsx` または類似ファイル - ターミナルコンポーネント
- `src/hooks/useTerminal.ts` - ターミナルフック

**修正方針**:
1. ブラウザコンソールで詳細なエラーを確認
2. ターミナルコンポーネントの初期化処理を確認
3. XTerm.jsの読み込み/初期化エラーを特定
4. 必要に応じてエラーバウンダリを追加

**実装手順（TDD）**:
1. テスト作成: Terminalタブ切り替えのテストを作成
2. テスト実行: 失敗を確認
3. 実装: エラーの原因を特定し修正
4. テスト通過: すべてのテストが通過することを確認

**受入基準**:
- [ ] Terminalタブをクリックしてもクラッシュしない
- [ ] ターミナルが正常に表示される
- [ ] コンソールにエラーが出力されない
- [ ] ターミナルに入力できる（REQ-060）
- [ ] ANSIエスケープシーケンスが正しくレンダリングされる（REQ-061）
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク38.2: セッション一覧からセッション詳細への遷移実装 (BUG-004)

**説明**:
セッション一覧でセッション名/カードをクリックしてもセッション詳細ページに遷移しない問題を修正する。

**関連要件**: REQ-014
**重要度**: High

**再現手順**:
1. プロジェクト詳細ページ（`/projects/{projectId}`）を開く
2. セッション一覧に表示されているセッション名をクリック
3. 何も起きない（遷移しない）

**期待動作**: セッションを選択した時、そのセッションのClaude Code出力をリアルタイムで表示（REQ-014）
**実際の動作**: クリックしても何も起きない（直接URLでアクセスする必要がある）

**調査ファイル**:
- `src/app/projects/[id]/page.tsx` - プロジェクト詳細ページ
- `src/components/SessionCard.tsx` または類似ファイル - セッションカードコンポーネント
- `src/components/SessionList.tsx` または類似ファイル - セッション一覧コンポーネント

**修正方針**:
1. セッションカード/名前にクリックハンドラを追加
2. `router.push(`/sessions/${sessionId}`)` で遷移を実装
3. クリック可能なことを示すカーソルスタイルを追加

**実装手順（TDD）**:
1. テスト作成: セッションカードクリックで遷移するテストを作成
2. テスト実行: 失敗を確認
3. 実装: クリックハンドラと遷移処理を追加
4. テスト通過: すべてのテストが通過することを確認

**受入基準**:
- [ ] セッション名/カードをクリックするとセッション詳細ページに遷移する
- [ ] 遷移先URLが `/sessions/{sessionId}` である
- [ ] クリック可能なことを示すカーソルスタイル（pointer）が適用されている
- [ ] ホバー時に視覚的フィードバックがある
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク38.3: プロジェクト設定UI実装 (BUG-002)

**説明**:
プロジェクト設定（ランスクリプト設定）のUIが存在しない問題を修正する。

**関連要件**: REQ-006, REQ-007
**重要度**: Medium

**期待動作**:
- REQ-006: ユーザーがプロジェクト設定を開いた時、システムはランスクリプト（テスト・ビルドコマンド）の設定フォームを表示しなければならない
- REQ-007: ユーザーがランスクリプトを保存した時、システムはそのプロジェクトの全セッションで使用可能なコマンドとして登録しなければならない

**実際の動作**: プロジェクト設定画面へのアクセス方法がない

**調査ファイル**:
- `src/app/page.tsx` - ダッシュボード（プロジェクト一覧）
- `src/components/ProjectCard.tsx` または類似ファイル
- `src/app/api/projects/[id]/route.ts` - プロジェクトAPI

**修正方針**:
1. プロジェクトカードに「設定」ボタンを追加
2. プロジェクト設定モーダル/ページを作成
3. ランスクリプト設定フォームを実装
4. APIにランスクリプト保存機能を追加（既存の場合は確認）

**UI設計**:
```
┌─────────────────────────────────────────┐
│ プロジェクト設定                          │
├─────────────────────────────────────────┤
│ デフォルトモデル: [Auto ▼]              │
│                                         │
│ ランスクリプト                           │
│ ┌─────────────────────────────────────┐ │
│ │ 名前: [test        ]                │ │
│ │ コマンド: [npm test            ]    │ │
│ │                          [削除]     │ │
│ └─────────────────────────────────────┘ │
│ [+ スクリプトを追加]                     │
│                                         │
│             [キャンセル] [保存]          │
└─────────────────────────────────────────┘
```

**実装手順（TDD）**:
1. テスト作成: プロジェクト設定モーダルの表示・保存テストを作成
2. テスト実行: 失敗を確認
3. 実装: UIコンポーネントとAPIを実装
4. テスト通過: すべてのテストが通過することを確認

**受入基準**:
- [ ] プロジェクトカードに「設定」ボタンがある
- [ ] 「設定」ボタンクリックで設定モーダル/ページが開く
- [ ] デフォルトモデルを選択できる（REQ-032）
- [ ] ランスクリプトを追加・編集・削除できる
- [ ] 保存後、セッションのScriptsタブにスクリプトが表示される
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 90分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク38.4: セッションステータスアイコン実装 (BUG-003)

**説明**:
セッション一覧でステータスアイコンが表示されない問題を修正する。

**関連要件**: REQ-015
**重要度**: Medium

**期待動作**: セッション一覧において、システムは各セッションのステータス（初期化中/実行中/入力待ち/完了/エラー）をアイコンで表示しなければならない
**実際の動作**: ステータスアイコンなし（セッション詳細ページではテキストで表示）

**調査ファイル**:
- `src/app/projects/[id]/page.tsx` - プロジェクト詳細ページ
- `src/components/SessionCard.tsx` または類似ファイル
- `src/types/` - セッションステータスの型定義

**修正方針**:
1. ステータスアイコンコンポーネントを作成
2. セッションカードにステータスアイコンを追加
3. ステータスに応じた色・アイコンを表示

**アイコン設計**:
| ステータス | アイコン | 色 |
|----------|---------|-----|
| initializing | Loader (回転) | 青 |
| running | Play | 緑 |
| waiting_input | MessageCircle | 黄 |
| completed | CheckCircle | 緑 |
| error | XCircle | 赤 |

**実装手順（TDD）**:
1. テスト作成: ステータスアイコン表示のテストを作成
2. テスト実行: 失敗を確認
3. 実装: アイコンコンポーネントを作成し、セッションカードに追加
4. テスト通過: すべてのテストが通過することを確認

**受入基準**:
- [ ] セッション一覧に各セッションのステータスアイコンが表示される
- [ ] ステータスに応じたアイコンと色が適用される
- [ ] initializingステータスではアイコンが回転する
- [ ] アイコンにホバーするとステータス名がツールチップで表示される
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク38.5: プロジェクト追加時のエラーメッセージ修正 (BUG-001)

**説明**:
Gitリポジトリでないパスを入力した場合のエラーメッセージが仕様と異なる問題を修正する。

**関連要件**: REQ-002
**重要度**: Low

**期待動作**: 指定されたパスがGitリポジトリでない場合、システムは「Gitリポジトリではありません」とエラーメッセージを表示しなければならない
**実際の動作**: 「有効なパスを入力してください」と表示される

**調査ファイル**:
- `src/app/api/projects/route.ts` - プロジェクト追加API
- `src/components/AddProjectDialog.tsx` または類似ファイル - プロジェクト追加ダイアログ
- `src/services/git-service.ts` - Gitサービス

**修正方針**:
1. APIのエラーレスポンスメッセージを修正
2. または、フロントエンドのバリデーションメッセージを修正
3. Gitリポジトリでない場合の判定ロジックを確認

**実装手順（TDD）**:
1. テスト作成: エラーメッセージのテストを作成
2. テスト実行: 失敗を確認
3. 実装: エラーメッセージを修正
4. テスト通過: すべてのテストが通過することを確認

**受入基準**:
- [ ] Gitリポジトリでないパスを入力した場合、「Gitリポジトリではありません」と表示される
- [ ] 存在しないパスの場合は別のエラーメッセージが表示される
- [ ] エラーメッセージが日本語で表示される
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### Phase 38完了基準

- [ ] タスク38.1が完了している（Terminalタブクラッシュ修正）
- [ ] タスク38.2が完了している（セッション一覧からの遷移）
- [ ] タスク38.3が完了している（プロジェクト設定UI）
- [ ] タスク38.4が完了している（ステータスアイコン）
- [ ] タスク38.5が完了している（エラーメッセージ）
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである

### 解決される要件

**docs/requirements.md**:
- REQ-002: Gitリポジトリでないパスのエラーメッセージ
- REQ-006: プロジェクト設定フォーム表示
- REQ-007: ランスクリプト保存
- REQ-014: セッション選択でセッション詳細表示
- REQ-015: セッションステータスアイコン表示
- REQ-058-062: ターミナル機能

---


## Phase 39: ターミナル表示不具合修正

**目的**: Phase 38総合検証で発見されたターミナル表示の不具合を修正する

### タスク39.1: Terminalタブでターミナルコンテンツが表示されない問題の修正 (BUG-006)

**説明**:
セッション詳細画面のTerminalタブを選択しても、ターミナルUIが空白のまま表示されない問題を修正する。

**関連要件**: REQ-058
**重要度**: High

**期待動作**:
- REQ-058: ターミナルタブでセッションのターミナルが表示される
- ターミナルヘッダー（「Terminal」タイトル、接続状態インジケーター）が表示される
- XTerm.jsターミナルが描画される

**実際の動作**:
- Terminalタブを選択するとコンテンツエリアが完全に空白
- ヘッダーも接続状態インジケーターも表示されない
- XTerm.jsの描画が行われない

**スクリーンショット**: `test-screenshots/comprehensive-test/terminal-tab.png`

**調査ファイル**:
- `src/components/sessions/TerminalPanel.tsx` - ターミナルパネルコンポーネント
- `src/hooks/useTerminal.ts` - ターミナルフック
- `src/app/sessions/[id]/page.tsx` - セッション詳細ページ

**調査ポイント**:
1. TerminalPanelコンポーネントが正しくレンダリングされているか
2. useTerminalフックが正しく初期化されているか
3. タブ切り替え時のコンポーネントマウント/アンマウントが正しく処理されているか
4. XTerm.jsのopen()呼び出しが成功しているか
5. コンテナ要素のサイズが0になっていないか

**修正方針**:
1. コンソールログを追加してデバッグ情報を収集
2. TerminalPanelのマウント状態を確認
3. XTerm.jsの初期化シーケンスを検証
4. CSSでの表示/非表示制御を確認

**実装手順**:
1. 原因調査: ブラウザのDevToolsでコンポーネントの状態を確認
2. 問題箇所の特定: レンダリング、初期化、またはスタイリングの問題を特定
3. 修正実装: 特定された問題を修正
4. テスト: 手動でTerminalタブの動作を確認
5. リグレッションテスト: 既存のテストが通過することを確認

**受入基準**:
- [ ] Terminalタブをクリックするとターミナルヘッダーが表示される
- [ ] 接続状態インジケーター（Connected/Disconnected）が表示される
- [ ] XTerm.jsターミナルが描画される
- [ ] ターミナルへの入力が可能である
- [ ] WebSocket経由でPTYと通信できる
- [ ] ウィンドウリサイズ時にターミナルがリサイズされる
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### Phase 39完了基準

- [ ] タスク39.1が完了している（ターミナル表示修正）
- [ ] Terminalタブでターミナルが正常に表示される
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである

### 解決される要件

**docs/requirements.md**:
- REQ-058: ターミナルタブでセッションのターミナルが表示される

---


## Phase 40: プロセスライフサイクル管理

**目的**: Claude Codeプロセスの自動停止・再開機能を実装し、サーバーリソースの効率的な利用を実現する

**関連要件**: REQ-094〜REQ-108（Story 17: プロセスライフサイクル管理）

### タスク40.1: Prismaスキーマの更新

**説明**:
sessionsテーブルにプロセスライフサイクル管理用のカラムを追加する。

**実装ファイル**:
- `prisma/schema.prisma`

**実装手順（TDD）**:
1. Prismaスキーマを更新
   - `resume_session_id` カラム追加（String?, Claude Codeの--resume用セッションID）
   - `last_activity_at` カラム追加（DateTime?, 最終アクティビティ日時）
   - `status`のコメントに`paused`を追加
2. `npx prisma db push`でスキーマを反映
3. `npx prisma generate`でクライアントを再生成

**受入基準**:
- [ ] `resume_session_id`カラムがsessionsテーブルに存在する
- [ ] `last_activity_at`カラムがsessionsテーブルに存在する
- [ ] Prismaクライアントが正しく生成される
- [ ] 既存のセッションデータが保持される

**依存関係**: なし
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.2: ProcessLifecycleManagerの実装

**説明**:
プロセスライフサイクル管理を担当する新しいサービスクラスを実装する。

**実装ファイル**:
- `src/services/process-lifecycle-manager.ts`（新規）
- `src/services/__tests__/process-lifecycle-manager.test.ts`（新規）

**実装手順（TDD）**:

1. テスト作成: `src/services/__tests__/process-lifecycle-manager.test.ts`
   - シングルトンインスタンスの取得テスト
   - アクティビティ更新テスト
   - アイドルプロセス検出テスト
   - プロセス停止テスト
   - グレースフルシャットダウンテスト

2. テスト実行: すべてのテストが失敗することを確認

3. 実装: `src/services/process-lifecycle-manager.ts`
   ```typescript
   interface ProcessLifecycleState {
     sessionId: string;
     lastActivityAt: Date;
     isPaused: boolean;
     resumeSessionId: string | null;
   }

   class ProcessLifecycleManager {
     private static instance: ProcessLifecycleManager | null = null;
     private activityMap: Map<string, Date> = new Map();
     private idleCheckInterval: NodeJS.Timer | null = null;

     static getInstance(): ProcessLifecycleManager;
     updateActivity(sessionId: string): void;
     getLastActivity(sessionId: string): Date | null;
     startIdleChecker(): void;
     stopIdleChecker(): void;
     async pauseIdleProcesses(): Promise<string[]>;
     async initiateShutdown(): Promise<void>;
     async resumeSession(sessionId: string, resumeSessionId?: string): Promise<void>;
   }
   ```

4. すべてのテストが通過するまで実装を修正

**受入基準**:
- [ ] ProcessLifecycleManagerクラスが実装されている
- [ ] シングルトンパターン（globalThis対応）が実装されている
- [ ] アクティビティトラッキング機能が実装されている
- [ ] アイドルプロセス検出機能が実装されている
- [ ] グレースフルシャットダウン機能が実装されている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク40.1
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.3: ProcessManagerへの--resumeオプション追加

**説明**:
ProcessManagerのstartClaudeCodeメソッドに--resumeオプションのサポートを追加する。

**実装ファイル**:
- `src/services/process-manager.ts`
- `src/services/__tests__/process-manager.test.ts`

**実装手順（TDD）**:

1. テスト追加: `src/services/__tests__/process-manager.test.ts`
   - resumeオプション付きでプロセス起動するテスト
   - resumeオプションなしの既存動作確認テスト

2. テスト実行: 新しいテストが失敗することを確認

3. 実装:
   - StartOptionsインターフェースに`resume?: string`を追加
   - startClaudeCodeメソッドで`--resume`オプションを処理
   ```typescript
   if (options.resume) {
     args.push('--resume', options.resume);
   }
   ```

4. すべてのテストが通過するまで実装を修正

**受入基準**:
- [ ] StartOptionsに`resume`プロパティが追加されている
- [ ] `claude --resume <session-id>`形式でプロセスが起動できる
- [ ] resumeオプションなしの既存動作が維持される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.4: サーバーシャットダウンハンドラの実装

**説明**:
server.tsにSIGTERM/SIGINTシグナルハンドラを追加し、グレースフルシャットダウンを実装する。

**実装ファイル**:
- `server.ts`

**実装内容**:
1. ProcessLifecycleManagerのインポート
2. SIGTERM/SIGINTシグナルハンドラの登録
3. シャットダウン時の処理:
   - 全WebSocket接続に`server_shutdown`メッセージ送信
   - ProcessLifecycleManager.initiateShutdown()呼び出し
   - 5秒のグレース期間後にprocess.exit(0)

```typescript
import { getProcessLifecycleManager } from './src/services/process-lifecycle-manager';

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  
  // WebSocket通知
  connectionManager.broadcastAll({
    type: 'server_shutdown',
    reason: signal,
    gracePeriodSeconds: 5
  });
  
  // プロセス停止
  const plm = getProcessLifecycleManager();
  await plm.initiateShutdown();
  
  logger.info('Graceful shutdown completed');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

**受入基準**:
- [ ] SIGTERM受信時に全プロセスが停止される
- [ ] SIGINT受信時に全プロセスが停止される
- [ ] WebSocketクライアントにserver_shutdownメッセージが送信される
- [ ] 5秒のグレース期間後にサーバーが終了する
- [ ] ログに適切なシャットダウンメッセージが出力される
- [ ] ESLintエラーがゼロである

**依存関係**: タスク40.2
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.5: アイドルタイムアウトチェッカーの実装

**説明**:
定期的にアイドルプロセスをチェックし、タイムアウトしたプロセスを自動停止する機能を実装する。

**実装ファイル**:
- `src/services/process-lifecycle-manager.ts`（タスク40.2の拡張）
- `src/services/__tests__/process-lifecycle-manager.test.ts`

**環境変数**:
- `PROCESS_IDLE_TIMEOUT_MINUTES`: アイドルタイムアウト（分）。デフォルト30。0で無効化。

**実装手順（TDD）**:

1. テスト追加:
   - 環境変数からタイムアウト値を読み取るテスト
   - タイムアウト0で無効化されるテスト
   - タイムアウト超過プロセスが検出されるテスト
   - WebSocket通知が送信されるテスト
   - DB更新（status='paused'）が実行されるテスト

2. テスト実行: 新しいテストが失敗することを確認

3. 実装:
   - 環境変数の読み取りとバリデーション
   - setIntervalによる1分間隔のチェック
   - アイドルプロセスの検出とstatus='paused'への更新
   - WebSocket経由での通知

4. すべてのテストが通過するまで実装を修正

**受入基準**:
- [ ] PROCESS_IDLE_TIMEOUT_MINUTES環境変数が読み取られる
- [ ] 1分間隔でアイドルチェックが実行される
- [ ] タイムアウト超過プロセスが停止される
- [ ] セッションステータスが'paused'に更新される
- [ ] WebSocketでprocess_pausedメッセージが送信される
- [ ] resume_session_idがDBに保存される
- [ ] タイムアウト0で機能が無効化される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク40.2, タスク40.4
**推定工数**: 45分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.6: セッション再開APIの実装

**説明**:
POST /api/sessions/{id}/resumeエンドポイントを実装し、一時停止中のセッションを再開できるようにする。

**実装ファイル**:
- `src/app/api/sessions/[id]/resume/route.ts`（新規）
- `src/app/api/sessions/[id]/resume/__tests__/route.test.ts`（新規）

**実装手順（TDD）**:

1. テスト作成:
   - paused状態のセッションが再開できるテスト
   - resume_session_id使用時に--resumeで起動するテスト
   - paused以外の状態で400エラーを返すテスト
   - 存在しないセッションで404エラーを返すテスト

2. テスト実行: すべてのテストが失敗することを確認

3. 実装:
   ```typescript
   export async function POST(
     request: NextRequest,
     { params }: { params: { id: string } }
   ) {
     // 認証チェック
     // セッション取得
     // status='paused'確認
     // ProcessLifecycleManager.resumeSession()呼び出し
     // レスポンス返却
   }
   ```

4. すべてのテストが通過するまで実装を修正

**受入基準**:
- [ ] POST /api/sessions/{id}/resumeエンドポイントが実装されている
- [ ] paused状態のセッションが再開できる
- [ ] resume_session_idがある場合--resumeで起動される
- [ ] 再開後のステータスがrunningになる
- [ ] paused以外の状態で400エラーが返される
- [ ] 存在しないセッションで404エラーが返される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク40.2, タスク40.3
**推定工数**: 45分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.7: WebSocketライフサイクルメッセージの実装

**説明**:
WebSocketハンドラにプロセスライフサイクルイベントの通知機能を追加する。

**実装ファイル**:
- `src/types/websocket.ts`
- `src/lib/websocket/session-websocket-handler.ts`
- `src/lib/websocket/__tests__/session-websocket-handler.test.ts`

**実装手順（TDD）**:

1. テスト追加:
   - process_pausedメッセージの送信テスト
   - process_resumedメッセージの送信テスト
   - server_shutdownメッセージの送信テスト

2. テスト実行: 新しいテストが失敗することを確認

3. 実装:
   - WebSocketメッセージ型の拡張
   ```typescript
   type WebSocketMessageType =
     | 'output'
     | 'permission_request'
     | 'status_change'
     | 'error'
     | 'process_paused'
     | 'process_resumed'
     | 'server_shutdown';
   ```
   - メッセージ送信メソッドの追加

4. すべてのテストが通過するまで実装を修正

**受入基準**:
- [ ] WebSocketメッセージ型にライフサイクルイベントが追加されている
- [ ] process_pausedメッセージが送信できる
- [ ] process_resumedメッセージが送信できる
- [ ] server_shutdownメッセージが送信できる
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.8: フロントエンドのライフサイクル対応

**説明**:
フロントエンドでプロセスライフサイクルイベントを処理し、適切なUIを表示する。

**実装ファイル**:
- `src/hooks/useWebSocket.ts`
- `src/components/sessions/SessionDetail.tsx`
- `src/app/sessions/[id]/page.tsx`

**実装内容**:

1. useWebSocketフックの拡張:
   - process_pausedメッセージのハンドリング
   - process_resumedメッセージのハンドリング
   - server_shutdownメッセージのハンドリング

2. セッション詳細ページの対応:
   - paused状態の表示（「セッションは一時停止中です」）
   - 再開ボタンの表示
   - 再開ボタンクリックでPOST /api/sessions/{id}/resume呼び出し

3. サーバーシャットダウン通知:
   - server_shutdownメッセージ受信時にトースト表示
   - 「サーバーがシャットダウンします」メッセージ

**受入基準**:
- [ ] paused状態のセッションで「一時停止中」が表示される
- [ ] 再開ボタンが表示され、クリックでセッションが再開される
- [ ] 再開後にチャット/ターミナルが利用可能になる
- [ ] server_shutdown受信時にトースト通知が表示される
- [ ] ESLintエラーがゼロである

**依存関係**: タスク40.6, タスク40.7
**推定工数**: 45分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.9: 環境変数ドキュメントの更新

**説明**:
新しい環境変数をドキュメントに追加する。

**実装ファイル**:
- `docs/ENV_VARS.md`
- `CLAUDE.md`

**追加内容**:
```markdown
### プロセスライフサイクル

- `PROCESS_IDLE_TIMEOUT_MINUTES`: アイドルタイムアウト時間（分）
  - デフォルト: 30
  - 最小値: 5（5未満は5に補正）
  - 0: 無効化（タイムアウトなし）
  
- `PROCESS_SHUTDOWN_GRACE_SECONDS`: シャットダウン時のグレース期間（秒）
  - デフォルト: 5
```

**受入基準**:
- [ ] ENV_VARS.mdに新しい環境変数が記載されている
- [ ] 各環境変数のデフォルト値と説明がある
- [ ] CLAUDE.mdの該当セクションが更新されている

**依存関係**: なし
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク40.10: 統合テストとE2Eテスト

**説明**:
プロセスライフサイクル管理機能の統合テストとE2Eテストを実装する。

**実装ファイル**:
- `e2e/process-lifecycle.spec.ts`（新規）

**テストシナリオ**:

1. アイドルタイムアウトテスト（短いタイムアウト値で）:
   - セッション作成
   - しばらく待機
   - ステータスがpausedになることを確認
   - WebSocket通知を確認

2. セッション再開テスト:
   - paused状態のセッション作成（またはモック）
   - 再開ボタンクリック
   - ステータスがrunningになることを確認
   - チャットが利用可能になることを確認

3. サーバーシャットダウン通知テスト:
   - WebSocket接続
   - server_shutdownメッセージをシミュレート
   - トースト通知が表示されることを確認

**受入基準**:
- [ ] E2Eテストが作成されている
- [ ] アイドルタイムアウトのテストが通過する
- [ ] セッション再開のテストが通過する
- [ ] サーバーシャットダウン通知のテストが通過する
- [ ] すべてのE2Eテストが通過する（`npm run e2e`）

**依存関係**: タスク40.1〜40.8
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### Phase 40完了基準

- [ ] タスク40.1が完了している（Prismaスキーマ更新）
- [ ] タスク40.2が完了している（ProcessLifecycleManager実装）
- [ ] タスク40.3が完了している（--resumeオプション追加）
- [ ] タスク40.4が完了している（シャットダウンハンドラ）
- [ ] タスク40.5が完了している（アイドルタイムアウトチェッカー）
- [ ] タスク40.6が完了している（セッション再開API）
- [ ] タスク40.7が完了している（WebSocketライフサイクルメッセージ）
- [ ] タスク40.8が完了している（フロントエンド対応）
- [ ] タスク40.9が完了している（ドキュメント更新）
- [ ] タスク40.10が完了している（統合テスト）
- [ ] すべてのテストが通過している（`npm test`）
- [ ] すべてのE2Eテストが通過している（`npm run e2e`）
- [ ] ESLintエラーがゼロである

### 解決される要件

**docs/requirements.md**:
- REQ-094〜096: サーバーシャットダウン時のクリーンアップ
- REQ-097〜101: アイドルタイムアウトによる自動停止
- REQ-102〜106: セッション再開と会話履歴復元
- REQ-107〜108: プロセス状態管理
