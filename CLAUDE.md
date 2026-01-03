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
- Sessions are persisted in SQLite via Prisma
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

Key models (prisma/schema.prisma):
- **Project**: Git repository with default model setting
- **Session**: Links to project, has worktree_path and branch_name
- **Message**: Chat history with role/content
- **RunScript**: Custom scripts per project

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
npm run pm2:status        # Check process status
npm run pm2:logs          # View logs
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
npx prisma generate       # Generate Prisma client
npx prisma db push        # Push schema to database
npx prisma studio         # Database GUI

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
1. Creates branch `claude-work/<session-name>`
2. Creates worktree at `.worktrees/<session-name>/`
3. Runs Claude Code with cwd set to worktree path
4. On deletion, removes worktree and prunes references

Security: All paths validated against `.worktrees/` base to prevent traversal attacks.

### Database Migrations

Prisma schema changes require:

```bash
# Apply schema changes to SQLite
npx prisma db push

# Regenerate Prisma client
npx prisma generate
```

Note: Using `db push` instead of migrations for SQLite simplicity.

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

1. Update `prisma/schema.prisma`
2. Run `npx prisma db push`
3. Run `npx prisma generate`
4. Create service layer in `src/lib/` or `src/services/`
5. Add tests for database operations

## Known Issues (Phase 18 baseline and Phase 19 status)

See `docs/verification-report-browser-ui-phase18.md` for the Phase 18 baseline status.

1. **Critical** (resolved in Phase 19): Claude Code `--cwd` option not supported (process-manager.ts:98)
2. **Critical** (partially resolved in Phase 19): WebSocket remains disconnected
3. **Low**: Next.js HMR WebSocket 404 in custom server mode
4. **Low**: Multiple lockfile warning (remove package-lock.json)

Phase 19 tasks (docs/tasks/phase19.md) implement fixes for issues 1-2.

## Project Structure

```text
├── server.ts                 # Custom Next.js server with WebSocket
├── ecosystem.config.js       # PM2 process configuration
├── data/                     # SQLite database files (バックアップ対象)
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   └── (pages)/        # Frontend pages
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Shared libraries
│   │   ├── websocket/      # WebSocket handlers
│   │   ├── db.ts           # Prisma client
│   │   └── logger.ts       # Winston logger
│   ├── services/           # Business logic
│   │   ├── git-service.ts        # Git operations
│   │   ├── claude-pty-manager.ts # Claude Code PTY sessions
│   │   ├── process-manager.ts    # Session status management
│   │   └── pty-manager.ts        # Shell terminal sessions
│   ├── store/              # Zustand state stores
│   └── types/              # TypeScript types
├── docs/                   # Documentation
│   ├── SETUP.md
│   ├── ENV_VARS.md
│   ├── API.md
│   └── tasks/              # Phase-based task tracking
└── logs/                   # PM2 logs (gitignored)
```

## Documentation

- **Setup**: docs/SETUP.md
- **Environment Variables**: docs/ENV_VARS.md
- **API Reference**: docs/API.md
- **Task Planning**: docs/tasks/phase*.md
- **Test Reports**: docs/verification-report-*.md
- **Integration Testing**: docs/integration-test-report.md
