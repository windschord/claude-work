# 設計書

## アーキテクチャ概要

ClaudeWorkは、Next.js統合アーキテクチャを採用する。フロントエンド（Pages/Components）、バックエンド（API Routes）、WebSocketサーバー（カスタムサーバー）を1つのNext.jsプロジェクトに統合し、`npx claude-work`コマンドで起動する。バックエンドはClaude Code CLIプロセスを管理し、WebSocket経由でリアルタイム通信を行う。

```mermaid
graph TD
    subgraph "クライアント"
        Browser[ブラウザ]
        XTerm[XTerm.js]
    end

    subgraph "Next.js統合サーバー"
        subgraph "フロントエンド"
            Pages[Pages/Components]
            State[Zustand Store]
        end

        subgraph "バックエンド"
            APIRoutes[API Routes]
            CustomServer[カスタムサーバー]
            WSServer[WebSocket Server]
        end

        subgraph "サービス層"
            SessionMgr[Session Manager]
            ProcessMgr[Process Manager]
            GitOps[Git Operations]
            PTYMgr[PTY Manager]
        end
    end

    subgraph "外部プロセス"
        ClaudeCode[Claude Code CLI]
        Git[Git]
        Shell[Shell/PTY]
    end

    subgraph "永続化"
        SQLite[(SQLite)]
        FileSystem[File System]
    end

    Browser --> Pages
    XTerm --> WSServer
    Pages --> State
    Pages --> APIRoutes
    Browser --> WSServer

    APIRoutes --> SessionMgr
    APIRoutes --> GitOps
    WSServer --> SessionMgr
    WSServer --> PTYMgr

    SessionMgr --> ProcessMgr
    ProcessMgr --> ClaudeCode
    GitOps --> Git
    PTYMgr --> Shell

    SessionMgr --> SQLite
    ClaudeCode --> FileSystem
    Git --> FileSystem
```

## コンポーネント

### フロントエンド

#### コンポーネント: Pages

**目的**: ユーザーインターフェースの提供

**責務**:
- プロジェクト一覧・詳細の表示
- セッション一覧・詳細の表示
- Claude Codeの出力表示とユーザー入力
- Diff表示とGit操作UI
- ターミナルUI
- 認証画面

**主要ページ構成**:
- `/login` - ログインページ
- `/` - ダッシュボード（プロジェクト一覧）
- `/projects/[id]` - プロジェクト詳細（セッション一覧）
- `/sessions/[id]` - セッション詳細（Claude Code対話）

#### コンポーネント: Zustand Store

**目的**: クライアント状態管理

**責務**:
- プロジェクト・セッション状態の管理
- 認証状態の管理
- テーマ設定の管理
- WebSocket接続状態の管理

**ストア構成**:
```typescript
interface AppState {
  // 認証
  isAuthenticated: boolean;
  token: string | null;
  
  // プロジェクト
  projects: Project[];
  selectedProjectId: string | null;
  
  // セッション
  sessions: Session[];
  selectedSessionId: string | null;
  
  // UI
  theme: 'light' | 'dark' | 'system';
  isMobile: boolean;
}
```

#### コンポーネント: WebSocket Client

**目的**: リアルタイム通信の管理

**責務**:
- Claude Code出力のストリーミング受信
- ターミナル入出力の送受信
- ランスクリプト出力のストリーミング受信
- 接続状態の管理と自動再接続

### バックエンド

#### コンポーネント: API Routes

**目的**: CRUD操作とGit操作のエンドポイント提供

**責務**:
- プロジェクト管理API（Next.js API Routes）
- セッション管理API（Next.js API Routes）
- Git操作API（diff、rebase、merge）
- 認証API（Next.js API Routes）
- プロンプト履歴API

**実装場所**: `src/app/api/`配下

#### コンポーネント: WebSocket Server

**目的**: リアルタイム双方向通信

**責務**:
- Claude Code出力のブロードキャスト
- ユーザー入力のClaude Codeへの転送
- ターミナル入出力の中継
- 権限確認リクエストの送信

**実装場所**: カスタムサーバー（`server.ts`）にws/socket.ioで実装

#### コンポーネント: Session Manager

**目的**: セッションのライフサイクル管理

**責務**:
- セッションの作成・削除
- セッション状態の追跡
- 複数セッションの一括作成
- サーバー再起動後のセッション復元

#### コンポーネント: Process Manager

**目的**: Claude Codeプロセスの管理

**責務**:
- Claude Code CLIの起動・停止
- プロセス出力の監視とパース
- 権限確認リクエストの検出
- サブエージェント出力の検出
- プロセス異常終了の検出

**実装場所**: `src/services/process-manager.ts`（Node.js child_process使用）

#### コンポーネント: Git Operations

**目的**: Git操作の実行

**責務**:
- worktreeの作成・削除
- diff取得
- rebase実行
- squash & merge実行
- コミット履歴取得
- コミットへのリセット

**実装場所**: `src/services/git-service.ts`（Node.js child_process使用）

#### コンポーネント: PTY Manager

**目的**: ターミナルセッションの管理

**責務**:
- PTYプロセスの生成
- 入出力のWebSocket中継
- セッションごとのPTY管理
- ANSIエスケープシーケンスの透過的転送

**実装場所**: `src/services/pty-manager.ts`（node-ptyライブラリ使用）

## データフロー

### シーケンス: セッション作成

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as Frontend
    participant API as API Routes
    participant SM as Session Manager
    participant PM as Process Manager
    participant Git as Git Ops
    participant CC as Claude Code

    U->>F: セッション作成リクエスト
    F->>API: POST /api/sessions
    API->>SM: createSession()
    SM->>Git: createWorktree()
    Git-->>SM: worktree path
    SM->>PM: startClaudeCode(path, prompt)
    PM->>CC: claude --print (child_process)
    CC-->>PM: プロセス開始
    PM-->>SM: process info
    SM->>SM: セッション情報をDB保存
    SM-->>API: session created
    API-->>F: 201 Created
    F-->>U: セッション一覧更新
```

### シーケンス: Claude Code対話

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as Frontend
    participant WS as WebSocket
    participant SM as Session Manager
    participant PM as Process Manager
    participant CC as Claude Code

    U->>F: メッセージ入力
    F->>WS: send(message)
    WS->>SM: handleInput(sessionId, message)
    SM->>PM: sendInput(processId, message)
    PM->>CC: stdin write
    
    loop 出力ストリーム
        CC-->>PM: stdout/stderr
        PM-->>SM: parseOutput()
        SM-->>WS: broadcast(output)
        WS-->>F: onMessage(output)
        F-->>U: 出力表示
    end
```

### シーケンス: 権限確認

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as Frontend
    participant WS as WebSocket
    participant SM as Session Manager
    participant PM as Process Manager
    participant CC as Claude Code

    CC->>PM: 権限確認プロンプト出力
    PM->>SM: permissionRequest detected
    SM->>WS: broadcast(permissionRequest)
    WS->>F: onPermissionRequest
    F->>U: 承認/拒否ダイアログ表示
    U->>F: 承認クリック
    F->>WS: send(approval)
    WS->>SM: handleApproval()
    SM->>PM: sendInput("y")
    PM->>CC: stdin write
    CC-->>PM: 処理続行
```

### シーケンス: ターミナル操作

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant XT as XTerm.js
    participant WS as WebSocket
    participant PTY as PTY Manager
    participant Shell as Shell Process

    U->>XT: キー入力
    XT->>WS: send(input)
    WS->>PTY: handleInput(sessionId, input)
    PTY->>Shell: stdin write
    Shell-->>PTY: stdout/stderr
    PTY-->>WS: broadcast(output)
    WS-->>XT: onMessage(output)
    XT-->>U: 出力表示
```

## API設計

### 認証

#### POST /api/auth/login
**目的**: トークン認証によるログイン

**リクエスト**:
```json
{
  "token": "user-provided-token"
}
```

**レスポンス（200）**:
```json
{
  "session_id": "uuid",
  "expires_at": "2025-12-08T12:00:00Z"
}
```

**レスポンス（401）**:
```json
{
  "error": "Invalid token"
}
```

#### POST /api/auth/logout
**目的**: ログアウト

**レスポンス（200）**:
```json
{
  "message": "Logged out successfully"
}
```

### プロジェクト

#### GET /api/projects
**目的**: プロジェクト一覧取得

**レスポンス（200）**:
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "my-project",
      "path": "/path/to/repo",
      "default_model": "auto",
      "run_scripts": [
        {"name": "test", "command": "npm test"},
        {"name": "build", "command": "npm run build"}
      ],
      "session_count": 3,
      "created_at": "2025-12-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/projects
**目的**: プロジェクト追加

**リクエスト**:
```json
{
  "path": "/path/to/git/repo",
  "default_model": "auto",
  "run_scripts": []
}
```

**レスポンス（201）**:
```json
{
  "id": "uuid",
  "name": "repo-name",
  "path": "/path/to/git/repo"
}
```

**レスポンス（400）**:
```json
{
  "error": "Not a Git repository"
}
```

#### PUT /api/projects/{id}
**目的**: プロジェクト設定更新

**リクエスト**:
```json
{
  "default_model": "sonnet",
  "run_scripts": [
    {"name": "test", "command": "npm test"}
  ]
}
```

#### DELETE /api/projects/{id}
**目的**: プロジェクト削除（worktreeは保持）

### セッション

#### GET /api/projects/{project_id}/sessions
**目的**: セッション一覧取得

**レスポンス（200）**:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "name": "feature-auth",
      "status": "running",
      "git_status": "dirty",
      "model": "sonnet",
      "worktree_path": "/path/to/worktree",
      "created_at": "2025-12-08T10:00:00Z"
    }
  ]
}
```

#### POST /api/projects/{project_id}/sessions
**目的**: セッション作成（単一または複数）

**リクエスト**:
```json
{
  "name": "feature",
  "prompt": "Implement user authentication",
  "model": "auto",
  "count": 3
}
```

**レスポンス（201）**:
```json
{
  "sessions": [
    {"id": "uuid1", "name": "feature-1"},
    {"id": "uuid2", "name": "feature-2"},
    {"id": "uuid3", "name": "feature-3"}
  ]
}
```

#### GET /api/sessions/{id}
**目的**: セッション詳細取得

**レスポンス（200）**:
```json
{
  "id": "uuid",
  "name": "feature-auth",
  "status": "waiting_input",
  "git_status": "dirty",
  "model": "sonnet",
  "worktree_path": "/path/to/worktree",
  "messages": [
    {
      "role": "user",
      "content": "Implement auth",
      "timestamp": "2025-12-08T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I'll implement...",
      "timestamp": "2025-12-08T10:00:05Z",
      "sub_agents": [
        {"name": "file_edit", "output": "..."}
      ]
    }
  ]
}
```

#### POST /api/sessions/{id}/input
**目的**: セッションへの入力送信（REST fallback）

**リクエスト**:
```json
{
  "content": "Please also add tests"
}
```

#### POST /api/sessions/{id}/approve
**目的**: 権限承認

**リクエスト**:
```json
{
  "approved": true
}
```

#### POST /api/sessions/{id}/stop
**目的**: セッション停止

#### DELETE /api/sessions/{id}
**目的**: セッション削除（worktreeも削除）

### Git操作

#### GET /api/sessions/{id}/diff
**目的**: mainブランチとの差分取得

**レスポンス（200）**:
```json
{
  "files": [
    {
      "path": "src/auth.ts",
      "status": "modified",
      "additions": 45,
      "deletions": 12,
      "hunks": [
        {
          "old_start": 10,
          "old_lines": 5,
          "new_start": 10,
          "new_lines": 8,
          "content": "@@ -10,5 +10,8 @@\n-old line\n+new line"
        }
      ]
    }
  ],
  "total_additions": 45,
  "total_deletions": 12
}
```

#### GET /api/sessions/{id}/commits
**目的**: コミット履歴取得

**レスポンス（200）**:
```json
{
  "commits": [
    {
      "hash": "abc123",
      "short_hash": "abc123",
      "message": "Add authentication",
      "author": "Claude",
      "date": "2025-12-08T10:05:00Z",
      "files_changed": 3
    }
  ]
}
```

#### POST /api/sessions/{id}/rebase
**目的**: mainからのrebase

**レスポンス（200）**:
```json
{
  "success": true
}
```

**レスポンス（409）**:
```json
{
  "error": "Conflict detected",
  "conflicting_files": ["src/auth.ts"]
}
```

#### POST /api/sessions/{id}/reset
**目的**: 特定コミットへのリセット

**リクエスト**:
```json
{
  "commit_hash": "abc123"
}
```

#### POST /api/sessions/{id}/merge
**目的**: mainへのsquash merge

**リクエスト**:
```json
{
  "commit_message": "feat: Add user authentication",
  "delete_worktree": true
}
```

### ランスクリプト

#### POST /api/sessions/{id}/run
**目的**: ランスクリプト実行

**リクエスト**:
```json
{
  "script_name": "test"
}
```

**レスポンス（202）**:
```json
{
  "run_id": "uuid"
}
```

#### POST /api/sessions/{id}/run/{run_id}/stop
**目的**: ランスクリプト停止

### プロンプト履歴

#### GET /api/prompts
**目的**: プロンプト履歴取得

**レスポンス（200）**:
```json
{
  "prompts": [
    {
      "id": "uuid",
      "content": "Implement user auth",
      "used_count": 3,
      "last_used_at": "2025-12-08T10:00:00Z"
    }
  ]
}
```

#### DELETE /api/prompts/{id}
**目的**: プロンプト履歴削除

## WebSocket API

### 接続

```
ws://host/ws/sessions/{session_id}
```

### メッセージ形式

#### クライアント → サーバー

```json
{
  "type": "input" | "approve" | "deny",
  "content": "string (for input)",
  "request_id": "string (for approve/deny)"
}
```

#### サーバー → クライアント

```json
{
  "type": "output" | "permission_request" | "status_change" | "error",
  "content": "string",
  "sub_agent": {
    "name": "string",
    "output": "string"
  },
  "permission": {
    "request_id": "string",
    "action": "string",
    "details": "string"
  },
  "status": "initializing" | "running" | "waiting_input" | "completed" | "error"
}
```

### ターミナルWebSocket

```
ws://host/ws/terminal/{session_id}
```

バイナリデータとして入出力を送受信。

## データベーススキーマ

### テーブル: projects

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | プロジェクト名 |
| path | TEXT | NOT NULL UNIQUE | Gitリポジトリパス |
| default_model | TEXT | DEFAULT 'auto' | デフォルトモデル |
| run_scripts | TEXT | | JSON形式のランスクリプト配列 |
| created_at | TEXT | NOT NULL | 作成日時（ISO 8601） |
| updated_at | TEXT | NOT NULL | 更新日時（ISO 8601） |

### テーブル: sessions

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| project_id | TEXT | FOREIGN KEY | プロジェクトID |
| name | TEXT | NOT NULL | セッション名 |
| status | TEXT | NOT NULL | ステータス |
| model | TEXT | NOT NULL | 使用モデル |
| worktree_path | TEXT | NOT NULL | worktreeパス |
| branch_name | TEXT | NOT NULL | ブランチ名 |
| created_at | TEXT | NOT NULL | 作成日時 |
| updated_at | TEXT | NOT NULL | 更新日時 |

### テーブル: messages

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| session_id | TEXT | FOREIGN KEY | セッションID |
| role | TEXT | NOT NULL | user/assistant |
| content | TEXT | NOT NULL | メッセージ内容 |
| sub_agents | TEXT | | JSON形式のサブエージェント出力 |
| created_at | TEXT | NOT NULL | 作成日時 |

### テーブル: prompts

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| content | TEXT | NOT NULL UNIQUE | プロンプト内容 |
| used_count | INTEGER | DEFAULT 1 | 使用回数 |
| last_used_at | TEXT | NOT NULL | 最終使用日時 |
| created_at | TEXT | NOT NULL | 作成日時 |

### テーブル: auth_sessions

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | セッションID |
| token_hash | TEXT | NOT NULL | トークンハッシュ |
| expires_at | TEXT | NOT NULL | 有効期限 |
| created_at | TEXT | NOT NULL | 作成日時 |

## 技術的決定事項

### 決定1: Next.js統合アーキテクチャを採用

**検討した選択肢**:
1. Next.js統合構成 - フロントエンドとバックエンドを1つのプロジェクトに統合
2. Monorepo構成 - フロントエンド(Next.js) + バックエンド(Fastify)を別プロセスで実行

**決定**: Next.js統合構成

**根拠**:
- `npx claude-work`1コマンドで起動できるシンプルさ
- 技術スタックがTypeScriptに統一され、型共有が容易
- デプロイが容易（単一プロセス）
- Next.jsカスタムサーバーでWebSocket統合が可能

### 決定2: データベースにSQLiteを採用

**検討した選択肢**:
1. SQLite - シンプル、ファイルベース、セットアップ不要
2. PostgreSQL - 高機能、スケーラブル、複雑なクエリ対応

**決定**: SQLite（better-sqlite3）

**根拠**:
- 単一ユーザー向けローカル環境では十分な性能
- セットアップ不要でnpmインストールのみで完結
- バックアップがファイルコピーで完了
- better-sqlite3は高速で同期APIが使いやすい

### 決定3: 状態管理にZustandを採用

**検討した選択肢**:
1. Zustand - シンプル、軽量、TypeScript親和性
2. Redux Toolkit - 豊富なエコシステム、複雑
3. Jotai - アトミック、シンプル

**決定**: Zustand

**根拠**:
- APIがシンプルでボイラープレートが少ない
- TypeScriptとの相性が良い
- 中規模アプリケーションに適切なサイズ

### 決定4: プロセス管理にNode.js child_processを採用

**検討した選択肢**:
1. child_process - Node.js標準、非同期I/O対応
2. node-pty - PTY制御、ターミナルエミュレーション

**決定**: child_process（Claude Code用）+ node-pty（ターミナル用）

**根拠**:
- Claude Codeはパイプベースで十分
- ターミナル機能はPTY（node-pty）が必須
- 用途に応じた適切な選択
- Node.js標準APIで追加依存が少ない

### 決定5: 認証方式にトークンベース認証を採用

**検討した選択肢**:
1. トークンベース認証 - シンプル、環境変数で設定
2. OAuth2 - 外部IdP連携、複雑
3. Basic認証 - 最シンプル、セキュリティ懸念

**決定**: トークンベース認証

**根拠**:
- 単一ユーザー向けで十分なセキュリティ
- 環境変数での設定が容易
- リバースプロキシと組み合わせて使用

## セキュリティ考慮事項

### 認証・認可

- トークンは環境変数`AUTH_TOKEN`で設定
- トークンはbcryptでハッシュ化して比較
- セッションは24時間で期限切れ
- HTTPOnlyクッキーでセッションID管理

### 通信

- 開発環境はHTTP、本番環境ではリバースプロキシ（Caddy/nginx推奨）でHTTPS化
- WebSocket接続も認証済みセッションでのみ許可
- CORS設定で許可オリジンを制限

### プロセス実行

- Claude Codeは指定されたworktree内でのみ実行
- ターミナルセッションも同様にworktree内に制限
- ランスクリプトは事前に登録されたコマンドのみ実行可能

### 入力検証

- パス入力はディレクトリトラバーサル攻撃を防止
- すべての入力はサニタイズ
- SQLインジェクション対策としてパラメータ化クエリを使用

## パフォーマンス考慮事項

### リアルタイム通信

- WebSocketで500ms以内の出力表示を実現
- 出力バッファリングは100ms単位で実施
- 大量出力時は自動的にスロットリング

### 並列セッション

- 10セッションまでの並列実行をサポート
- 各セッションは独立したプロセスで管理
- メモリ使用量の監視と制限

### データベース

- インデックス: sessions(project_id), messages(session_id)
- 古いメッセージは定期的にアーカイブ
- SQLite WALモードで読み取り性能向上

## エラー処理

### Claude Codeプロセス

- 異常終了時はステータスを「error」に更新
- 終了コードとstderrをエラーメッセージとして保存
- 自動再起動は行わない（ユーザーの明示的な操作を要求）

### Git操作

- rebase失敗時はコンフリクトファイルを通知
- merge失敗時はロールバック
- worktree作成失敗時は詳細なエラーメッセージを返却

### WebSocket

- 接続切断時は自動再接続（最大5回、指数バックオフ）
- 再接続後は最新状態を自動同期
- 永続的な接続失敗時はREST APIにフォールバック

### 一般的なエラー

- すべてのAPIエラーは統一フォーマットで返却
- エラーログはJSON形式で出力
- クリティカルエラーは別ファイルにも記録
