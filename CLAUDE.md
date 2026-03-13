# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaudeWork is a web-based tool for managing multiple Claude Code sessions through a browser interface. It uses Git worktrees to isolate each session in its own environment, allowing parallel execution of multiple Claude Code instances.

## Architecture

### Core Components

**Server Architecture** (server.ts):
- Custom Next.js server with multiple WebSocket servers:
  - Claude WebSocket (`/ws/claude/:id`): Claude Code PTY terminal (interactive mode)
  - Session WebSocket (`/ws/sessions/:id`): Session events and script execution
  - Terminal WebSocket (`/ws/terminal/:id`): Shell PTY sessions
- WebSocket connection pooling
- Connection pooling via ConnectionManager

**Session Management**:
- Each session creates an isolated Git worktree under `.worktrees/<session-name>/`
- ClaudePTYManager spawns Claude Code in interactive mode using node-pty
- PTYManager handles shell terminal sessions using node-pty
- Sessions are persisted in SQLite via Drizzle ORM
- UI provides a thin wrapper around Claude Code terminal (XTerm.js)

**Git Integration** (src/services/git-service.ts):
- Manages worktree creation/deletion
- Handles rebase, squash merge, and diff operations
- Path traversal protection via name validation
- All worktrees isolated in `.worktrees/` directory

**WebSocket Flow** (Claude Terminal):
1. Client connects to `/ws/claude/:sessionId`
2. ClaudePTYManager creates PTY session for Claude Code (interactive mode)
3. XTerm.js on client displays raw terminal output from Claude Code
4. User input from terminal sent to PTY via WebSocket

### Database Schema

Key models (src/db/schema.ts):
- **Project**: Git repository with default model setting, remote_url, and clone_location
- **Session**: Links to project, has worktree_path and branch_name, environment_id
- **Message**: Chat history with role/content
- **RunScript**: Custom scripts per project
- **ExecutionEnvironment**: Execution environment configuration (HOST, DOCKER, SSH)
- **GitHubPAT**: GitHub Personal Access Tokens for HTTPS private repository cloning

### Execution Environments

Claude Code can run in different execution environments:

**Environment Types**:
- **DOCKER**: Isolated execution in Docker containers (default, recommended)
- **HOST**: Direct execution on the local machine
- **SSH**: Remote execution (not yet implemented)

**Key Features**:
- Docker is the default execution environment for security and isolation
- Each Docker environment has isolated authentication directory (`data/environments/<env-id>/`)
- Sessions can specify which environment to use via `environment_id`
- Legacy `docker_mode` parameter is deprecated but still supported for backward compatibility
- Default Docker environment is auto-created on server startup
- SSH keys are mounted read-only from `~/.ssh/` for private repository access

**Architecture**:
- `EnvironmentService`: CRUD operations and status checking
- `EnvironmentAdapter` interface: Abstract PTY operations
- `HostAdapter`: Wraps ClaudePTYManager for local execution
- `DockerAdapter`: Manages Docker containers with isolated auth
- `AdapterFactory`: Singleton factory for adapters

**UI**:
- Environment management page: `/settings/environments`
- Session creation form includes environment selector
- Session list shows environment badges (HOST=green, DOCKER=blue, SSH=purple)

### Frontend Architecture

- Next.js 15 App Router with TypeScript
- State management: Zustand stores in `src/store/`
- WebSocket hooks: `useClaudeTerminal.ts`, `useTerminal.ts`, `useWebSocket.ts`
- Terminal: XTerm.js for Claude Code and shell terminals
- Theme support: next-themes (light/dark/system)
- UI: Tailwind CSS, Headless UI, Lucide icons

## Development Commands

### Essential Commands

```bash
# Development server (direct)
npm run dev

# Development server (pm2 managed - recommended)
npm run dev:pm2           # Start with pm2
npm run dev:stop          # Stop dev server
npm run dev:restart       # Restart dev server
npm run dev:logs          # View dev server logs

# Production server (pm2 managed)
npm run prod:start        # Start production server
npm run prod:stop         # Stop production server
npm run prod:restart      # Restart production server
npm run prod:logs         # View production server logs

# PM2 general commands
npm run pm2:status        # Check process status
npm run pm2:stop          # Stop all processes
npm run pm2:delete        # Remove from pm2 registry

# Testing
npm test                  # Run all unit tests (vitest)
npm run test:watch        # Watch mode
npm run test:watch:pm2    # Watch mode with pm2

# E2E Testing
npm run e2e               # Playwright tests
npm run e2e:ui            # Interactive UI mode
npm run e2e:headed        # Show browser

# Build
npm run build             # Build both Next.js and server
npm run build:next        # Next.js only
npm run build:server      # TypeScript server only

# Database
npm run db:generate       # Generate Drizzle migrations
npm run db:push           # Push schema to database
npm run db:studio         # Database GUI

# Linting
npm run lint              # ESLint
```

### Running Single Tests

```bash
# Run specific test file
npm test -- src/lib/__tests__/auth.test.ts

# Run tests matching pattern
npm test -- --grep "WebSocket"

# Run with coverage
npm test -- --coverage
```

### PM2 Process Management

The project uses pm2 for process management to avoid orphaned background processes:

```bash
# Individual process control
npm run dev:pm2          # Start dev server only
npm run test:pm2         # Start test runner only
npm run test:watch:pm2   # Start test watcher only

# Bulk operations
npm run pm2:start        # Start all defined processes
npm run pm2:restart      # Restart all processes
npm run pm2:monit        # Live monitoring dashboard
```

Configuration in `ecosystem.config.js` defines:
- claude-work-dev: Development server
- claude-work-test: One-time test execution
- claude-work-test-watch: Continuous test watcher

## Environment Setup

### Running the Application (Production)

```bash
docker compose up -d           # バックグラウンドで起動
docker compose down            # 停止
docker compose pull && docker compose up -d  # 最新イメージに更新
docker compose logs -f         # ログ表示
```

### Required Environment Variables

`docker-compose.yml` の `environment` セクションで `DATABASE_URL=file:/data/claudework.db` が固定設定される。`.env` の `DATABASE_URL` では上書きできない（`environment` が `env_file` より優先）。変更するには `docker-compose.yml` を直接編集する。

### Optional Variables

- `HOST_PORT`: Host port for Docker Compose (default: 3000)
- `PORT`: Server port (default: 3000, Docker Compose では固定)
- `NODE_ENV`: development/production (Docker Compose では production に固定)
- `LOG_LEVEL`: winston log level (default: info)
- `CLAUDE_CODE_PATH`: Path to claude CLI (default: 'claude')
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)
- `ALLOWED_PROJECT_DIRS`: Restrict project directories
- `DOCKER_GID`: Docker group GID for docker.sock access (Linux only)

See `docs/ENV_VARS.md` for complete reference.

## Critical Implementation Details

### Claude Code Process Management

ClaudePTYManager spawns Claude Code in interactive mode using node-pty:
- Interactive terminal mode (no `--print` flag)
- Working directory set to the worktree path via PTY spawn options
- Raw terminal I/O streamed via WebSocket to XTerm.js client

The thin wrapper architecture means:
- No parsing of Claude Code output on the server
- User interacts directly with Claude Code's native terminal interface
- All Claude Code features (tool use, permissions, etc.) work natively

### Git Worktree Isolation

Each session:
1. Creates branch `session/<session-name>`
2. Creates worktree at `.worktrees/<session-name>/`
3. Runs Claude Code with cwd set to worktree path
4. On deletion, removes worktree and prunes references

Security: All paths validated against `.worktrees/` base to prevent traversal attacks.

### Database Migrations

Drizzle ORM schema changes require:

```bash
# Update schema definition
# Edit src/db/schema.ts

# Apply schema changes to SQLite
npm run db:push

# Generate migration files (optional)
npm run db:generate
```

Note: Using `db:push` instead of migrations for SQLite simplicity.

## Testing Strategy

### Unit Tests (Vitest)

- **Services**: Mock child_process, fs operations
- **WebSocket**: Mock ws library, use EventEmitter for testing
- **API Routes**: Mock Next.js request/response
- Location: `**/__tests__/` directories

### E2E Tests (Playwright)

- Full browser automation
- Tests WebSocket connections, UI interactions
- Requires dev server running on port 3000
- Screenshots saved to `test-screenshots/`

### Integration Tests

Manual testing script: `npm run integration-test`
- Starts dev server with test credentials
- Provides interactive checklist
- Results documented in `docs/integration-test-report.md`

## Common Development Patterns

### Adding a New API Route

1. Create route file: `src/app/api/[path]/route.ts`
2. Export HTTP method handlers: `GET`, `POST`, `PUT`, `DELETE`
3. Validate request parameters
4. Return `NextResponse.json()` for responses
5. Create test file: `src/app/api/[path]/__tests__/route.test.ts`

### Adding WebSocket Message Type

1. Update `src/types/websocket.ts` with new message type
2. Handle in `SessionWebSocketHandler.handleConnection()`
3. Add client-side handling in `src/hooks/useWebSocket.ts`
4. Test in `src/hooks/__tests__/useWebSocket.test.ts`

### Adding Database Model

1. Update `src/db/schema.ts`
2. Run `npm run db:push`
3. Create service layer in `src/lib/` or `src/services/`
4. Add tests for database operations

## Known Issues

See `docs/sdd/archive/completed-phases.md` for historical phase information.

1. **Low**: Next.js HMR WebSocket 404 in custom server mode (expected behavior with custom server)
2. **Low**: Multiple lockfile warning (remove package-lock.json)

Previous critical issues with Claude Code --cwd option and WebSocket connections have been resolved.
For detailed troubleshooting information, see `docs/sdd/troubleshooting/`.

## Project Structure

```text
├── server.ts                 # Custom Next.js server with WebSocket
├── ecosystem.config.js       # PM2 process configuration
├── data/                     # SQLite database files (バックアップ対象)
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   │   └── environments/  # Environment management API
│   │   ├── settings/       # Settings pages
│   │   │   └── environments/  # Environment management UI
│   │   └── (pages)/        # Frontend pages
│   ├── components/          # React components
│   │   └── environments/   # Environment UI components
│   ├── hooks/              # Custom React hooks
│   │   └── useEnvironments.ts # Environment management hook
│   ├── lib/                # Shared libraries
│   │   ├── websocket/      # WebSocket handlers
│   │   ├── db.ts           # Drizzle ORM client
│   │   └── logger.ts       # Winston logger
│   ├── services/           # Business logic
│   │   ├── git-service.ts        # Git operations
│   │   ├── claude-pty-manager.ts # Claude Code PTY sessions
│   │   ├── process-manager.ts    # Session status management
│   │   ├── pty-manager.ts        # Shell terminal sessions
│   │   ├── environment-service.ts # Environment CRUD operations
│   │   ├── environment-adapter.ts # Adapter interface
│   │   ├── adapter-factory.ts    # Adapter singleton factory
│   │   └── adapters/             # Environment adapters
│   │       ├── host-adapter.ts   # Local execution
│   │       └── docker-adapter.ts # Docker execution
│   ├── store/              # Zustand state stores
│   └── types/              # TypeScript types
├── docs/                   # Documentation
│   ├── SETUP.md
│   ├── ENV_VARS.md
│   ├── API.md
│   ├── GITHUB_PAT.md
│   ├── design.md
│   ├── requirements.md
│   ├── tasks.md
│   ├── migration-guide.md
│   ├── docker-process-api/  # Docker process API design docs
│   ├── remote-repo/         # Remote repository feature docs
│   ├── feedback/            # Feedback and issues
│   └── sdd/                 # Software Design Documents (統合)
│       ├── design/          # Technical design documents
│       │   ├── index.md     # Design overview
│       │   ├── core/        # Core architecture
│       │   ├── claude-interaction/
│       │   ├── claude-options/
│       │   ├── docker-terminal/
│       │   ├── docker-worktree-fix/
│       │   ├── drizzle-migration/
│       │   ├── git-operations/
│       │   ├── hybrid-clone/
│       │   ├── issue-101-pty-refactor/
│       │   ├── notifications/
│       │   ├── responsive/
│       │   ├── settings-ui/
│       │   ├── terminal/
│       │   └── ... (other design docs)
│       ├── requirements/    # Requirements specifications
│       │   ├── index.md     # Requirements overview
│       │   └── ... (organized by feature)
│       ├── tasks/           # Implementation tasks
│       │   ├── index.md     # Task overview
│       │   └── ... (organized by feature)
│       ├── troubleshooting/ # Problem analysis
│       ├── reports/         # Verification and consistency reports
│       └── archive/         # Archived documents
│           ├── completed-phases.md
│           ├── sdd-* (legacy feature docs)
│           └── ... (archived design/requirements/tasks)
└── logs/                   # PM2 logs (gitignored)
```

## Documentation

- **Setup**: docs/SETUP.md
- **Environment Variables**: docs/ENV_VARS.md
- **API Reference**: docs/API.md
- **Software Design Documents**: docs/sdd/
  - **Design**: docs/sdd/design/ - Technical design documents
  - **Requirements**: docs/sdd/requirements/ - Requirements specifications
  - **Tasks**: docs/sdd/tasks/ - Implementation task tracking
  - **Troubleshooting**: docs/sdd/troubleshooting/ - Problem analysis
  - **Reports**: docs/sdd/reports/ - Verification and consistency reports
  - **Archive**: docs/sdd/archive/ - Historical documentation

## Subprocess Testing Rules

### spawnSync/execSync テストでの cwd・env 検証

- `spawnSync`/`execSync` をモックするテストでは、`cwd` のアサーションを必須とし、`env` を明示的に渡している場合は `env` もアサートする
- `expect.objectContaining()` は省略したキーをスルーするため、重要なオプション（`cwd`, `env`）は明示的に検証すること
- 子プロセスの `cwd` に `process.cwd()` を使う場合は、使用意図を必ずコメントで明記すること。意図が書かれていない `cwd: process.cwd()` はコードレビューで指摘対象とする

#### NG例

```typescript
expect(mockSpawnSync).toHaveBeenCalledWith('npx', args,
  expect.objectContaining({ stdio: 'inherit' }) // cwd が未検証
);
```

#### OK例

```typescript
expect(mockSpawnSync).toHaveBeenCalledWith('npx', args,
  expect.objectContaining({
    stdio: 'inherit',
    cwd: expect.any(String),
    env: expect.objectContaining({ DATABASE_URL: expect.any(String) }),
  })
);
```

#### process.cwd() 使用時

NG:
```typescript
const result = spawnSync('cmd', args, {
  cwd: process.cwd(), // 意図不明
});
```

OK:
```typescript
// ユーザーの作業ディレクトリで実行する必要がある（相対パスのファイル操作のため）
const result = spawnSync('cmd', args, {
  cwd: process.cwd(),
});
```

## React Hooks Usage Guidelines

### useEffect Dependency Array Best Practices

**Principle**: Include only primitive values in useEffect dependency arrays. Avoid including functions or objects created by useCallback/useMemo.

**Reason**: Indirect dependencies through useCallback/useMemo can cause unnecessary re-executions, leading to subtle bugs like duplicate WebSocket connections or race conditions.

#### ❌ Bad Example

```typescript
const createWebSocket = useCallback(() => {
  const ws = new WebSocket(url);
  // ... setup logic
  return ws;
}, [sessionId, sessionName]);

useEffect(() => {
  // ... initialization logic
  createWebSocket();
}, [sessionId, createWebSocket]); // ← BAD: Including createWebSocket
// When sessionName changes, createWebSocket gets a new reference,
// causing useEffect to re-run unnecessarily
```

#### ✅ Good Example

```typescript
const createWebSocket = useCallback(() => {
  const ws = new WebSocket(url);
  // ... setup logic
  return ws;
}, [sessionId, sessionName]);

useEffect(() => {
  // ... initialization logic
  createWebSocket();
}, [sessionId]); // ← GOOD: Only primitive values
// useEffect only re-runs when sessionId changes
```

### Alternative Patterns

If you need the function to be stable across renders:

```typescript
// Option 1: Use useRef for the function
const createWebSocketRef = useRef<() => WebSocket>();
createWebSocketRef.current = () => {
  const ws = new WebSocket(url);
  return ws;
};

useEffect(() => {
  createWebSocketRef.current!();
}, [sessionId]);

// Option 2: Inline the function
useEffect(() => {
  const ws = new WebSocket(url);
  // ... setup logic
}, [sessionId, sessionName]); // All dependencies are primitive
```

### Comment and Implementation Consistency

**Rule**: When a code comment describes best practices or warns against anti-patterns, the implementation MUST follow that guidance.

**Example from Real Bug**:
```typescript
// NOTE: createWebSocketは内部でsessionIdを参照するため、sessionIdのみを依存配列に含める
// createWebSocketを依存配列に含めると、sessionName変更時に不要な再接続が発生する可能性がある
}, [sessionId, createWebSocket]); // ← BUG: Comment says not to include it, but implementation does!
```

**Prevention**:
- During code review, verify that comments and implementation are aligned
- If implementation contradicts a comment, either fix the code or update the comment
- Use ESLint custom rules to detect such inconsistencies

### Testing Requirements

When writing hooks that manage connections or side effects:

1. **Test connection count**: Verify that connections are created exactly once per mount
2. **Test re-render behavior**: Ensure re-renders with same props don't recreate connections
3. **Test cleanup**: Verify connections are properly closed on unmount

Example test structure:
```typescript
describe('Connection management', () => {
  it('creates connection only once on mount', async () => {
    const spy = vi.spyOn(global, 'WebSocket');
    renderHook(() => useMyHook(sessionId));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  });
});
```

## Feature Specification Summary

> **Note**: このセクションの件数は手動管理です。API/サービス追加時は件数も更新してください。
> 生成元: `src/app/api/` (routes), `src/db/schema.ts` (tables), `src/services/` (services), `server.ts` (WebSocket)

### API Endpoints (76 routes)

**Health & Settings (3)**
- `GET /api/health`
- `GET /api/settings/config`
- `PUT /api/settings/config`

**Projects (15)**
- `GET /api/projects` - 一覧
- `POST /api/projects` - 作成
- `GET /api/projects/[id]` - 詳細
- `PATCH /api/projects/[id]` - 部分更新
- `PUT /api/projects/[id]` - 全体更新
- `DELETE /api/projects/[id]` - 削除
- `POST /api/projects/clone` - リポジトリクローン
- `POST /api/projects/[id]/pull` - git pull
- `GET /api/projects/[id]/branches` - ブランチ一覧
- `GET /api/projects/[id]/scripts` - スクリプト一覧
- `POST /api/projects/[id]/scripts` - スクリプト作成
- `PUT /api/projects/[id]/scripts/[scriptId]` - スクリプト更新
- `DELETE /api/projects/[id]/scripts/[scriptId]` - スクリプト削除
- `GET /api/projects/[id]/sessions` - セッション一覧
- `POST /api/projects/[id]/sessions` - セッション作成

**Sessions (19)**
- `GET /api/sessions/[id]` - 詳細
- `PATCH /api/sessions/[id]` - 更新
- `DELETE /api/sessions/[id]` - 削除
- `POST /api/sessions/[id]/input` - Claude入力送信
- `POST /api/sessions/[id]/approve` - Claudeアクション承認
- `POST /api/sessions/[id]/stop` - Claude停止
- `POST /api/sessions/[id]/resume` - セッション再開
- `GET /api/sessions/[id]/process` - プロセス状態取得
- `POST /api/sessions/[id]/process` - プロセス管理 (start/stop/restart)
- `POST /api/sessions/[id]/rebase` - git rebase
- `POST /api/sessions/[id]/reset` - git reset
- `POST /api/sessions/[id]/merge` - git merge
- `GET /api/sessions/[id]/pr` - PR情報取得
- `POST /api/sessions/[id]/pr` - PR作成・更新
- `GET /api/sessions/[id]/messages` - メッセージ履歴
- `GET /api/sessions/[id]/commits` - コミット一覧
- `GET /api/sessions/[id]/diff` - diff取得
- `POST /api/sessions/[id]/run` - スクリプト実行
- `POST /api/sessions/[id]/run/[runId]/stop` - スクリプト停止

**Prompts (3)**
- `GET /api/prompts` - 一覧
- `POST /api/prompts` - 保存
- `DELETE /api/prompts/[id]` - 削除

**Execution Environments (11)**
- `GET /api/environments` - 一覧
- `POST /api/environments` - 作成
- `GET /api/environments/[id]` - 詳細
- `PUT /api/environments/[id]` - 更新
- `DELETE /api/environments/[id]` - 削除
- `POST /api/environments/[id]/apply` - 変更適用
- `GET /api/environments/[id]/sessions` - 使用セッション一覧
- `POST /api/environments/check-ports` - ポート確認
- `GET /api/environments/[id]/dockerfile` - Dockerfile取得
- `POST /api/environments/[id]/dockerfile` - Dockerfile作成・更新
- `DELETE /api/environments/[id]/dockerfile` - Dockerfile削除

**Network Filtering (9)**
- `GET /api/environments/[id]/network-filter` - フィルタ設定取得
- `PUT /api/environments/[id]/network-filter` - フィルタ設定更新
- `POST /api/environments/[id]/network-filter/test` - フィルタテスト
- `GET /api/environments/[id]/network-rules` - ルール一覧
- `POST /api/environments/[id]/network-rules` - ルール作成
- `PUT /api/environments/[id]/network-rules/[ruleId]` - ルール更新
- `DELETE /api/environments/[id]/network-rules/[ruleId]` - ルール削除
- `GET /api/environments/[id]/network-rules/templates` - テンプレート一覧
- `POST /api/environments/[id]/network-rules/templates/apply` - テンプレート適用

**GitHub PAT (5)**
- `GET /api/github-pat` - 一覧
- `POST /api/github-pat` - 追加
- `PATCH /api/github-pat/[id]` - 更新
- `DELETE /api/github-pat/[id]` - 削除
- `POST /api/github-pat/[id]/toggle` - 有効/無効切替

**SSH Keys (3)**
- `GET /api/ssh-keys` - 一覧
- `POST /api/ssh-keys` - 追加
- `DELETE /api/ssh-keys/[id]` - 削除

**Developer Settings (5)**
- `GET /api/developer-settings/global` - グローバルGit設定取得
- `PUT /api/developer-settings/global` - グローバルGit設定更新
- `GET /api/developer-settings/project/[projectId]` - プロジェクトGit設定取得
- `PUT /api/developer-settings/project/[projectId]` - プロジェクトGit設定更新
- `DELETE /api/developer-settings/project/[projectId]` - プロジェクトGit設定削除

**Docker (3)**
- `GET /api/docker/images` - イメージ一覧
- `GET /api/docker/volumes` - ボリューム一覧
- `POST /api/docker/image-build` - イメージビルド

### DB Schema (11 tables)

| Table | Key Columns | 説明 |
|-------|-------------|------|
| Project | id, name, path, remote_url, clone_location, environment_id | プロジェクト管理 |
| ExecutionEnvironment | id, name, type(HOST/DOCKER/SSH), config, auth_dir_path | 実行環境定義 |
| Session | id, project_id, name, status, worktree_path, branch_name, environment_id, session_state | セッション管理 |
| Message | id, session_id, role, content, sub_agents | チャット履歴 |
| Prompt | id, content, used_count, last_used_at | プロンプト履歴 |
| RunScript | id, project_id, name, command | カスタムスクリプト |
| GitHubPAT | id, name, encrypted_token, is_active | GitHub PAT管理 |
| DeveloperSettings | id, scope(GLOBAL/PROJECT), project_id, git_username, git_email | Git設定 |
| NetworkFilterConfig | id, environment_id, enabled | ネットワークフィルタ設定 |
| NetworkFilterRule | id, environment_id, target, port, description, enabled | フィルタルール |
| SshKey | id, name, public_key, private_key_encrypted | SSH鍵管理 |

### WebSocket Endpoints (3)

| Path | Handler | 用途 |
|------|---------|------|
| `/ws/claude/:sessionId` | setupClaudeWebSocket | Claude Code PTYターミナル (raw I/O) |
| `/ws/sessions/:sessionId` | SessionWebSocketHandler | セッションイベント・スクリプト実行 |
| `/ws/terminal/:sessionId` | setupTerminalWebSocket | シェルターミナル |

### Services (19 + 3 adapters)

**Core Services (6):**
- `pty-session-manager.ts` - Session-to-adapter mapping, Claude PTYライフサイクル管理
- `process-lifecycle-manager.ts` - アイドルタイムアウト、graceful shutdown
- `environment-service.ts` - ExecutionEnvironment CRUD・ライフサイクル
- `adapter-factory.ts` - 環境タイプに応じたAdapter生成 (Host/Docker)
- `scrollback-buffer.ts` - ターミナル出力バッファ (再接続時の復元用)
- `run-script-manager.ts` - カスタムスクリプト実行

**Git (3):**
- `git-service.ts` - Worktree作成/削除、rebase、squash merge、diff
- `docker-git-service.ts` - Docker volume内のGit操作
- `gh-cli.ts` - GitHub CLI wrapper (PR作成・ステータス)

**Docker (4):**
- `docker-service.ts` - イメージ、コンテナ、ボリューム管理
- `docker-client.ts` - Dockerode singleton client
- `docker-pty-adapter.ts` - DockerコンテナでのClaude PTY実行
- `docker-pty-stream.ts` - Docker PTY I/Oストリーム管理

**Security (6):**
- `encryption-service.ts` - AES-256-GCM暗号化/復号
- `github-pat-service.ts` - GitHub PAT CRUD + 暗号化
- `ssh-key-service.ts` - SSH鍵 CRUD + 暗号化
- `auth-directory-manager.ts` - Docker環境の認証ディレクトリ管理
- `network-filter-service.ts` - ネットワークフィルタリングルールCRUD
- `proxy-client.ts` - network-filter-proxy API client

**Adapters (3, src/services/adapters/):**
- `base-adapter.ts` - EnvironmentAdapter基底クラス
- `host-adapter.ts` - HOST環境 (ローカル実行)
- `docker-adapter.ts` - DOCKER環境 (コンテナ実行)

### Environment Variables

**必須:**
- `DATABASE_URL` - SQLite DB URL (Docker Compose: `file:/data/claudework.db`)

**主要オプション:**
- `PORT` (3000), `NODE_ENV`, `LOG_LEVEL` (info), `DATA_DIR` (./data)
- `CLAUDE_CODE_PATH` - Claude CLIパス (自動検出)
- `ENCRYPTION_KEY` - AES-256-GCM暗号化キー (Base64)
- `ALLOWED_ORIGINS` - CORS許可オリジン (カンマ区切り)
- `ALLOWED_PROJECT_DIRS` - プロジェクトディレクトリ制限
- `ALLOW_HOST_ENVIRONMENT` - HOST実行環境許可
- `PROCESS_IDLE_TIMEOUT_MINUTES` (0=無効) - アイドルプロセス自動停止
- `PROXY_API_URL` - network-filter-proxy API URL
- `DOCKER_IMAGE_NAME`, `DOCKER_IMAGE_TAG` - Docker環境イメージ設定
