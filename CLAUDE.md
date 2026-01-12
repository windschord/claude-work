# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaudeWork is a web-based tool for managing multiple Claude Code sessions through a browser interface. It uses Docker containers to isolate each session in its own environment, allowing parallel execution of multiple Claude Code instances with full environment isolation and reproducibility.

## Architecture

### Core Components

**Server Architecture** (server.ts):
- Custom Next.js server with WebSocket support
- Session WebSocket (`/ws/session/:id`): Docker container terminal (docker exec)
- Simplified architecture focused on Docker container management

**Session Management**:
- Each session runs in an isolated Docker container
- ContainerManager orchestrates Docker containers and volumes
- docker exec via node-pty provides terminal access
- Sessions are persisted in SQLite via Prisma
- UI provides a thin wrapper around the container terminal (XTerm.js)

**Docker Integration** (src/services/docker-service.ts):
- dockerode for Docker API interaction
- Container lifecycle management (create, start, stop, remove)
- Volume management for persistent workspace storage
- Container status monitoring

**WebSocket Flow** (Docker Terminal):
1. Client connects to `/ws/session/:sessionId`
2. Session handler validates session and container status
3. docker exec spawns PTY session in container
4. XTerm.js on client displays terminal output
5. User input sent to container via WebSocket

### Database Schema

Key models (prisma/schema.prisma):
- **Session**: Docker session with containerId, volumeName, repoUrl, branch, status
- **Prompt**: Prompt history for quick access

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

### Docker Requirements

Docker must be running for the application to work:
- Docker Engine installed and running
- Docker socket accessible at `/var/run/docker.sock`
- Build the session image: `docker build -t claudework-session docker/`

### Optional Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: development/production
- `LOG_LEVEL`: winston log level (default: info)
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)

See `docs/ENV_VARS.md` for complete reference.

## Critical Implementation Details

### Docker Container Management

Each session runs in an isolated Docker container:
- Container created from `claudework-session` image
- Volume mounted at `/workspace` for persistent storage
- Claude CLI credentials mounted read-only from host `~/.claude/`
- Git config mounted read-only from host `~/.gitconfig`
- SSH agent forwarded via `SSH_AUTH_SOCK`

Container lifecycle:
1. Create volume (`claudework-<session-name>`)
2. Create container with volume and credential mounts
3. Start container and clone repository
4. docker exec provides terminal access
5. On deletion, remove container and volume

### Thin Wrapper Architecture

The UI is a thin wrapper around the container terminal:
- No parsing of Claude Code output on the server
- User interacts directly with the container shell
- All Claude Code features work natively inside container
- XTerm.js displays raw terminal output

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

## Project Structure

```text
├── server.ts                 # Custom Next.js server with WebSocket
├── docker/                   # Docker configuration
│   ├── Dockerfile           # Session container image
│   └── docker-entrypoint.sh # Container entrypoint script
├── ecosystem.config.js       # PM2 process configuration
├── data/                     # SQLite database files
├── prisma/
│   └── schema.prisma        # Database schema (Session, Prompt)
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/sessions/   # Session API routes
│   │   └── docker/         # Docker session management page
│   ├── components/          # React components
│   │   └── docker-sessions/ # Docker session UI components
│   ├── hooks/              # Custom React hooks
│   │   └── useDockerTerminal.ts # Docker terminal WebSocket hook
│   ├── lib/                # Shared libraries
│   │   ├── websocket/      # WebSocket handlers
│   │   ├── db.ts           # Prisma client
│   │   └── logger.ts       # Winston logger
│   ├── services/           # Business logic
│   │   ├── docker-service.ts     # Docker API operations
│   │   ├── session-manager.ts    # Session CRUD operations
│   │   └── container-manager.ts  # Container orchestration
│   ├── store/              # Zustand state stores
│   └── types/              # TypeScript types
├── docs/                   # Documentation
└── logs/                   # PM2 logs (gitignored)
```

## Documentation

- **Setup**: docs/SETUP.md
- **Environment Variables**: docs/ENV_VARS.md
- **API Reference**: docs/API.md
- **Task Planning**: docs/tasks/phase*.md
- **Test Reports**: docs/verification-report-*.md
- **Integration Testing**: docs/integration-test-report.md
