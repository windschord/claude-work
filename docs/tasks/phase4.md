## フェーズ4: リアルタイム通信とMVP統合
*推定期間: 185分（AIエージェント作業時間）*
*MVP: Yes*

## タスク4.1: WebSocketサーバー実装

**説明**:
Next.jsカスタムサーバーにWebSocketサーバーを実装する
- セッション用WebSocket（/ws/sessions/{id}）
- 認証済みセッションのみ接続許可
- Claude Code出力のブロードキャスト
- ユーザー入力の受信とClaude Codeへの転送
- 権限確認リクエストの送信

**技術的文脈**:
- Next.js 14カスタムサーバー（`server.ts`）
- ws 8.x ライブラリ使用
- iron-sessionで認証確認
- ProcessManagerと統合
- 接続管理クラス（ConnectionManager）
- メッセージ形式: JSON

**必要なパッケージ**:
```bash
npm install ws
npm install --save-dev @types/ws
```

**実装ファイル**:
- `server.ts` - Next.jsカスタムサーバー + WebSocketサーバー
- `src/lib/websocket/connection-manager.ts` - WebSocket接続管理
- `src/lib/websocket/session-ws.ts` - セッション用WebSocketハンドラー
- `src/lib/websocket/auth-middleware.ts` - WebSocket認証ミドルウェア
- `src/lib/__tests__/websocket.test.ts` - WebSocketテスト
- `package.json` - スクリプト更新（`"start": "node server.js"`）

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/lib/__tests__/websocket.test.ts`作成
     - 認証済み接続成功
     - 未認証接続拒否
     - メッセージ送受信
     - Claude Code出力のブロードキャスト
     - 権限確認リクエスト送信
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add WebSocket server tests"

2. **実装フェーズ**:
   - `src/lib/websocket/auth-middleware.ts`作成
     - クッキーから`session`取得
     - iron-sessionで検証
     - 認証失敗時: 接続拒否
   - `src/lib/websocket/connection-manager.ts`作成
     - `connections: Map<sessionId, WebSocket[]>`で接続管理
     - `addConnection(sessionId: string, ws: WebSocket): void`
     - `removeConnection(sessionId: string, ws: WebSocket): void`
     - `broadcast(sessionId: string, message: any): void`
   - `src/lib/websocket/session-ws.ts`作成
     - WebSocket接続ハンドラー
     - メッセージ受信: `{type: 'input', content: string}`
     - ProcessManagerに転送
     - ProcessManagerからの出力をブロードキャスト
   - `server.ts`作成
     - Next.jsサーバー初期化
     - WebSocketサーバー初期化（ws）
     - `/ws/sessions/:id`エンドポイント
     - 認証ミドルウェア適用
     - 接続時: ConnectionManagerに追加
     - 切断時: ConnectionManagerから削除
   - `package.json`更新
     - `"scripts": { "dev": "ts-node --project tsconfig.server.json server.ts", "build:server": "tsc --project tsconfig.server.json", "start": "node dist/server.js" }`
   - `tsconfig.server.json`作成
     - `{ "extends": "./tsconfig.json", "compilerOptions": { "module": "commonjs", "outDir": "dist" }, "include": ["server.ts", "src/lib/websocket/**/*"] }`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement WebSocket server with ws library"

**WebSocketメッセージ形式**:

**クライアント → サーバー**:
```json
{
  "type": "input" | "approve" | "deny",
  "content": "string (for input)",
  "requestId": "string (for approve/deny)"
}
```

**サーバー → クライアント**:
```json
{
  "type": "output" | "permission_request" | "status_change" | "error",
  "content": "string",
  "subAgent": {
    "name": "string",
    "output": "string"
  },
  "permission": {
    "requestId": "string",
    "action": "string",
    "details": "string"
  },
  "status": "initializing" | "running" | "waiting_input" | "completed" | "error"
}
```

**ConnectionManager仕様**:
```typescript
class ConnectionManager {
  private connections: Map<string, Set<WebSocket>>;

  addConnection(sessionId: string, ws: WebSocket): void;
  removeConnection(sessionId: string, ws: WebSocket): void;
  broadcast(sessionId: string, message: any): void;
  getConnectionCount(sessionId: string): number;
}
```

**エラーハンドリング**:
- 認証失敗: WebSocket接続拒否、`ws.close(1008, 'Unauthorized')`
- 無効なsessionId: `ws.close(1003, 'Invalid session ID')`
- メッセージパースエラー: `ws.send({ type: 'error', content: 'Invalid message format' })`
- ProcessManager通信エラー: エラーログ出力、クライアントに通知

**受入基準**:
- [ ] `server.ts`が存在する
- [ ] `src/lib/websocket/connection-manager.ts`が存在する
- [ ] `src/lib/websocket/session-ws.ts`が存在する
- [ ] `src/lib/websocket/auth-middleware.ts`が存在する
- [ ] `tsconfig.server.json`が存在する
- [ ] `package.json`に`dev`、`build:server`、`start`スクリプトがある
- [ ] WebSocketサーバーが起動する（`ws://localhost:3000/ws/sessions/:id`）
- [ ] 認証済みクライアントのみ接続できる
- [ ] 未認証クライアントは接続拒否される
- [ ] Claude Code出力がクライアントに送信される
- [ ] クライアントからの入力がClaude Codeに転送される
- [ ] 権限確認リクエストが送信される
- [ ] 複数クライアントへのブロードキャストが機能する
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.3（API Routes基本設定）完了
- タスク2.1（認証API実装）完了
- タスク2.4（プロセスマネージャー実装）完了
- タスク2.5（セッションAPI実装）完了

**推定工数**: 55分（AIエージェント作業時間）
- テスト作成・コミット: 20分
- 実装・テスト通過・コミット: 35分

**ステータス**: `TODO`

---

## タスク4.2: WebSocketクライアント実装

**説明**:
フロントエンドにWebSocket接続機能を実装する
- WebSocket接続管理フック
- 自動再接続（最大5回、指数バックオフ）
- 接続状態管理
- メッセージ送受信

**技術的文脈**:
- React 18、TypeScript strict mode
- カスタムフック: `useWebSocket`
- 再接続間隔: 1s, 2s, 4s, 8s, 16s（指数バックオフ）
- WebSocket URL: `ws://localhost:3000/ws/sessions/:id`
- クリーンアップ: コンポーネントアンマウント時に接続切断

**必要なパッケージ**:
```bash
# 追加パッケージなし（ブラウザ標準WebSocket API使用）
```

**実装ファイル**:
- `src/hooks/useWebSocket.ts` - WebSocket接続管理フック
- `src/hooks/__tests__/useWebSocket.test.ts` - フックテスト
- `src/types/websocket.ts` - WebSocketメッセージ型定義

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/hooks/__tests__/useWebSocket.test.ts`作成
     - WebSocket接続確立
     - メッセージ受信時にコールバック呼び出し
     - メッセージ送信
     - 切断時に自動再接続
     - 最大再接続回数後は再接続しない
     - アンマウント時に接続切断
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add useWebSocket hook tests"

2. **実装フェーズ**:
   - `src/types/websocket.ts`作成
     - メッセージ型定義（ClientMessage、ServerMessage）
   - `src/hooks/useWebSocket.ts`作成
     - `useWebSocket(sessionId: string, onMessage: (message: ServerMessage) => void): { send, disconnect, status }`
     - ステート: `status: 'connecting' | 'connected' | 'disconnected' | 'error'`
     - `useEffect`でWebSocket接続
     - `ws.onopen`: ステータス更新、再接続カウントリセット
     - `ws.onmessage`: JSON parse、`onMessage`コールバック呼び出し
     - `ws.onclose`: 再接続ロジック（指数バックオフ）
     - `ws.onerror`: エラーログ、ステータス更新
     - `send(message: ClientMessage)`: JSON stringify、送信
     - `disconnect()`: 接続切断
     - クリーンアップ: `ws.close()`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement useWebSocket hook with auto-reconnect"

**useWebSocket フック仕様**:
```typescript
interface UseWebSocketReturn {
  send: (message: ClientMessage) => void;
  disconnect: () => void;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

function useWebSocket(
  sessionId: string,
  onMessage: (message: ServerMessage) => void
): UseWebSocketReturn;
```

**再接続ロジック**:
- 最大再接続回数: 5回
- 再接続間隔: `1000 * Math.pow(2, attemptCount)` ms
  - 1回目: 1秒
  - 2回目: 2秒
  - 3回目: 4秒
  - 4回目: 8秒
  - 5回目: 16秒
- 6回目以降: 再接続しない、ステータス`error`

**メッセージ型定義**:
```typescript
type ClientMessage =
  | { type: 'input'; content: string }
  | { type: 'approve'; requestId: string }
  | { type: 'deny'; requestId: string };

type ServerMessage =
  | { type: 'output'; content: string; subAgent?: SubAgent }
  | { type: 'permission_request'; permission: PermissionRequest }
  | { type: 'status_change'; status: SessionStatus }
  | { type: 'error'; content: string };

interface SubAgent {
  name: string;
  output: string;
}

interface PermissionRequest {
  requestId: string;
  action: string;
  details: string;
}

type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';
```

**エラーハンドリング**:
- WebSocket接続エラー: ステータス`error`、再接続試行
- メッセージパースエラー: エラーログ出力、無視
- 送信エラー: エラーログ出力、例外スロー

**受入基準**:
- [ ] `src/hooks/useWebSocket.ts`が存在する
- [ ] `src/types/websocket.ts`が存在する
- [ ] WebSocket接続が確立される
- [ ] `status`が`connecting` → `connected`に遷移する
- [ ] メッセージ受信時に`onMessage`コールバックが呼ばれる
- [ ] `send()`でメッセージ送信できる
- [ ] 切断時に自動再接続される
- [ ] 再接続間隔が指数バックオフになる
- [ ] 最大5回再接続後は再接続しない
- [ ] アンマウント時に`ws.close()`が呼ばれる
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク3.5（セッション詳細画面実装）完了
- タスク4.1（WebSocketサーバー実装）完了

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 25分

**ステータス**: `TODO`

---

## タスク4.3: リアルタイム更新統合

**説明**:
WebSocketを使用したリアルタイム更新を統合する
- セッション詳細画面でリアルタイム出力表示
- 権限確認リクエストのリアルタイム受信
- セッションステータスのリアルタイム更新
- セッション一覧のステータス自動更新

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでWebSocket統合
- `useWebSocket`フック使用
- ポーリング削除（タスク3.5で実装したポーリングを削除）
- 500ms以内の出力表示（NFR-001）

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `src/store/sessions.ts`更新 - WebSocket統合ロジック追加
- `src/app/sessions/[id]/page.tsx`更新 - `useWebSocket`統合
- `src/app/projects/[id]/page.tsx`更新 - ステータス自動更新
- `src/hooks/__tests__/websocket-integration.test.ts` - 統合テスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/hooks/__tests__/websocket-integration.test.ts`作成
     - メッセージ受信でZustandストア更新
     - 権限リクエスト受信でダイアログ表示
     - ステータス変更でストア更新
     - セッション一覧のステータス自動更新
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add WebSocket integration tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`更新
     - ポーリングロジック削除（`setInterval`削除）
     - `handleWebSocketMessage(message: ServerMessage): void`追加
       - `type: 'output'` → `messages`に追加
       - `type: 'permission_request'` → `permissionRequest`更新
       - `type: 'status_change'` → `status`更新、セッション一覧も更新
       - `type: 'error'` → エラー表示
   - `src/app/sessions/[id]/page.tsx`更新
     - `useWebSocket`フック呼び出し
     - `onMessage`で`handleWebSocketMessage`呼び出し
     - ポーリング削除（`setInterval`削除）
     - `send()`で入力送信
   - `src/app/projects/[id]/page.tsx`更新
     - WebSocket接続なし（セッション詳細のみ接続）
     - ステータス更新はZustandストア経由で自動反映
   - パフォーマンス最適化
     - メッセージ受信から表示まで500ms以内（NFR-001）
     - `useMemo`、`useCallback`で最適化
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Integrate WebSocket for realtime updates"

**handleWebSocketMessage仕様**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  handleWebSocketMessage: (message: ServerMessage) => void;
}

// 実装
handleWebSocketMessage: (message) => {
  switch (message.type) {
    case 'output':
      set((state) => ({
        messages: [...state.messages, {
          id: uuidv4(),
          role: 'assistant',
          content: message.content,
          timestamp: new Date().toISOString(),
          subAgent: message.subAgent
        }]
      }));
      break;
    case 'permission_request':
      set({ permissionRequest: message.permission });
      break;
    case 'status_change':
      set((state) => ({
        sessions: state.sessions.map(s =>
          s.id === state.selectedSessionId
            ? { ...s, status: message.status }
            : s
        )
      }));
      break;
    case 'error':
      set({ error: message.content });
      break;
  }
}
```

**パフォーマンス要件**:
- Claude Code出力受信から表示まで: 500ms以内（NFR-001）
- メッセージ受信頻度: 最大10メッセージ/秒
- メモリ使用量: メッセージ1000件まで保持、古いメッセージは削除

**エラーハンドリング**:
- WebSocket切断: 再接続メッセージ表示
- メッセージ受信エラー: エラーログ出力、無視
- ストア更新エラー: エラーログ出力、ユーザーに通知

**受入基準**:
- [ ] `src/store/sessions.ts`に`handleWebSocketMessage`が実装されている
- [ ] セッション詳細画面で`useWebSocket`が使用されている
- [ ] ポーリングロジックが削除されている
- [ ] Claude Code出力がリアルタイムで表示される
- [ ] 出力表示が500ms以内
- [ ] 権限確認ダイアログがリアルタイムで表示される
- [ ] セッションステータスがリアルタイムで更新される
- [ ] セッション一覧のステータスが自動更新される
- [ ] WebSocket切断時に再接続メッセージが表示される
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク3.5（セッション詳細画面実装）完了
- タスク4.1（WebSocketサーバー実装）完了
- タスク4.2（WebSocketクライアント実装）完了

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 25分

**ステータス**: `TODO`

---

## タスク4.4: npxパッケージ設定

**説明**:
`npx claude-work`で起動できるCLIパッケージを設定する
- package.jsonにbin設定追加
- CLIエントリーポイント作成
- ビルド設定（TypeScript → JavaScript）
- 環境変数設定
- 起動スクリプト作成

**技術的文脈**:
- package.json `bin`設定
- TypeScriptビルド（tsc）
- shebang（`#!/usr/bin/env node`）
- Node.js 20以上必須
- 環境変数: `AUTH_TOKEN`、`SESSION_SECRET`、`PORT`

**必要なパッケージ**:
```bash
# 追加パッケージなし（既存のTypeScriptコンパイラ使用）
```

**実装ファイル**:
- `src/bin/cli.ts` - CLIエントリーポイント
- `package.json`更新 - bin設定、スクリプト追加
- `.env.example` - 環境変数テンプレート
- `tsconfig.json`更新 - ビルド設定
- `README.md`更新 - 使用方法

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - 手動テスト: `npm run build && npx .`で起動確認
   - コミット: "Add CLI package configuration"

2. **実装フェーズ**:
   - `package.json`更新
     ```json
     {
       "name": "claude-work",
       "version": "0.1.0",
       "bin": {
         "claude-work": "./dist/bin/cli.js"
       },
       "scripts": {
         "dev": "ts-node --project tsconfig.server.json server.ts",
         "build": "npm run build:next && npm run build:server",
         "build:next": "next build",
         "build:server": "tsc --project tsconfig.server.json",
         "start": "node dist/server.js",
         "test": "vitest"
       },
       "files": [
         "dist",
         "public",
         ".next"
       ]
     }
     ```
   - `src/bin/cli.ts`作成
     ```typescript
     #!/usr/bin/env node
     import { spawn } from 'child_process';
     import path from 'path';

     const PORT = process.env.PORT || 3000;
     const AUTH_TOKEN = process.env.AUTH_TOKEN;
     const SESSION_SECRET = process.env.SESSION_SECRET;

     if (!AUTH_TOKEN) {
       console.error('Error: AUTH_TOKEN environment variable is required');
       process.exit(1);
     }

     if (!SESSION_SECRET) {
       console.error('Error: SESSION_SECRET environment variable is required');
       process.exit(1);
     }

     console.log(`Starting ClaudeWork on port ${PORT}...`);

     const serverPath = path.join(__dirname, '../server.js');
     const server = spawn('node', [serverPath], {
       stdio: 'inherit',
       env: { ...process.env, PORT: PORT.toString() }
     });

     server.on('exit', (code) => {
       process.exit(code || 0);
     });
     ```
   - `.env.example`作成
     ```
     # ClaudeWork Configuration

     # Authentication token (required)
     AUTH_TOKEN=your-secure-token-here

     # Session secret for cookie encryption (required, 32+ characters)
     SESSION_SECRET=your-32-character-or-longer-secret-key-here

     # Server port (optional, default: 3000)
     PORT=3000

     # Database path (optional, default: ./prisma/data/claudework.db)
     DATABASE_URL=file:./prisma/data/claudework.db
     ```
   - `tsconfig.server.json`更新
     ```json
     {
       "extends": "./tsconfig.json",
       "compilerOptions": {
         "module": "commonjs",
         "outDir": "dist",
         "rootDir": "."
       },
       "include": [
         "server.ts",
         "src/bin/**/*",
         "src/lib/**/*",
         "src/services/**/*"
       ]
     }
     ```
   - `README.md`更新（使用方法セクション追加）
   - ビルドテスト: `npm run build`
   - 起動テスト: `npx .`
   - コミット: "Implement CLI package with npx support"

**CLI起動フロー**:
1. ユーザー実行: `npx claude-work`
2. `src/bin/cli.ts`実行
3. 環境変数チェック（`AUTH_TOKEN`、`SESSION_SECRET`）
4. `server.js`をspawn
5. サーバー起動: `http://localhost:${PORT}`

**環境変数検証**:
- `AUTH_TOKEN`: 必須、未設定時はエラー終了
- `SESSION_SECRET`: 必須、32文字以上推奨、未設定時はエラー終了
- `PORT`: オプション、デフォルト3000
- `DATABASE_URL`: オプション、デフォルト`file:./prisma/data/claudework.db`

**ビルド成果物**:
- `dist/bin/cli.js` - CLIエントリーポイント（shebang付き）
- `dist/server.js` - Next.jsカスタムサーバー
- `dist/lib/**/*` - ライブラリファイル
- `dist/services/**/*` - サービスファイル
- `.next/` - Next.jsビルド成果物

**エラーハンドリング**:
- `AUTH_TOKEN`未設定: エラーメッセージ出力、終了コード1
- `SESSION_SECRET`未設定: エラーメッセージ出力、終了コード1
- ビルド失敗: エラーメッセージ出力、終了コード1
- サーバー起動失敗: エラーメッセージ出力、終了コード1

**受入基準**:
- [ ] `package.json`に`bin`設定が存在する
- [ ] `src/bin/cli.ts`が存在し、shebangが含まれる
- [ ] `.env.example`が存在する
- [ ] `tsconfig.server.json`が存在する
- [ ] `npm run build`でビルドが成功する
- [ ] `dist/bin/cli.js`が生成される
- [ ] `npx .`でサーバーが起動する
- [ ] 環境変数`AUTH_TOKEN`、`SESSION_SECRET`が必須である
- [ ] 環境変数`PORT`でポート変更可能
- [ ] SQLiteデータベースが`prisma/data/`ディレクトリに作成される
- [ ] README.mdに使用方法が記載されている
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] コミットメッセージが明確である

**依存関係**:
- タスク1.1（プロジェクト初期化）完了
- タスク1.4（データベース設定）完了
- タスク4.1（WebSocketサーバー実装）完了
- タスク4.3（リアルタイム更新統合）完了

**推定工数**: 45分（AIエージェント作業時間）
- 実装・テスト: 45分

**ステータス**: `TODO`

---

## タスク4.5: MVP E2Eテスト

**説明**:
MVP機能のE2Eテストを作成する
- ログインフロー
- プロジェクト追加フロー
- セッション作成〜Claude Code対話フロー
- Git操作フロー

**技術的文脈**:
- Playwright 1.x 使用
- TypeScript strict mode
- テスト用Gitリポジトリを自動作成
- ヘッドレスモード + ヘッド付きモード対応
- CI/CD対応

**必要なパッケージ**:
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**実装ファイル**:
- `e2e/login.spec.ts` - ログインE2Eテスト
- `e2e/projects.spec.ts` - プロジェクト管理E2Eテスト
- `e2e/sessions.spec.ts` - セッション作成・対話E2Eテスト
- `e2e/git-ops.spec.ts` - Git操作E2Eテスト
- `e2e/helpers/setup.ts` - テスト用セットアップヘルパー
- `playwright.config.ts` - Playwright設定
- `.github/workflows/e2e.yml` - CI設定（オプション）

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - Playwright設定: `npx playwright install`
   - `playwright.config.ts`作成
     - baseURL: `http://localhost:3000`
     - timeout: 30秒
     - retries: 2
   - `e2e/helpers/setup.ts`作成
     - テスト用Gitリポジトリ作成
     - クリーンアップ
   - `e2e/login.spec.ts`作成
     - ログインページ表示
     - 正しいトークンでログイン成功
     - 誤ったトークンでログイン失敗
   - `e2e/projects.spec.ts`作成
     - プロジェクト一覧表示
     - プロジェクト追加
     - プロジェクト削除
   - `e2e/sessions.spec.ts`作成
     - セッション作成
     - メッセージ送信
     - セッション停止
   - `e2e/git-ops.spec.ts`作成
     - diff表示
     - rebase実行
     - merge実行
   - テスト実行: `npx playwright test` → すべて失敗することを確認
   - コミット: "Add E2E tests for MVP features"

2. **テスト修正・パス確認**:
   - テスト実行: `npx playwright test`
   - 失敗箇所を修正
   - すべて通過することを確認
   - コミット: "Fix E2E tests"

**playwright.config.ts**:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**テスト用セットアップヘルパー**:
```typescript
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function createTestGitRepo(): Promise<string> {
  const tmpDir = path.join(__dirname, '../../tmp/test-repo');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  execSync('git init', { cwd: tmpDir });
  execSync('git config user.name "Test User"', { cwd: tmpDir });
  execSync('git config user.email "test@example.com"', { cwd: tmpDir });

  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Repo');
  execSync('git add .', { cwd: tmpDir });
  execSync('git commit -m "Initial commit"', { cwd: tmpDir });

  return tmpDir;
}

export async function cleanupTestGitRepo(repoPath: string): Promise<void> {
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true });
  }
}
```

**テストシナリオ例**:

**ログインテスト**:
```typescript
test('ログイン成功', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="password"]', process.env.AUTH_TOKEN);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
});
```

**プロジェクト追加テスト**:
```typescript
test('プロジェクト追加', async ({ page }) => {
  const repoPath = await createTestGitRepo();
  await page.goto('/');
  await page.click('text=プロジェクト追加');
  await page.fill('input[placeholder*="パス"]', repoPath);
  await page.click('text=追加');
  await expect(page.locator('text=test-repo')).toBeVisible();
  await cleanupTestGitRepo(repoPath);
});
```

**エラーハンドリング**:
- タイムアウト: リトライ2回
- サーバー起動失敗: エラーログ出力、テスト中止
- Git操作失敗: テストスキップ

**受入基準**:
- [ ] `playwright.config.ts`が存在する
- [ ] `e2e/login.spec.ts`が存在する
- [ ] `e2e/projects.spec.ts`が存在する
- [ ] `e2e/sessions.spec.ts`が存在する
- [ ] `e2e/git-ops.spec.ts`が存在する
- [ ] `e2e/helpers/setup.ts`が存在する
- [ ] ログインE2Eテストが通過する
- [ ] プロジェクト追加E2Eテストが通過する
- [ ] セッション作成E2Eテストが通過する
- [ ] Git操作E2Eテストが通過する
- [ ] `npm run e2e`で全テスト実行可能
- [ ] 全E2Eテストが通過する（`npx playwright test`）
- [ ] コミットメッセージが明確である

**依存関係**:
- タスク4.4（npxパッケージ設定）完了
- 全MVP機能（フェーズ1〜4）が実装済み

**推定工数**: 50分（AIエージェント作業時間）
- テスト作成・コミット: 30分
- テスト修正・パス確認・コミット: 20分

**ステータス**: `TODO`
