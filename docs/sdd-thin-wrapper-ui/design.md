# 設計書: 薄いラッパーUI

## アーキテクチャ概要

### 現在のアーキテクチャ（Before）

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  MessageList → MessageBubble → MessageDisplay       │    │
│  │  (Markdownレンダリング、コードブロック表示)           │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↑                                   │
│                    WebSocket (parsed messages)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                      Backend                                 │
│  ┌───────────────────────┴───────────────────────────┐      │
│  │  ProcessManager                                    │      │
│  │  - Claude Code (--print --output-format stream-json)│      │
│  │  - 出力パース → メッセージ変換                      │      │
│  │  - 権限リクエスト検出 → WebSocket送信               │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 新アーキテクチャ（After）

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  XTerm.js Terminal                                  │    │
│  │  (Claude Codeの出力をそのまま表示)                   │    │
│  │  - 入力 → WebSocket送信                             │    │
│  │  - 受信 → terminal.write()                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↑↓                                  │
│                    WebSocket (raw PTY data)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                      Backend                                 │
│  ┌───────────────────────┴───────────────────────────┐      │
│  │  ClaudePTYManager (新規)                           │      │
│  │  - node-pty でClaude Codeを起動                    │      │
│  │  - 対話モード（--printフラグなし）                  │      │
│  │  - stdin/stdout/stderrをそのまま転送               │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント設計

### 1. ClaudePTYManager（新規）

**目的**: Claude CodeプロセスをPTYで管理し、対話的なターミナルセッションを提供

**ファイル**: `src/services/claude-pty-manager.ts`

**責務**:
- Claude Codeプロセスの起動（node-pty使用）
- stdin/stdout/stderrの双方向転送
- プロセスライフサイクル管理（起動、停止、再起動）
- ターミナルサイズ変更の処理

**インターフェース**:
```typescript
interface ClaudePTYManager {
  // セッション管理
  createSession(sessionId: string, worktreePath: string, prompt?: string): IPty;
  getSession(sessionId: string): IPty | undefined;
  destroySession(sessionId: string): void;

  // プロセス制御
  restartSession(sessionId: string): void;

  // ターミナル操作
  write(sessionId: string, data: string): void;
  resize(sessionId: string, cols: number, rows: number): void;

  // イベント
  on(event: 'data', listener: (sessionId: string, data: string) => void): void;
  on(event: 'exit', listener: (sessionId: string, exitCode: number) => void): void;
}
```

**Claude Code起動オプション**:
```typescript
const pty = spawn('claude', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: worktreePath,
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  },
});

// 初期プロンプトがあれば送信
if (prompt) {
  pty.write(prompt + '\n');
}
```

### 2. ClaudeWebSocketHandler（新規）

**目的**: Claude CodeターミナルのWebSocket接続を管理

**ファイル**: `src/lib/websocket/claude-ws.ts`

**責務**:
- WebSocket接続の認証
- PTYデータの双方向転送
- 接続管理（複数クライアント対応）

**WebSocketメッセージ形式**:
```typescript
// クライアント → サーバー
interface ClientMessage {
  type: 'input' | 'resize';
  data: string | { cols: number; rows: number };
}

// サーバー → クライアント
interface ServerMessage {
  type: 'data' | 'exit';
  content?: string;
  exitCode?: number;
}
```

**エンドポイント**: `/ws/claude/:sessionId`

### 3. ClaudeTerminalPanel（新規）

**目的**: Claude Code専用のターミナルUIコンポーネント

**ファイル**: `src/components/sessions/ClaudeTerminalPanel.tsx`

**責務**:
- XTerm.jsインスタンスの管理
- WebSocket接続（useClaudeTerminal hook使用）
- リサイズ処理
- 接続状態表示

**Props**:
```typescript
interface ClaudeTerminalPanelProps {
  sessionId: string;
  isVisible: boolean;
}
```

### 4. useClaudeTerminal Hook（新規）

**目的**: Claude Codeターミナル用のWebSocket接続を管理

**ファイル**: `src/hooks/useClaudeTerminal.ts`

**責務**:
- WebSocket接続の確立と維持
- XTerm.jsインスタンスとの連携
- 自動再接続

**インターフェース**:
```typescript
interface UseClaudeTerminalReturn {
  terminal: Terminal | null;
  isConnected: boolean;
  error: string | null;
  fit: () => void;
  restart: () => void;
}

function useClaudeTerminal(sessionId: string): UseClaudeTerminalReturn;
```

### 5. SessionDetailPage（変更）

**目的**: セッション詳細ページのレイアウト変更

**ファイル**: `src/app/sessions/[id]/page.tsx`

**変更内容**:
- MessageList、MessageBubble、MessageDisplay を削除
- メッセージ入力欄を削除
- 新しいタブ構成:
  - **Claude**（デフォルト）: ClaudeTerminalPanel
  - **Shell**: TerminalPanel（既存）
  - **Diff**: DiffViewer（既存）
  - **Commits**: CommitHistory（既存）
  - **Scripts**: ScriptRunner（既存）

## データフロー

### 入力フロー（ユーザー → Claude Code）

```
1. ユーザーがターミナルにキー入力
   ↓
2. XTerm.js の onData イベント発火
   ↓
3. WebSocket経由でサーバーに送信
   { type: 'input', data: 'キー入力データ' }
   ↓
4. ClaudeWebSocketHandler が受信
   ↓
5. ClaudePTYManager.write(sessionId, data)
   ↓
6. node-pty が Claude Code プロセスの stdin に書き込み
```

### 出力フロー（Claude Code → ユーザー）

```
1. Claude Code が stdout/stderr に出力
   ↓
2. node-pty の onData イベント発火
   ↓
3. ClaudePTYManager が 'data' イベント発火
   ↓
4. ClaudeWebSocketHandler が WebSocket で送信
   { type: 'data', content: '出力データ' }
   ↓
5. useClaudeTerminal が受信
   ↓
6. terminal.write(content) で表示
```

## 削除されるコンポーネント

| コンポーネント | ファイル | 理由 |
|--------------|---------|------|
| MessageList | src/components/session/MessageList.tsx | ターミナル表示に統合 |
| MessageBubble | src/components/session/MessageBubble.tsx | ターミナル表示に統合 |
| MessageDisplay | src/components/sessions/MessageDisplay.tsx | ターミナル表示に統合 |
| CodeBlock | src/components/sessions/CodeBlock.tsx | ターミナル表示に統合 |
| PermissionDialog | src/components/sessions/PermissionDialog.tsx | ターミナル内で応答 |
| MessageInput | src/components/session/MessageInput.tsx | ターミナルに直接入力 |

## 変更されるコンポーネント

| コンポーネント | 変更内容 |
|--------------|---------|
| ProcessManager | --printフラグを使用しない起動オプションを追加 |
| SessionWebSocketHandler | Claude PTY用の新しいハンドラーを追加 |
| server.ts | /ws/claude/:id エンドポイントを追加 |

## API設計

### WebSocketエンドポイント

| エンドポイント | 用途 |
|---------------|------|
| /ws/claude/:sessionId | Claude Codeターミナル（新規） |
| /ws/terminal/:sessionId | シェルターミナル（既存） |
| /ws/sessions/:sessionId | セッション状態通知用（簡略化） |

### REST API（変更なし）

既存のセッション管理APIはそのまま維持:
- POST /api/projects/:projectId/sessions
- GET /api/sessions/:id
- DELETE /api/sessions/:id
- POST /api/sessions/:id/restart

## 技術的決定事項

### 決定1: Claude Code起動方法

**検討した選択肢**:
- A) --printフラグ + stream-json出力（現在）
- B) 対話モード + PTY（新規）

**決定**: B) 対話モード + PTY

**根拠**:
- Claude Codeの全機能（色、カーソル移動、対話モード）を利用可能
- 出力パースが不要でシンプル
- ユーザーがCLIと同じ操作感で使用可能

### 決定2: 初期プロンプトの送信方法

**検討した選択肢**:
- A) PTY起動後に自動送信
- B) ユーザーが手動で入力

**決定**: A) PTY起動後に自動送信

**根拠**:
- セッション作成時のワークフローを維持
- 既存のセッション作成フォームとの互換性

### 決定3: メッセージ履歴の保存

**検討した選択肢**:
- A) 全出力をデータベースに保存
- B) 保存しない（ターミナルのスクロールバックのみ）
- C) セッションメタデータのみ保存

**決定**: C) セッションメタデータのみ保存

**根拠**:
- ターミナル出力には制御文字が多く含まれ、DB保存に不向き
- XTerm.jsのスクロールバックで直近の履歴は参照可能
- ストレージ効率が良い

## UI設計

### セッション詳細ページレイアウト

```
┌─────────────────────────────────────────────────────────────┐
│  [セッション名]  Status: running  Model: auto               │
│  [戻る] [停止] [再起動]                                      │
├─────────────────────────────────────────────────────────────┤
│  [Claude] [Shell] [Diff] [Commits] [Scripts]                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │           XTerm.js Terminal                          │    │
│  │           (Claude Code / Shell)                      │    │
│  │                                                      │    │
│  │                                                      │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### タブの状態管理

- 各タブのコンテンツは常にDOMにレンダリング
- CSSのhiddenクラスで非表示を制御
- ターミナルの状態（接続、履歴）はタブ切り替え時も維持

## セキュリティ考慮事項

- WebSocket認証は既存のクッキーベース認証を継続
- PTYプロセスはworktreeディレクトリに制限
- 環境変数は既存のフィルタリングを適用
