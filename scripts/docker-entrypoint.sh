#!/bin/sh
# Docker entrypoint for Claude Work
# Handles database migration and claude CLI setup before starting the server
set -e

# Database migration (idempotent - safe to run on every startup)
node -e "
var cliUtils = require('/app/dist/src/bin/cli-utils.js');
var url = process.env.DATABASE_URL || 'file:/data/claudework.db';
var dbPath = url.replace(/^file:/, '');
if (!cliUtils.migrateDatabase(dbPath)) {
  console.error('Database migration failed');
  process.exit(1);
}
console.log('Database ready.');
"

# If claude CLI is not available and CLAUDE_CODE_PATH is not set,
# create a stub so the server can start in Docker execution mode.
# Docker mode uses separate containers for Claude Code; HOST mode requires
# the real claude CLI to be available via CLAUDE_CODE_PATH or PATH.
if ! command -v claude >/dev/null 2>&1 && [ -z "${CLAUDE_CODE_PATH:-}" ]; then
  printf '#!/bin/sh\necho "Claude Code CLI not available. Set CLAUDE_CODE_PATH or use Docker execution environment."\nexit 127\n' > /tmp/claude-stub
  chmod +x /tmp/claude-stub
  export CLAUDE_CODE_PATH=/tmp/claude-stub
fi

# Start the server as PID 1 (exec replaces the shell process)
exec node /app/dist/server.js
