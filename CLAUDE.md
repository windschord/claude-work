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

### Running the Application

**必ず `npx` を使用してください。** `npm run start` ではなく `npx claude-work` を使います。

```bash
# バックグラウンドで起動（推奨）
npx claude-work start

# 停止
npx claude-work stop

# その他のコマンド
npx claude-work restart  # 再起動
npx claude-work status   # 状態確認
npx claude-work logs     # ログ表示
npx claude-work help     # ヘルプ
npx claude-work          # フォアグラウンドで起動（Ctrl+C で停止）
```

### Required Environment Variables

Create `.env` file with:

```bash
DATABASE_URL=file:../data/claudework.db
```

### Optional Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: development/production
- `LOG_LEVEL`: winston log level (default: info)
- `CLAUDE_CODE_PATH`: Path to claude CLI (default: 'claude')
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)
- `ALLOWED_PROJECT_DIRS`: Restrict project directories

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
│   ├── SYSTEMD_SETUP.md
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
