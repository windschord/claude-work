# タスク一覧: Claude Code 実行オプション・環境変数設定機能

## TASK-001: DBスキーマ変更

**ステータス**: pending
**依存**: なし

### 作業内容
1. `src/db/schema.ts` の `projects` テーブルに `claude_code_options` (TEXT, default '{}'), `custom_env_vars` (TEXT, default '{}') を追加
2. `src/db/schema.ts` の `sessions` テーブルに `claude_code_options` (TEXT, nullable), `custom_env_vars` (TEXT, nullable) を追加
3. `npx prisma db push` でスキーマ反映（drizzleの場合は `drizzle-kit push`）

### 完了条件
- カラムが追加され、既存データに影響がないこと

---

## TASK-002: ClaudeOptionsServiceの作成

**ステータス**: pending
**依存**: TASK-001

### 作業内容
1. `src/services/claude-options-service.ts` を新規作成
2. 型定義: `ClaudeCodeOptions`, `CustomEnvVars`
3. `mergeOptions()`: プロジェクトデフォルトとセッション設定のマージ
4. `mergeEnvVars()`: 環境変数のマージ
5. `buildCliArgs()`: CLIオプションを引数配列に変換
6. `buildEnv()`: カスタム環境変数をPTY環境にマージ
7. `validateEnvVarKey()`: 環境変数キーのバリデーション
8. ユニットテスト作成

### 完了条件
- 全メソッドが実装され、テストがパスすること

---

## TASK-003: ClaudePTYManager・EnvironmentAdapterの変更

**ステータス**: pending
**依存**: TASK-002

### 作業内容
1. `CreateSessionOptions` に `claudeCodeOptions`, `customEnvVars` フィールドを追加
2. `CreateClaudePTYSessionOptions` に `claudeCodeOptions`, `customEnvVars` フィールドを追加
3. `ClaudePTYManager.createSession()` でCLIオプションと環境変数を適用
4. `HostAdapter.createSession()` でオプションを `ClaudePTYManager` に中継
5. `buildClaudePtyEnv()` にカスタム環境変数のマージを追加

### 完了条件
- `createSession()` にオプション・環境変数を渡すとCLI引数とPTY環境に反映されること

---

## TASK-004: WebSocketハンドラーの変更

**ステータス**: pending
**依存**: TASK-003

### 作業内容
1. `src/lib/websocket/claude-ws.ts` でPTY作成前にプロジェクト設定を取得
2. `ClaudeOptionsService.mergeOptions/mergeEnvVars` でマージ
3. マージ結果を `adapter.createSession()` のオプションに渡す

### 完了条件
- WebSocket接続時にマージされたオプションでClaude Codeが起動すること

---

## TASK-005: APIルートの変更

**ステータス**: pending
**依存**: TASK-001

### 作業内容
1. `src/app/api/projects/[project_id]/route.ts` PUT: `claude_code_options`, `custom_env_vars` の保存対応
2. `src/app/api/projects/[project_id]/sessions/route.ts` POST: `claude_code_options`, `custom_env_vars` の保存対応
3. プロジェクトGET APIでオプション情報を返却するよう修正

### 完了条件
- APIで設定の読み書きが可能なこと

---

## TASK-006: ClaudeOptionsFormコンポーネントの作成

**ステータス**: pending
**依存**: なし

### 作業内容
1. `src/components/claude-options/ClaudeOptionsForm.tsx` を新規作成
2. CLIオプション入力UI: model（テキスト）、allowedTools（テキスト）、permissionMode（セレクト）、additionalFlags（テキスト）
3. カスタム環境変数入力UI: key-valueペアのリスト、追加/削除ボタン
4. Disclosure（折りたたみ）で初期非表示

### 完了条件
- フォームコンポーネントが正しくレンダリングされ、値の入出力が可能なこと

---

## TASK-007: CreateSessionModalへの組み込み

**ステータス**: pending
**依存**: TASK-005, TASK-006

### 作業内容
1. `CreateSessionModal.tsx` に `ClaudeOptionsForm` を追加
2. フォーム送信時に `claude_code_options`, `custom_env_vars` をAPIに送信

### 完了条件
- セッション作成モーダルでオプションと環境変数を指定してセッションを作成できること

---

## TASK-008: ProjectSettingsModalへの組み込み

**ステータス**: pending
**依存**: TASK-005, TASK-006

### 作業内容
1. `ProjectSettingsModal.tsx` に `ClaudeOptionsForm` を追加
2. プロジェクト保存時に `claude_code_options`, `custom_env_vars` をAPIに送信
3. モーダル表示時にプロジェクトの既存設定を読み込み

### 完了条件
- プロジェクト設定モーダルでデフォルトのオプションと環境変数を設定・保存できること
