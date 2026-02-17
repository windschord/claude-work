import dotenv from 'dotenv';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { ConnectionManager } from './src/lib/websocket/connection-manager';
import { SessionWebSocketHandler } from './src/lib/websocket/session-ws';
import { setupTerminalWebSocket } from './src/lib/websocket/terminal-ws';
import { setupClaudeWebSocket } from './src/lib/websocket/claude-ws';
import { logger } from './src/lib/logger';
import { validateRequiredEnvVars, detectClaudePath } from './src/lib/env-validation';
import { ensureDataDirs, getDataDir } from './src/lib/data-dir';
import {
  getProcessLifecycleManager,
  ProcessLifecycleManager,
} from './src/services/process-lifecycle-manager';
import { environmentService } from './src/services/environment-service';
import { DockerAdapter } from './src/services/adapters/docker-adapter';
import { db } from './src/lib/db';
import { ptySessionManager } from './src/services/pty-session-manager';
import { validateSchemaIntegrity, formatValidationError } from './src/lib/schema-check';

// 環境変数を.envファイルから明示的にロード（PM2で設定されている場合はそちらを優先）
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  // .envファイルが見つからない場合は警告のみ（環境変数が直接設定されている場合があるため）
  console.warn('Warning: Could not load .env file:', dotenvResult.error.message);
}

// 環境変数のロード状況を確認（デバッグログ）
console.log('Environment variables loaded:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('  DATA_DIR:', process.env.DATA_DIR || 'NOT SET (using default)');

// 環境変数のバリデーション（サーバー起動前）
try {
  validateRequiredEnvVars();
} catch (error) {
  if (error instanceof Error) {
    console.error('\nEnvironment variable validation failed:\n');
    console.error(error.message);
  }
  process.exit(1);
}

// データディレクトリの初期化
try {
  ensureDataDirs();
  logger.info('Data directories initialized', { dataDir: getDataDir() });
} catch (error) {
  const dataDir = getDataDir();
  console.error('\nFailed to initialize data directories:\n');
  console.error(`  DATA_DIR: ${process.env.DATA_DIR || 'NOT SET (using default)'}`);
  console.error(`  Resolved path: ${dataDir}`);
  if (error instanceof Error) {
    console.error(`  Error: ${error.message}`);
  }
  process.exit(1);
}

// Claude Code CLIのパスを検出・設定
try {
  const claudePath = detectClaudePath();
  process.env.CLAUDE_CODE_PATH = claudePath;
  logger.info('Claude Code CLI detected', { path: claudePath });
} catch (error) {
  logger.error('Failed to detect Claude Code CLI', {
    error: error instanceof Error ? error.message : String(error),
  });
  console.error('\nClaude Code CLI detection failed:\n');
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

// スキーマ整合性チェック（HTTPサーバー起動前）
logger.info('Checking database schema integrity...');
const schemaValidationResult = validateSchemaIntegrity(db);
if (!schemaValidationResult.valid) {
  console.error(formatValidationError(schemaValidationResult));
  logger.error('Database schema is out of sync. Exiting.');
  process.exit(1);
}
logger.info('Schema integrity OK', {
  checkedTables: schemaValidationResult.checkedTables.length,
});

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Next.jsアプリを初期化
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// WebSocket関連のインスタンス
const connectionManager = ConnectionManager.getInstance();
const wsHandler = new SessionWebSocketHandler(connectionManager);

/**
 * WebSocketパスからセッションIDを抽出
 *
 * @param pathname - リクエストパス（例: /ws/sessions/abc123）
 * @returns セッションID、または抽出失敗時はnull
 */
function extractSessionId(pathname: string): string | null {
  const match = pathname.match(/^\/ws\/sessions\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const sessionId = match[1];
  // UUID形式のバリデーション（ハイフン区切りの形式）
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(sessionId)) {
    return null;
  }

  return sessionId;
}

/**
 * サーバーを起動
 */
app.prepare().then(() => {
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      logger.error('Error handling request', { error: err });
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // WebSocketサーバーを初期化
  const wss = new WebSocketServer({ noServer: true });
  const terminalWss = new WebSocketServer({ noServer: true });
  const claudeWss = new WebSocketServer({ noServer: true });

  // ターミナルWebSocketをセットアップ
  setupTerminalWebSocket(terminalWss, '/ws/terminal');

  // Claude Code WebSocketをセットアップ
  setupClaudeWebSocket(claudeWss, '/ws/claude');

  // WebSocketアップグレード処理
  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    try {
      const { pathname } = parse(request.url || '', true);

      logger.info('WebSocket upgrade request', { pathname });

      // ターミナルWebSocketのパス
      if (pathname && pathname.startsWith('/ws/terminal/')) {
        const sessionIdMatch = pathname.match(/^\/ws\/terminal\/([^/]+)$/);
        if (!sessionIdMatch) {
          logger.warn('Invalid terminal WebSocket path', { pathname });
          socket.write('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        const sessionId = sessionIdMatch[1];
        // UUID形式のバリデーション
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(sessionId)) {
          logger.warn('Invalid terminal session ID format', { pathname, sessionId });
          socket.write('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        // ターミナルWebSocketアップグレード（認証なし）
        terminalWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          terminalWss.emit('connection', ws, request);
        });
        return;
      }

      // Claude Code WebSocketのパス
      if (pathname && pathname.startsWith('/ws/claude/')) {
        const sessionIdMatch = pathname.match(/^\/ws\/claude\/([^/]+)$/);
        if (!sessionIdMatch) {
          logger.warn('Invalid Claude WebSocket path', { pathname });
          socket.write('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        const sessionId = sessionIdMatch[1];
        // UUID形式のバリデーション
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(sessionId)) {
          logger.warn('Invalid Claude session ID format', { pathname, sessionId });
          socket.write('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n');
          socket.destroy();
          return;
        }

        // Claude WebSocketアップグレード（認証なし）
        claudeWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          claudeWss.emit('connection', ws, request);
        });
        return;
      }

      // WebSocketパスの検証
      if (!pathname || !pathname.startsWith('/ws/sessions/')) {
        logger.warn('Invalid WebSocket path', { pathname });
        socket.write('HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n');
        socket.destroy();
        return;
      }

      // セッションIDを抽出
      const sessionId = extractSessionId(pathname);
      if (!sessionId) {
        logger.warn('Invalid session ID in path', { pathname });
        socket.write('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n');
        socket.destroy();
        return;
      }

      // WebSocketアップグレードを実行（認証なし）
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request, sessionId);
      });
    } catch (error) {
      logger.error('WebSocket upgrade error', { error });
      socket.write('HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
    }
  });

  // WebSocket接続ハンドラー
  wss.on('connection', (ws: WebSocket, request: IncomingMessage, sessionId: string) => {
    logger.info('WebSocket connection established', { sessionId });

    // セッションハンドラーに接続を渡す
    wsHandler.handleConnection(ws, sessionId);
  });

  // サーバー起動
  server.listen(port, hostname, async () => {
    logger.info('Server started', {
      url: `http://${hostname}:${port}`,
      environment: dev ? 'development' : 'production',
    });
    console.log(`> Ready on http://${hostname}:${port}`);

    // デフォルト環境の初期化（TASK-EE-016）
    try {
      await environmentService.ensureDefaultExists();
      logger.info('Default environment initialized');
    } catch (error) {
      logger.error('Failed to initialize default environment', { error });
      // デフォルト環境の初期化失敗はクリティカルではないため、サーバーは継続
    }

    // セッション復元（TASK-018）
    try {
      await ptySessionManager.restoreSessionsOnStartup();
      logger.info('Session restoration completed');
    } catch (error) {
      logger.error('Failed to restore sessions on startup', { error });
      // セッション復元の失敗はクリティカルではないため、サーバーは継続
    }

    // 孤立したDockerコンテナのクリーンアップ（TASK-014）
    try {
      await DockerAdapter.cleanupOrphanedContainers(db);
      logger.info('Orphaned Docker containers cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup orphaned Docker containers', { error });
      // クリーンアップ失敗はクリティカルではないため、サーバーは継続
    }

    // アイドルタイムアウトチェッカーを開始
    const idleTimeoutMinutes = ProcessLifecycleManager.getIdleTimeoutMinutes();
    const lifecycleManager = getProcessLifecycleManager();
    lifecycleManager.startIdleChecker(idleTimeoutMinutes);
    if (idleTimeoutMinutes > 0) {
      logger.info('Idle timeout checker started', { timeoutMinutes: idleTimeoutMinutes });
    }
  });

  // エラーハンドリング
  server.on('error', (error: Error) => {
    logger.error('Server error', { error });
    process.exit(1);
  });

  // グレースフルシャットダウン処理
  const gracefulShutdown = async (signal: 'SIGTERM' | 'SIGINT') => {
    logger.info(`${signal} signal received: initiating graceful shutdown`);

    try {
      // プロセスライフサイクルマネージャーでClaude Codeプロセスを停止
      const lifecycleManager = getProcessLifecycleManager();
      await lifecycleManager.initiateShutdown(signal);
    } catch (error) {
      logger.error('Error during process lifecycle shutdown', { error });
    }

    // WebSocketサーバーを閉じる
    wss.close(() => {
      logger.info('WebSocket server closed');
    });
    terminalWss.close(() => {
      logger.info('Terminal WebSocket server closed');
    });
    claudeWss.close(() => {
      logger.info('Claude WebSocket server closed');
    });

    // HTTPサーバーを閉じる
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // 10秒後に強制終了（サーバーが閉じない場合のフォールバック）
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});
