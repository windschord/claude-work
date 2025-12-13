# タスク詳細化: フェーズ6（高度な機能）

このファイルは、`docs/tasks.md`のフェーズ6（タスク6.1〜6.7）を詳細化したものです。
最終的にはこの内容を`docs/tasks.md`に統合します。

---

## フェーズ6: 拡張機能（高度な機能）
*推定期間: 240分（AIエージェント作業時間）*
*MVP: No*

---

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
