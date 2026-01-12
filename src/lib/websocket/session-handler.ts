import { WebSocket, WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import { SessionManager } from '@/services/session-manager';
import { logger } from '@/lib/logger';

/**
 * WebSocketメッセージ型定義
 */

// クライアント → サーバー（入力）
interface SessionInputMessage {
  type: 'input';
  data: string;
}

// クライアント → サーバー（リサイズ）
interface SessionResizeMessage {
  type: 'resize';
  data: {
    cols: number;
    rows: number;
  };
}

export type SessionClientMessage = SessionInputMessage | SessionResizeMessage;

// サーバー → クライアント（出力）
interface SessionDataMessage {
  type: 'data';
  content: string;
}

// サーバー → クライアント（終了）
interface SessionExitMessage {
  type: 'exit';
  exitCode: number;
  signal: number | null;
}

// サーバー → クライアント（エラー）
interface SessionErrorMessage {
  type: 'error';
  message: string;
}

export type SessionServerMessage =
  | SessionDataMessage
  | SessionExitMessage
  | SessionErrorMessage;

/**
 * セッションWebSocketサーバーをセットアップ
 *
 * docker exec経由でコンテナに接続し、PTY入出力をWebSocket経由で中継する。
 *
 * @param wss - WebSocketサーバーインスタンス
 * @param _path - WebSocketパス（使用しない、互換性のため）
 */
export function setupSessionWebSocket(
  wss: WebSocketServer,
  _path: string
): void {
  const sessionManager = new SessionManager();

  wss.on('connection', async (ws: WebSocket, req) => {
    // URLからセッションIDを取得
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // /ws/session/:id -> ['ws', 'session', ':id']
    const sessionId = pathParts[pathParts.length - 1];

    // セッションID検証
    if (!sessionId || sessionId === '' || sessionId === 'session') {
      logger.warn('Session WebSocket: Session ID missing');
      ws.close(1008, 'Session ID required');
      return;
    }

    // セッション存在確認
    try {
      const session = await sessionManager.findById(sessionId);

      if (!session) {
        logger.warn('Session WebSocket: Session not found', { sessionId });
        ws.close(1008, 'Session not found');
        return;
      }

      if (!session.containerId) {
        logger.warn('Session WebSocket: Container not running', { sessionId });
        ws.close(1008, 'Container is not running');
        return;
      }

      // docker execでPTYを作成
      let ptyProcess: pty.IPty;
      try {
        ptyProcess = pty.spawn('docker', ['exec', '-it', session.containerId, '/bin/bash'], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        });
        logger.info('PTY created for session', {
          sessionId,
          containerId: session.containerId,
          pid: ptyProcess.pid,
        });

        // WebSocketが既に閉じている場合、PTYをクリーンアップ
        if (ws.readyState !== WebSocket.OPEN) {
          logger.warn('WebSocket closed during PTY creation, cleaning up', { sessionId });
          ptyProcess.kill();
          return;
        }
      } catch (ptyError) {
        const errorMessage = ptyError instanceof Error ? ptyError.message : 'Failed to create PTY';
        logger.error('Session WebSocket: Failed to create PTY', {
          sessionId,
          error: errorMessage,
          containerId: session.containerId,
        });

        const errorMsg: SessionErrorMessage = {
          type: 'error',
          message: `PTY creation failed: ${errorMessage}`,
        };
        ws.send(JSON.stringify(errorMsg));
        ws.close(1000, 'PTY creation failed');
        return;
      }

      // PTY出力 → WebSocket
      ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          const message: SessionDataMessage = {
            type: 'data',
            content: data,
          };
          ws.send(JSON.stringify(message));
        }
      });

      // PTY終了 → WebSocket
      ptyProcess.onExit(({ exitCode, signal }) => {
        if (ws.readyState === WebSocket.OPEN) {
          const message: SessionExitMessage = {
            type: 'exit',
            exitCode,
            signal: signal ?? null,
          };
          ws.send(JSON.stringify(message));
          ws.close();
        }
      });

      // WebSocket入力 → PTY
      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString()) as SessionClientMessage;

          if (!data || typeof data !== 'object' || !data.type) {
            logger.warn('Session WebSocket: Invalid message format', { sessionId });
            return;
          }

          if (data.type === 'input') {
            if (typeof data.data !== 'string') {
              logger.warn('Session WebSocket: Invalid input data type', { sessionId });
              return;
            }
            ptyProcess.write(data.data);
          } else if (data.type === 'resize') {
            if (
              !data.data ||
              typeof data.data.cols !== 'number' ||
              typeof data.data.rows !== 'number' ||
              !Number.isFinite(data.data.cols) ||
              !Number.isFinite(data.data.rows) ||
              data.data.cols <= 0 ||
              data.data.rows <= 0 ||
              data.data.cols > 1000 ||
              data.data.rows > 1000
            ) {
              logger.warn('Session WebSocket: Invalid resize dimensions', {
                sessionId,
                cols: data.data?.cols,
                rows: data.data?.rows,
              });
              return;
            }
            ptyProcess.resize(data.data.cols, data.data.rows);
          } else {
            logger.warn('Session WebSocket: Unknown message type', {
              sessionId,
              type: (data as { type: string }).type,
            });
          }
        } catch (error) {
          logger.error('Session WebSocket: Failed to parse message', {
            sessionId,
            error,
          });
        }
      });

      // クリーンアップ
      ws.on('close', () => {
        ptyProcess.kill();
        logger.info('Session WebSocket connection closed', { sessionId });
      });

      ws.on('error', (error: Error) => {
        logger.error('Session WebSocket error', { sessionId, error });
        ptyProcess.kill();
      });

      logger.info('Session WebSocket connection established', { sessionId });
    } catch (error) {
      logger.error('Session WebSocket: Error during connection setup', {
        sessionId,
        error,
      });
      ws.close(1011, 'Internal server error');
    }
  });
}
